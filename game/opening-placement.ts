import { Vector3 } from "three";
import type { UV } from "./model";
import type { StrokePoint } from "./stroke";

export interface ScreenPoint { x: number; y: number; }
export interface OpeningHit {
  uv: UV;
  point: Vector3;
  normal: Vector3;
  facing: number;
}
export interface OpeningPlacement {
  outline: ScreenPoint[];
  samples: StrokePoint[] | null;
  shifted: boolean;
}

/** Keep the complete screen contour, including parts that missed the clay. */
export function placeOpening(
  outline: ScreenPoint[],
  hit: (x: number, y: number) => OpeningHit | null,
  units: number,
  adjust = true,
): OpeningPlacement {
  const xs = outline.map(p => p.x), ys = outline.map(p => p.y);
  const left = Math.min(...xs), right = Math.max(...xs);
  const top = Math.min(...ys), bottom = Math.max(...ys);
  const lengths = outline.map((p, i) => {
    const q = outline[(i + 1) % outline.length];
    return Math.hypot(q.x - p.x, q.y - p.y);
  });
  const total = lengths.reduce((a, b) => a + b, 0);
  if (outline.length < 3 || total < 1) return { outline, samples: null, shifted: false };
  // Bound raycasts per frame while checking the closing segment as well.
  const count = Math.max(32, Math.min(320, Math.ceil(total / 2)));
  let edge = 0, distance = 0;
  const contour = Array.from({ length: count + 1 }, (_, i) => {
    const at = total * i / count;
    while (edge < lengths.length - 1 && distance + lengths[edge] < at)
      distance += lengths[edge++];
    const a = outline[edge], b = outline[(edge + 1) % outline.length];
    const t = Math.min(1, (at - distance) / (lengths[edge] || 1));
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  });
  function project(dx: number, dy: number): OpeningPlacement | null {
    const samples: StrokePoint[] = [];
    let previous: OpeningHit | null = null;
    for (const p of contour) {
      const x = p.x + dx, y = p.y + dy, h = hit(x, y);
      if (!h || h.facing < 0.12 || h.uv[1] < 0.008 || h.uv[1] > 0.992) return null;
      let u = h.uv[0];
      const prev = samples.at(-1);
      if (prev && previous) {
        u += Math.round(prev.uv[0] - u);
        const pixels = Math.hypot(x - prev.x, y - prev.y);
        // Judge adjacent hits, not the curvature of the entire drawing. A wide
        // opening can wrap smoothly around the pot without crossing a fold.
        const facing = Math.max(0.12, Math.min(h.facing, previous.facing));
        if (h.normal.dot(previous.normal) < 0.5 ||
            h.point.distanceTo(previous.point) > pixels * units * 1.8 / facing + 0.003) return null;
      }
      samples.push({ x, y, uv: [u, h.uv[1]] });
      previous = h;
    }
    if (Math.abs(samples[0].uv[0] - samples.at(-1)!.uv[0]) > 0.1) return null;
    return {
      outline: outline.map(p => ({ x: p.x + dx, y: p.y + dy })),
      samples,
      shifted: dx !== 0 || dy !== 0,
    };
  }
  const direct = project(0, 0);
  if (direct) return direct;
  if (adjust) {
    const reach = Math.min(4, Math.min(right - left, bottom - top) * 0.12);
    // Only translate a little; never shrink, flatten or silently relocate the drawing.
    for (const radius of [reach / 2, reach])
      for (let i = 0; i < 16; i++) {
        const angle = i * Math.PI / 8;
        const candidate = project(Math.cos(angle) * radius, Math.sin(angle) * radius);
        if (candidate) return candidate;
      }
  }
  return { outline, samples: null, shifted: false };
}
