import type { UV } from "./model";

export interface StrokePoint {
  x: number;
  y: number;
  uv: UV;
}
export function strokeIntent(
  points: Pick<StrokePoint, "x" | "y">[],
) {
  const first = points[0],
    last = points.at(-1)!;
  let length = 0,
    distance = 0,
    minX = first.x,
    maxX = first.x,
    minY = first.y,
    maxY = first.y;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    distance = Math.max(distance, Math.hypot(p.x - first.x, p.y - first.y));
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
    if (i) length += Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y);
  }
  const shortSide = Math.min(maxX - minX, maxY - minY);
  const gap = Math.hypot(last.x - first.x, last.y - first.y);
  return {
    tap: distance < 2.5 && length < 6,
    closed:
      points.length >= 6 &&
      shortSide >= 3 &&
      length >= 10 &&
      // Close a small lift-off gap, not an unfinished arc or mouth.
      gap <= Math.max(2.5, Math.min(5, shortSide * 0.12)),
  };
}

/** Screen-space tolerance keeps tiny artwork precise at any zoom level. */
export function finishStroke(points: StrokePoint[], closed = false): UV[] {
  if (points.length < 2) return points.map((p) => [...p.uv]);
  // Lift-off often retraces the first few pixels of a loop. Trim that little
  // tail before closing, instead of rejecting the entire eye as self-crossing.
  if (closed && points.length > 8) {
    let closest = points.length - 1,
      distance = Infinity;
    for (let i = Math.floor(points.length * 0.8); i < points.length; i++) {
      const d = Math.hypot(
        points[i].x - points[0].x,
        points[i].y - points[0].y,
      );
      if (d < distance) {
        distance = d;
        closest = i;
      }
    }
    const tail = points.slice(closest + 1).reduce((length, p, i) => {
      const prev = points[closest + i];
      return length + Math.hypot(p.x - prev.x, p.y - prev.y);
    }, 0);
    if (distance < 2 && tail <= 3) points = points.slice(0, closest + 1);
  }
  const smooth = points.map((p, i) => {
    if (i === 0 || i === points.length - 1) return p;
    const a = points[i - 1],
      b = points[i + 1];
    const la = Math.hypot(p.x - a.x, p.y - a.y),
      lb = Math.hypot(b.x - p.x, b.y - p.y);
    const straight =
      ((p.x - a.x) * (b.x - p.x) + (p.y - a.y) * (b.y - p.y)) /
      Math.max(1e-8, la * lb);
    // Soften subpixel zigzags too; an abrupt turn over a couple of pixels is
    // hand jitter. Deliberate larger corners and endpoints stay in place.
    if (la > 3 || lb > 3) return p;
    // New holes get only subpixel cleanup. Stronger fairing is an explicit
    // refine-tool action, never part of drawing or committing a hole.
    const blend = closed ? 0.08 : straight < 0.7 ? 0.2 : 0.1;
    return {
      x: p.x * (1 - blend * 2) + (a.x + b.x) * blend,
      y: p.y * (1 - blend * 2) + (a.y + b.y) * blend,
      uv: [
        p.uv[0] * (1 - blend * 2) + (a.uv[0] + b.uv[0]) * blend,
        p.uv[1] * (1 - blend * 2) + (a.uv[1] + b.uv[1]) * blend,
      ] as UV,
    };
  });
  const simplify = (tolerance: number) => {
    const keep = new Set([0, smooth.length - 1]),
      stack = [[0, smooth.length - 1]];
    while (stack.length) {
      const [a, b] = stack.pop()!,
        p = smooth[a],
        q = smooth[b];
      const dx = q.x - p.x,
        dy = q.y - p.y,
        len = dx * dx + dy * dy;
      let furthest = -1,
        max = tolerance * tolerance;
      for (let i = a + 1; i < b; i++) {
        const c = smooth[i],
          t = Math.max(
            0,
            Math.min(1, ((c.x - p.x) * dx + (c.y - p.y) * dy) / (len || 1)),
          );
        const d = (c.x - p.x - dx * t) ** 2 + (c.y - p.y - dy * t) ** 2;
        if (d > max) {
          max = d;
          furthest = i;
        }
      }
      if (furthest >= 0) {
        keep.add(furthest);
        stack.push([a, furthest], [furthest, b]);
      }
    }
    return [...keep].sort((a, b) => a - b).map((i) => smooth[i].uv);
  };
  let tolerance = 0.22,
    result = simplify(tolerance);
  while (result.length > 512) {
    tolerance *= 1.5;
    result = simplify(tolerance);
  }
  if (
    closed &&
    result.length > 3 &&
    Math.hypot(smooth.at(-1)!.x - smooth[0].x, smooth.at(-1)!.y - smooth[0].y) <
      0.5
  )
    result.pop();
  return result;
}
