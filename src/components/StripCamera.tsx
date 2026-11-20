"use client";
// "Show the strip": opens the camera, takes one photo, and sends it to be read.
import { useRef, useState } from "react";

export function StripCamera({ sid, onDone }: { sid: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);

  async function openCam() {
    setMsg(null);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1600 } }, audio: false });
      setOpen(true);
      requestAnimationFrame(() => {
        if (video.current && stream.current) {
          video.current.srcObject = stream.current;
          void video.current.play();
        }
      });
    } catch {
      setMsg("Camera not available. You can read the composition line aloud instead.");
    }
  }

  function closeCam() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setOpen(false);
  }

  async function snap() {
    const v = video.current;
    if (!v) return;
    const scale = Math.min(1, 1400 / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(v.videoWidth * scale);
    c.height = Math.round(v.videoHeight * scale);
    c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
    const image = c.toDataURL("image/jpeg", 0.85);
    closeCam();
    setBusy(true);
    try {
      const r = await fetch("/api/strip", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sid, image }) });
      const j = (await r.json()) as { summary?: string; error?: string };
      setMsg(j.summary ? `Read from the strip: ${j.summary}` : j.error || "Couldn't read it");
      onDone();
    } catch {
      setMsg("Couldn't send the photo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      {!open && (
        <button onClick={openCam} disabled={busy} className="rounded-full border border-ink px-4 py-2 text-sm font-semibold text-ink hover:bg-ink hover:text-white disabled:opacity-50">
          {busy ? "Reading the strip…" : "Show the strip to the camera"}
        </button>
      )}
      {open && (
        <div className="rounded-2xl bg-ink p-3">
          <video ref={video} playsInline muted className="aspect-video w-full rounded-xl object-cover" />
          <div className="mt-3 flex gap-2">
            <button onClick={snap} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink">
              Take photo
            </button>
            <button onClick={closeCam} className="rounded-full px-4 py-2 text-sm text-white">
              Cancel
            </button>
          </div>
          <p className="mt-2 text-xs text-white/70">Hold the side with the composition (salt name and mg) and the MRP towards the camera.</p>
        </div>
      )}
      {msg && <p className="mt-2 text-sm text-ink-soft">{msg}</p>}
    </div>
  );
}
