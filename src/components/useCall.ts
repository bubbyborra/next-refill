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
  totals: {
    monthlyBrand: number;
    monthlyJa: number;
    monthlySaving: number;
    yearlySaving: number;
    pricedCount: number;
  };
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
  // "reconnecting" while Agora's connection drops and comes back (a venue's Wi-Fi blips).
  const [net, setNet] = useState<"ok" | "reconnecting">("ok");
  const rtc = useRef<IAgoraRTCClient | null>(null);
  const mic = useRef<IMicrophoneAudioTrack | null>(null);
  const rtm = useRef<{ logout: () => Promise<unknown> } | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  // The agent's uid as last seen, and how to log in to RTM again (see refresh).
  const agentUidSeen = useRef<number | null>(null);
  // Whether anything has come from the agent over RTM in this call (see the watchdog in start).
  const rtmHeard = useRef(false);
  const rtmConnect = useRef<(() => Promise<void>) | null>(null);

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
        const text =
          typeof raw === "string"
            ? raw
            : new TextDecoder().decode(raw as Uint8Array);
        msg = JSON.parse(text);
      } catch {
        return;
      }
      const obj = String(msg.object ?? "");
      if (obj.includes("transcription") && typeof msg.text === "string") {
        const who = obj.startsWith("user") ? "you" : "agent";
        const turn = String(msg.turn_id ?? msg.message_id ?? Date.now());
        const final =
          who === "you"
            ? Boolean(msg.final)
            : Number(msg.turn_status ?? 1) !== 0;
        if (msg.text.trim())
          upsertLine({ key: `${who}-${turn}`, who, text: msg.text, final });
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
    if (!r.ok) return;
    const st = (await r.json()) as PublicState;
    setState(st);
    // When the first agent fails on start, the server starts a replacement with a new uid. It
    // joins after this browser is already in the RTM channel, and then its transcript and state
    // often never arrive. Logging in to RTM again after it has joined is the order that works.
    if (
      agentUidSeen.current !== null &&
      st.agentUid !== agentUidSeen.current &&
      rtmConnect.current
    ) {
      agentUidSeen.current = st.agentUid;
      const old = rtm.current;
      rtm.current = null;
      await old?.logout().catch(() => {});
      await rtmConnect.current().catch(() => {});
    }
  }, []);

  const start = useCallback(
    async (lang: string) => {
      setError(null);
      rtmHeard.current = false;
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
          track = await AgoraRTC.createMicrophoneAudioTrack({
            AEC: true,
            ANS: true,
            AGC: true,
          });
        } catch {
          track = null;
        }
        mic.current = track;
        setNoMic(!track);

        const res = await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lang }),
        });
        const s = (await res.json()) as StartResponse;
        if (!res.ok) throw new Error(s.error || `start failed (${res.status})`);
        setSid(s.sid);

        agentUidSeen.current = s.agentUid;
        const { default: AgoraRTM } = await import("agora-rtm");
        const connectRtm = async () => {
          const r = new AgoraRTM.RTM(s.appId, String(s.uid));
          r.addEventListener("message", (e: { message: unknown }) => {
            rtmHeard.current = true;
            handleMessage(e.message);
          });
          type UserState = { userId?: string; states?: Record<string, string> };
          r.addEventListener(
            "presence",
            (e: {
              eventType?: string;
              publisher?: string;
              stateChanged?: Record<string, string>;
              snapshot?: UserState[] | null;
              interval?: { userStateList?: UserState[] } | null;
            }) => {
              // Kept on window (last 100) so the demo-path check can report what arrived.
              const w = window as unknown as { __nrPresence?: unknown[] };
              const log = (w.__nrPresence ??= []);
              if (log.length < 100)
                log.push({
                  t: Date.now(),
                  type: e.eventType,
                  publisher: e.publisher,
                  state: e.stateChanged?.state,
                  users: e.snapshot?.map((u) => u.userId),
                });
              if (e.eventType === "REMOTE_STATE_CHANGED" && e.publisher !== String(s.uid)) rtmHeard.current = true;
              const agentIn = (list?: UserState[] | null) =>
                list?.find((u) => u.userId !== String(s.uid) && u.states?.state)
                  ?.states?.state;
              if (
                e.eventType === "REMOTE_STATE_CHANGED" &&
                e.publisher !== String(s.uid) &&
                e.stateChanged?.state
              )
                handleAgentState(e.stateChanged.state);
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
        };
        await connectRtm();
        rtmConnect.current = connectRtm;

        const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        client.on("connection-state-change", (cur) =>
          setNet(cur === "RECONNECTING" ? "reconnecting" : "ok"),
        );
        client.on("user-published", async (user, mediaType) => {
          await client.subscribe(user, mediaType);
          if (mediaType === "audio") user.audioTrack?.play();
        });
        await client.join(s.appId, s.channel, s.token, s.uid);
        if (track) await client.publish([track]);
        rtc.current = client;

        poll.current = setInterval(() => refresh(s.sid).catch(() => {}), 1500);
        await refresh(s.sid);
        setPhase("live");

        // Now and then the page hears nothing from the agent over RTM for a whole call, though
        // the agent talks (its audio comes over RTC) and the bill still fills from the server.
        // If nothing has arrived 6 s after going live, log in to RTM again, twice at most.
        const watch = async (tries: number) => {
          await new Promise((res) => setTimeout(res, 6000));
          if (rtmHeard.current || !rtmConnect.current || tries <= 0) return;
          const old = rtm.current;
          rtm.current = null;
          await old?.logout().catch(() => {});
          await rtmConnect.current().catch(() => {});
          void watch(tries - 1);
        };
        void watch(2);
      } catch (e) {
        mic.current?.close();
        mic.current = null;
        await rtc.current?.leave().catch(() => {});
        await rtm.current?.logout().catch(() => {});
        rtc.current = null;
        rtm.current = null;
        rtmConnect.current = null;
        agentUidSeen.current = null;
        setError((e as Error).message || "Couldn't start the call");
        setPhase("error");
      }
    },
    [handleMessage, handleAgentState, refresh],
  );

  const stop = useCallback(async () => {
    setPhase("ending");
    rtmConnect.current = null;
    agentUidSeen.current = null;
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
      await fetch(`/api/session?sid=${sid}`, { method: "DELETE" }).catch(
        () => {},
      );
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
      upsertLine({
        key: `typed-${Date.now()}`,
        who: "you",
        text: text.trim(),
        final: true,
      });
      setMood("thinking");
      const r = await fetch("/api/type", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sid, text }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        reply?: string;
        error?: string;
      };
      if (!r.ok)
        upsertLine({
          key: `typed-err-${Date.now()}`,
          who: "agent",
          text: j.error || "Couldn't send that",
          final: true,
        });
      await refresh(sid).catch(() => {});
    },
    [sid, upsertLine, refresh],
  );

  return {
    phase,
    error,
    sid,
    lines,
    mood,
    state,
    muted,
    noMic,
    net,
    start,
    stop,
    toggleMute,
    refresh,
    typeLine,
  };
}
