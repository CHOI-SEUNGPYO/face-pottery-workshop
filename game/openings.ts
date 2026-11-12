import * as T from "three";
import { clamp, smooth, surfacePoint, type PotteryDocument } from "./model";
import { sampleSurfacePath, surfaceFrame, surfaceOffset } from "./surface-path";

/** Rounded hollow collars follow a continuous surface, not individual facets. */
export function openingGeometry(d: PotteryDocument) {
  const positions: number[] = [],
    inside: number[] = [],
    outside: number[] = [];
  for (const f of d.features.filter((f) => f.kind !== "groove")) {
    for (const [ringIndex, contour] of [
      f.points,
      ...(f.islands ?? []),
    ].entries()) {
      const loop = sampleSurfacePath(d, contour, true, 0.0025);
      const n = loop.length;
      if (n < 3) continue;
      const outer = loop.map((p) => surfacePoint(d, ...p));
      const normals = loop.map((p) => surfaceFrame(d, ...p).normal);
      const perimeter = outer.reduce(
        (sum, p, i) => sum + p.distanceTo(outer[(i + 1) % n]),
        0,
      );
      const radius = perimeter / (2 * Math.PI);
      const sign =
        (ringIndex ? -1 : 1) *
        (Math.sign(
          loop.reduce((sum, p, i) => {
            const q = loop[(i + 1) % n];
            return sum + p[0] * q[1] - q[0] * p[1];
          }, 0),
        ) || 1);
      const lip = clamp(radius * 0.38, 0.007, 0.021);
      const widths = Array<number>(n).fill(lip);
      // A tight bend needs less room locally; it must not flatten the whole rim.
      for (let i = 0; i < n; i++) {
        const a = outer[i].clone().sub(outer[(i + n - 2) % n]);
        const b = outer[(i + 2) % n].clone().sub(outer[i]);
        const cross = a.clone().cross(b);
        if (cross.dot(normals[i]) * sign >= -1e-8) continue;
        const bendRadius =
          (a.length() * b.length() * a.clone().add(b).length()) /
          Math.max(1e-9, 2 * cross.length());
        widths[i] = Math.min(lip, Math.max(0.004, bendRadius * 0.3));
      }
      // Blend narrow spots into their neighbours without changing the drawn edge.
      for (let pass = 0; pass < 2; pass++) {
        const previous = widths.slice();
        for (let i = 0; i < n; i++)
          widths[i] = Math.min(lip, previous[i] * 0.6 +
            (previous[(i + n - 1) % n] + previous[(i + 1) % n]) * 0.2);
      }
      const height = Math.min(clamp(radius * 1.5, 0.028, 0.085), lip * 5);
      const profile =
        f.kind === "raised-hole"
          ? [
              [0, 0],
              [0, 0.8],
              [0.22, 1],
              [0.65, 1.05],
              [1.15, 0.88],
              [1.65, 0.45],
              [2.1, 0],
            ]
          : [[0, 0]];
      const start = positions.length / 3,
        rings = profile.length + 1;
      const tangentSpan = Math.min(Math.floor(n / 8),
        Math.max(2, Math.round(0.012 * n / perimeter)));
      for (let i = 0; i < n; i++) {
        const uv = loop[i],
          p = outer[i];
        // Sample a wider neighbourhood so one hand-drawn kink cannot turn the
        // collar outwards and fold its mesh over itself.
        const tangent = outer[(i + tangentSpan) % n]
          .clone()
          .sub(outer[(i + n - tangentSpan) % n])
          .normalize();
        const outward = tangent
          .cross(normals[i])
          .multiplyScalar(sign)
          .normalize();
        const foot = surfaceOffset(d, uv, outward, 2.1 * widths[i]);
        let margin = 1;
        if (foot[1] > 0.997)
          margin = clamp((0.997 - uv[1]) / (foot[1] - uv[1]), 0, 1);
        if (foot[1] < 0.003)
          margin = clamp((0.003 - uv[1]) / (foot[1] - uv[1]), 0, 1);
        const edgeDistance = Math.min(
          p.distanceTo(surfacePoint(d, uv[0], 0)),
          p.distanceTo(surfacePoint(d, uv[0], 1)),
        );
        const liftScale = smooth(edgeDistance / 0.035) * (0.35 + 0.65 * margin);
        positions.push(...surfacePoint(d, ...uv, true).toArray());
        for (const [offset, lift] of profile) {
          const u = uv[0] + (((foot[0] - uv[0]) * offset) / 2.1) * margin;
          const v = uv[1] + (((foot[1] - uv[1]) * offset) / 2.1) * margin;
          const q = surfacePoint(d, u, v).addScaledVector(
            surfaceFrame(d, u, v).normal,
            lift * height * liftScale + (offset ? 0.0004 : 0),
          );
          positions.push(...q.toArray());
        }
      }
      for (let i = 0; i < n; i++)
        for (let j = 0; j < rings - 1; j++) {
          const a = start + i * rings + j,
            b = start + ((i + 1) % n) * rings + j;
          const indices =
            j < (f.kind === "raised-hole" ? 2 : 1) ? inside : outside;
          indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  g.setIndex([...inside, ...outside]);
  if (inside.length) g.addGroup(0, inside.length, 0);
  if (outside.length) g.addGroup(inside.length, outside.length, 1);
  g.computeVertexNormals();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}
