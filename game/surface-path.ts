import { Vector3 } from "three";
import {
  COLS,
  ROWS,
  clamp,
  surfacePoint,
  type PotteryDocument,
  type UV,
} from "./model";

/** Continuous surface frame, unlike the normal of one body triangle. */
export function surfaceFrame(d: PotteryDocument, u: number, v: number) {
  const du = surfacePoint(d, u + 1 / COLS, v)
    .sub(surfacePoint(d, u - 1 / COLS, v))
    .multiplyScalar(COLS / 2);
  const lo = Math.max(0, v - 1 / ROWS),
    hi = Math.min(1, v + 1 / ROWS);
  const dv = surfacePoint(d, u, hi)
    .sub(surfacePoint(d, u, lo))
    .multiplyScalar(1 / (hi - lo));
  const normal = du.clone().cross(dv).normalize();
  return { du, dv, normal };
}

export function surfaceOffset(
  d: PotteryDocument,
  uv: UV,
  direction: Vector3,
  distance: number,
): UV {
  const { du, dv } = surfaceFrame(d, ...uv);
  const a = du.lengthSq(),
    b = du.dot(dv),
    c = dv.lengthSq(),
    det = a * c - b * b;
  if (det < 1e-12) return [...uv];
  const x = direction.dot(du) * distance,
    y = direction.dot(dv) * distance;
  return [
    uv[0] + (x * c - y * b) / det,
    clamp(uv[1] + (y * a - x * b) / det, 0, 1),
  ];
}

/** Uniform surface spacing, independent of pointer speed and UV distortion. */
export function sampleSurfacePath(
  d: PotteryDocument,
  points: UV[],
  closed: boolean,
  spacing = 0.003,
) {
  if (points.length < 2) return points.map((p) => [...p] as UV);
  const lengths = points.map((p, i) =>
    !closed && i === points.length - 1
      ? 0
      : surfacePoint(d, ...p).distanceTo(
          surfacePoint(d, ...points[(i + 1) % points.length]),
        ),
  );
  const total = lengths.reduce((a, b) => a + b, 0);
  if (total < 1e-7) return [points[0]];
  const count = Math.max(
    closed ? 48 : 2,
    Math.min(768, Math.ceil(total / spacing) + (closed ? 0 : 1)),
  );
  let edge = 0,
    at = 0;
  return Array.from({ length: count }, (_, i): UV => {
    const distance = (total * i) / (closed ? count : count - 1);
    while (edge < lengths.length - 1 && at + lengths[edge] < distance)
      at += lengths[edge++];
    const t = Math.min(1, (distance - at) / (lengths[edge] || 1));
    const a = points[edge],
      b = points[(edge + 1) % points.length];
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  });
}

/** A thin strip in physical surface units, not a stretched UV-space brush. */
export function grooveRibbon(
  d: PotteryDocument,
  points: UV[],
  halfWidth: number,
) {
  const samples = sampleSurfacePath(d, points, false, 0.002);
  const left: UV[] = [],
    right: UV[] = [];
  for (let i = 0; i < samples.length; i++) {
    const uv = samples[i];
    const a = surfacePoint(d, ...samples[Math.max(0, i - 1)]);
    const b = surfacePoint(d, ...samples[Math.min(samples.length - 1, i + 1)]);
    const outward = b
      .sub(a)
      .cross(surfaceFrame(d, ...uv).normal)
      .normalize();
    left.push(surfaceOffset(d, uv, outward, halfWidth));
    right.push(surfaceOffset(d, uv, outward, -halfWidth));
  }
  return [...left, ...right.reverse()];
}
