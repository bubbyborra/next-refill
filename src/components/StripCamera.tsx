"use client";
// "Show the strip": opens the camera, takes one photo, and sends it to be read.
import { useEffect, useRef, useState } from "react";

export function StripCamera({ sid, onDone }: { sid: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);

  // Attach the camera after React has rendered the video element. Attaching it in an
  // animation frame raced the render: the frame could run first, and the box stayed black.
  useEffect(() => {
    const v = video.current;
    if (open && v && stream.current && v.srcObject !== stream.current) {
      v.srcObject = stream.current;
      void v.play().catch(() => {});
    }
  }, [open]);

  async function openCam() {
    setMsg(null);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1600 } }, audio: false });
      setOpen(true); // the effect below attaches the stream once the video element exists
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
    <div className="nr-strip">
      {!open && (
        <button onClick={openCam} disabled={busy} className="nr-btn nr-btn--small nr-btn--ghost">
          {busy ? "Reading the strip…" : "Show the strip to the camera"}
        </button>
      )}
      {open && (
        <div className="nr-strip__cam">
          <video ref={video} playsInline muted className="nr-strip__video" />
          <div className="nr-strip__btns">
            <button onClick={snap} className="nr-btn nr-btn--small nr-btn--light">
              Take photo
            </button>
            <button onClick={closeCam} className="nr-btn nr-btn--small nr-btn--bare">
              Cancel
            </button>
          </div>
          <p className="nr-strip__hint">Hold the side with the composition (salt name and mg) and the MRP towards the camera.</p>
        </div>
      )}
      {msg && <p className="nr-strip__msg">{msg}</p>}
    </div>
  );
}
