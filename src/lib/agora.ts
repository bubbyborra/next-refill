// Starting, stopping and speaking through the Agora Conversational AI agent.
import { Agent, AgoraClient, Area, CustomLLM, ExpiresIn, MurfTTS, SarvamSTT, generateClientToken, generateConvoAIToken } from "agora-agents";
import { envValue, requireEnv as env } from "./env";
import type { Lang } from "./languages";

// A fresh client per request: a long-lived one ended up sending an expired token
// ("Token is expired") once the server had been up for about an hour.
export function agora(): AgoraClient {
  return new AgoraClient({ area: Area.AP, appId: env("AGORA_APP_ID"), appCertificate: env("AGORA_APP_CERTIFICATE") });
}

export function clientToken(channel: string, uid: number): string {
  return generateClientToken({ appId: env("AGORA_APP_ID"), appCertificate: env("AGORA_APP_CERTIFICATE"), channelName: channel, uid });
}

export async function startAgent(opts: {
  sid: string;
  lang: Lang;
  channel: string;
  userUid: number;
  agentUid: number;
  baseUrl: string;
}): Promise<string> {
  const { lang } = opts;
  const agent = new Agent({
    client: agora(),
    turnDetection: {
      // Indian languages use voice-activity end of turn (semantic detection is English/Chinese only)
      language: lang.bcp47 as never,
      config: {
        start_of_speech: { mode: "vad", vad_config: { interrupt_duration_ms: 200, prefix_padding_ms: 300 } },
        end_of_speech: { mode: "vad", vad_config: { silence_duration_ms: 700 } },
      },
    } as never,
    advancedFeatures: { enable_rtm: true },
    parameters: { data_channel: "rtm", enable_error_message: true } as never,
  })
    .withStt(new SarvamSTT({ apiKey: env("SARVAM_API_KEY"), language: lang.bcp47 }))
    .withLlm(
      new CustomLLM({
        url: `${opts.baseUrl}/api/llm?sid=${opts.sid}`,
        apiKey: env("LLM_ROUTE_KEY"),
        model: "next-refill",
        greetingMessage: lang.greeting,
        failureMessage: lang.failure,
        maxHistory: 32,
      }),
    )
    .withTts(
      new MurfTTS({
        key: env("MURF_API_KEY"),
        voiceId: lang.voiceId,
        locale: lang.murfLocale,
        model: envValue("MURF_MODEL") || "FALCON",
        sampleRate: 24000,
      }),
    );

  const session = agent.createSession({
    name: `nr-${opts.sid}`,
    channel: opts.channel,
    agentUid: String(opts.agentUid),
    remoteUids: [String(opts.userUid)],
    idleTimeout: 120,
    expiresIn: ExpiresIn.hours(1),
  });
  return await session.start();
}

export interface AgentRef {
  agentId: string;
  channel: string;
  agentUid: number;
}

// Calls on a running agent are signed with a ConvoAI token for its channel and UID,
// the same way the SDK's own session signs them.
function agentHeaders(a: AgentRef) {
  const token = generateConvoAIToken({ appId: env("AGORA_APP_ID"), appCertificate: env("AGORA_APP_CERTIFICATE"), channelName: a.channel, uid: a.agentUid });
  return { Authorization: `agora token=${token}` };
}

export async function stopAgent(a: AgentRef): Promise<void> {
  await agora().agents.stop({ appid: env("AGORA_APP_ID"), agentId: a.agentId }, { headers: agentHeaders(a) });
}

// Says a line on the call (the agent's speak API), e.g. after reading a strip photo.
// The text limit is 512 bytes, so long lines are cut at a sentence boundary.
export async function speak(a: AgentRef, text: string): Promise<void> {
  let t = text.trim();
  while (new TextEncoder().encode(t).length > 500) {
    const cut = Math.max(t.lastIndexOf(".", t.length - 2), t.lastIndexOf("।", t.length - 2), t.lastIndexOf("?", t.length - 2));
    t = cut > 0 ? t.slice(0, cut + 1) : t.slice(0, Math.floor(t.length * 0.8));
  }
  await agora().agents.speak(
    { appid: env("AGORA_APP_ID"), agentId: a.agentId, text: t, priority: "APPEND", interruptable: true },
    { headers: agentHeaders(a) },
  );
}
