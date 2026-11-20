"use client";
// Runs one voice call in the browser: starts the agent, joins the Agora channel with the
// microphone, listens for live transcripts over Agora RTM, and polls the call state.
import { useCallback, useEffect, useRef, useState } from "react";
import type { IAgoraRTCClient, IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";
import type { CallState } from "@/lib/store";

export type Phase = "idle" | "starting" | "live" | "ending" | "ended" | "error";
export type AgentMood = "listening" | "thinking" | "speaking" | "idle";
export interface Line {
  key: string;
  who: "you" | "agent";
  text: string;
  final: boolean;
}
export type PublicState = Omit<CallState, "agentId"> & {
  totals: { monthlyBrand: number; monthlyJa: number; monthlySaving: number; yearlySaving: number; pricedCount: number };
};

interface StartResponse {
  sid: string;
  appId: string;
  channel: string;
  uid: number;
  agentUid: number;
  token: string;
  error?: string;
}

export function useCall() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [sid, setSid] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [mood, setMood] = useState<AgentMood>("idle");
  const [state, setState] = useState<PublicState | null>(null);
  const [muted, setMuted] = useState(false);
  const [noMic, setNoMic] = useState(false);
  const rtc = useRef<IAgoraRTCClient | null>(null);
  const mic = useRef<IMicrophoneAudioTrack | null>(null);
  const rtm = useRef<{ logout: () => Promise<unknown> } | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  const upsertLine = useCallback((l: Line) => {
    setLines((prev) => {
      const i = prev.findIndex((p) => p.key === l.key);
      if (i >= 0) {
        const next = prev.slice();
        next[i] = l;
        return next;
      }
      return [...prev, l].slice(-40);
    });
  }, []);

  // The agent publishes its state (listening, thinking, speaking) as its RTM presence.
  const handleAgentState = useCallback((s: string) => {
    if (s === "speaking" || s === "thinking" || s === "listening") setMood(s);
    else if (s === "silent") setMood("listening");
    else setMood("idle");
  }, []);

  const handleMessage = useCallback(
    (raw: unknown) => {
      let msg: Record<string, unknown>;
      try {
        const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw as Uint8Array);
        msg = JSON.parse(text);
      } catch {
        return;
      }
      const obj = String(msg.object ?? "");
      if (obj.includes("transcription") && typeof msg.text === "string") {
        const who = obj.startsWith("user") ? "you" : "agent";
        const turn = String(msg.turn_id ?? msg.message_id ?? Date.now());
        const final = who === "you" ? Boolean(msg.final) : Number(msg.turn_status ?? 1) !== 0;
        if (msg.text.trim()) upsertLine({ key: `${who}-${turn}`, who, text: msg.text, final });
      } else if (obj === "message.state" && typeof msg.state === "string") {
        handleAgentState(msg.state);
      } else if (obj === "message.interrupt") {
        setMood("listening");
      }
    },
    [upsertLine, handleAgentState],
  );

  const refresh = useCallback(async (id: string) => {
    const r = await fetch(`/api/state?sid=${id}`, { cache: "no-store" });
    if (r.ok) setState((await r.json()) as PublicState);
  }, []);

  const start = useCallback(
    async (lang: string) => {
      setError(null);
      setLines([]);
      setState(null);
      setPhase("starting");
      try {
        // Ask for the microphone first. Without one (refused, or no device) the call still
        // starts: the agent talks, and the caller types instead.
        const { default: AgoraRTC } = await import("agora-rtc-sdk-ng");
        AgoraRTC.setLogLevel(3);
        let track: IMicrophoneAudioTrack | null = null;
        try {
          track = await AgoraRTC.createMicrophoneAudioTrack({ AEC: true, ANS: true, AGC: true });
        } catch {
          track = null;
        }
        mic.current = track;
        setNoMic(!track);

        const res = await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lang, agent: "later" }),
        });
        const s = (await res.json()) as StartResponse;
        if (!res.ok) throw new Error(s.error || `start failed (${res.status})`);
        setSid(s.sid);

        // The agent starts while this browser joins the channel; it greets once both are in.
        const agentReady = fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sid: s.sid }),
        }).then(async (r) => {
          if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error || `agent start failed (${r.status})`);
        });
        agentReady.catch(() => {}); // awaited below; this only stops an early "unhandled" warning

        const { default: AgoraRTM } = await import("agora-rtm");
        const r = new AgoraRTM.RTM(s.appId, String(s.uid));
        r.addEventListener("message", (e: { message: unknown }) => handleMessage(e.message));
        type UserState = { userId?: string; states?: Record<string, string> };
        r.addEventListener(
          "presence",
          (e: { eventType?: string; publisher?: string; stateChanged?: Record<string, string>; snapshot?: UserState[] | null; interval?: { userStateList?: UserState[] } | null }) => {
            // Kept on window (last 100) so the demo-path check can report what arrived.
            const w = window as unknown as { __nrPresence?: unknown[] };
            const log = (w.__nrPresence ??= []);
            if (log.length < 100) log.push({ t: Date.now(), type: e.eventType, publisher: e.publisher, state: e.stateChanged?.state });
            const agentIn = (list?: UserState[] | null) => list?.find((u) => u.userId !== String(s.uid) && u.states?.state)?.states?.state;
            if (e.eventType === "REMOTE_STATE_CHANGED" && e.publisher !== String(s.uid) && e.stateChanged?.state) handleAgentState(e.stateChanged.state);
            else if (e.eventType === "SNAPSHOT") {
              const st = agentIn(e.snapshot);
              if (st) handleAgentState(st);
            } else if (e.eventType === "INTERVAL") {
              const st = agentIn(e.interval?.userStateList);
              if (st) handleAgentState(st);
            }
          },
        );
        await r.login({ token: s.token });
        await r.subscribe(s.channel);
        rtm.current = r;

        const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        client.on("user-published", async (user, mediaType) => {
          await client.subscribe(user, mediaType);
          if (mediaType === "audio") user.audioTrack?.play();
        });
        await client.join(s.appId, s.channel, s.token, s.uid);
        if (track) await client.publish([track]);
        rtc.current = client;
        await agentReady;

        poll.current = setInterval(() => refresh(s.sid).catch(() => {}), 1500);
        await refresh(s.sid);
        setPhase("live");
      } catch (e) {
        mic.current?.close();
        mic.current = null;
        await rtc.current?.leave().catch(() => {});
        await rtm.current?.logout().catch(() => {});
        rtc.current = null;
        rtm.current = null;
        setError((e as Error).message || "Couldn't start the call");
        setPhase("error");
      }
    },
    [handleMessage, handleAgentState, refresh],
  );

  const stop = useCallback(async () => {
    setPhase("ending");
    if (poll.current) clearInterval(poll.current);
    poll.current = null;
    try {
      mic.current?.close();
      await rtc.current?.leave();
      await rtm.current?.logout();
    } catch {}
    mic.current = null;
    rtc.current = null;
    rtm.current = null;
    if (sid) {
      await fetch(`/api/session?sid=${sid}`, { method: "DELETE" }).catch(() => {});
      await refresh(sid).catch(() => {});
    }
    setMood("idle");
    setPhase("ended");
  }, [sid, refresh]);

  const toggleMute = useCallback(async () => {
    if (!mic.current) return;
    await mic.current.setEnabled(muted);
    setMuted(!muted);
  }, [muted]);

  useEffect(() => {
    return () => {
      if (poll.current) clearInterval(poll.current);
      mic.current?.close();
      rtc.current?.leave().catch(() => {});
    };
  }, []);

  const typeLine = useCallback(
    async (text: string) => {
      if (!sid || !text.trim()) return;
      upsertLine({ key: `typed-${Date.now()}`, who: "you", text: text.trim(), final: true });
      setMood("thinking");
      const r = await fetch("/api/type", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sid, text }) });
      const j = (await r.json().catch(() => ({}))) as { reply?: string; error?: string };
      if (!r.ok) upsertLine({ key: `typed-err-${Date.now()}`, who: "agent", text: j.error || "Couldn't send that", final: true });
      await refresh(sid).catch(() => {});
    },
    [sid, upsertLine, refresh],
  );

  return { phase, error, sid, lines, mood, state, muted, noMic, start, stop, toggleMute, refresh, typeLine };
}
