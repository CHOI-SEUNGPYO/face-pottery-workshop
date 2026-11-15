// A stalled frame must not skip an entire firing phase. Normal frame times
// still follow the 14 s (or reduced-motion 4 s) timeline.
export function advanceFiring(progress, elapsedMs, durationMs) {
  const step = Math.min(.1, Math.max(0, elapsedMs / durationMs));
  return Math.min(1, progress + step);
}
