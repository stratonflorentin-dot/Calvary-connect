// Lightweight sound effects for calls, messages and notifications.
// Tones are synthesized with the Web Audio API instead of shipping audio
// files, so there is nothing to fetch/license and it works offline.

let sharedCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedCtx || sharedCtx.state === "closed") {
    sharedCtx = new Ctor();
  }
  if (sharedCtx.state === "suspended") {
    // Best-effort; browsers require a prior user gesture to resume, which
    // this app already has by the time a call/message/notification fires.
    sharedCtx.resume().catch(() => {});
  }
  return sharedCtx;
}

function tone(
  ctx: AudioContext,
  startAt: number,
  frequency: number,
  duration: number,
  volume: number,
  type: OscillatorType = "sine",
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(volume, startAt + 0.02);
  gain.gain.linearRampToValueAtTime(0, startAt + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

// Short two-note chime used for new chat messages.
export function playMessageSound() {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  tone(ctx, now, 740, 0.12, 0.08);
  tone(ctx, now + 0.1, 988, 0.14, 0.08);
}

// Short single chime used for generic notifications.
export function playNotificationSound() {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  tone(ctx, now, 880, 0.18, 0.07);
}

// Classic phone-style repeating ring (two short bursts, pause, repeat).
// Returns a stop function; call it to cancel the loop (on accept/decline/hangup).
export function playRingtone(): () => void {
  const ctx = getContext();
  if (!ctx) return () => {};

  let stopped = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const cycle = () => {
    if (stopped) return;
    const ctx2 = getContext();
    if (!ctx2) return;
    const now = ctx2.currentTime;
    tone(ctx2, now, 480, 0.4, 0.1, "sine");
    tone(ctx2, now, 620, 0.4, 0.06, "sine");
    tone(ctx2, now + 0.5, 480, 0.4, 0.1, "sine");
    tone(ctx2, now + 0.5, 620, 0.4, 0.06, "sine");
    timeoutId = setTimeout(cycle, 2000);
  };

  cycle();

  return () => {
    stopped = true;
    if (timeoutId) clearTimeout(timeoutId);
  };
}

// Soft outgoing ringback tone played to the caller while the other side rings.
export function playRingback(): () => void {
  const ctx = getContext();
  if (!ctx) return () => {};

  let stopped = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const cycle = () => {
    if (stopped) return;
    const ctx2 = getContext();
    if (!ctx2) return;
    const now = ctx2.currentTime;
    tone(ctx2, now, 425, 1.0, 0.05, "sine");
    timeoutId = setTimeout(cycle, 3000);
  };

  cycle();

  return () => {
    stopped = true;
    if (timeoutId) clearTimeout(timeoutId);
  };
}
