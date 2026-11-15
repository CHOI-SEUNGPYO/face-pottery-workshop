import clipping, { type Polygon, type MultiPolygon } from "polygon-clipping";
import {surfaceFrame,surfaceOffset} from './surface-path';
import {
  insideLoop,
  surfacePoint,
  uid,
  MAX_FEATURES,
  MAX_CONTOUR_POINTS,
  type PotteryDocument,
  type SurfaceFeature,
  type UV,
} from "./model";

export type FeatureIssue = "boundary" | "too-small" | "complex";
/** Cross-tool overlap is checked in the same unwrapped coordinates as the cut.
 * Same-tool unions and legacy render repair keep their existing behaviour. */
export function crossToolOverlap(d:PotteryDocument,feature:SurfaceFeature){
  try{
  const u=centerU(feature.points);
  for(const old of d.features){
    if((old.kind==='raised-hole')===(feature.kind==='raised-hole'))continue;
    if(old.kind==='groove'||feature.kind==='groove'){
      const line=old.kind==='groove'?old:feature,hole=old.kind==='groove'?feature:old;
      const shift=Math.round(centerU(hole.points)-centerU(line.points));
      const points=line.points.map(([x,y])=>[x+shift,y] as UV);
      if(points.some(([x,y])=>insideLoop(x,y,hole.points)))return true;
      // A narrow swept polygon catches a short line crossing a hole between samples.
      for(let i=1;i<points.length;i++){
        const a=points[i-1],b=points[i],w=Math.max(line.width*.5,.0002),length=Math.hypot(b[0]-a[0],b[1]-a[1])||1;
        const x=-(b[1]-a[1])/length*w,y=(b[0]-a[0])/length*w;
        const strip:Polygon=[[[a[0]-x,a[1]-y],[b[0]-x,b[1]-y],[b[0]+x,b[1]+y],[a[0]+x,a[1]+y]]];
        if(area(clipping.intersection(polygon(hole),strip))>1e-10)return true;
      }
    }else if(area(clipping.intersection(footprint(d,feature),footprint(d,old,Math.round(u-centerU(old.points)))))>1e-10)return true;
  }
  return false;
  }catch{return true;}
}
function footprint(d:PotteryDocument,f:SurfaceFeature,shift=0):Polygon{
  const positions=f.points.map(p=>surfacePoint(d,...p)),n=positions.length;
  const perimeter=positions.reduce((sum,p,i)=>sum+p.distanceTo(positions[(i+1)%n]),0);
  const lip=Math.max(.007,Math.min(.021,perimeter/(2*Math.PI)*.38));
  const sign=Math.sign(f.points.reduce((sum,p,i)=>{const q=f.points[(i+1)%n];return sum+p[0]*q[1]-q[0]*p[1];},0))||1;
  return [f.points.map((p,i)=>{
    const outward=positions[(i+1)%n].clone().sub(positions[(i+n-1)%n]).normalize().cross(surfaceFrame(d,...p).normal).multiplyScalar(sign);
    const uv=surfaceOffset(d,p,outward,lip*(f.kind==='raised-hole'?2.1:1.25));return [uv[0]+shift,uv[1]];
  })];
}
export const loopArea = (points: UV[]) =>
  Math.abs(
    points.reduce((sum, p, i) => {
      const q = points[(i + 1) % points.length];
      return sum + p[0] * q[1] - q[0] * p[1];
    }, 0),
  ) / 2;
const centerU = (points: UV[]) =>
  points.reduce((sum, p) => sum + p[0], 0) / points.length;
const polygon = (f: SurfaceFeature, shift = 0): Polygon =>
  [f.points.map(([u, v]) => [u + shift, v])];
// Interior rings are detached clay, so they fall out with the cut. Fill them
// after every union so openings inside those scraps join the same cut too.
const withoutIslands = (polys: MultiPolygon): MultiPolygon =>
  polys.map((p) => [p[0]]);
const area = (polys: MultiPolygon) =>
  polys.reduce(
    (sum, poly) =>
      sum +
      loopArea(poly[0]) -
      poly.slice(1).reduce((s, r) => s + loopArea(r), 0),
    0,
  );

/** Resolve drawn crossings and join only the openings actually touched.
 * The original document is untouched on failure, and unrelated art stays exact.
 */
export function addSurfaceFeature(
  d: PotteryDocument,
  feature: SurfaceFeature,
): FeatureIssue | null {
  if (feature.kind === "groove") {
    if (d.features.length >= MAX_FEATURES) return "complex";
    d.features.push(feature);
    return null;
  }
  try {
    const u = centerU(feature.points);
    const raw = clipping.union(polygon(feature));
    // Keep a thin strip of clay at the real top and bottom, rather than rejecting
    // a whole drawing because one wobbly point strayed beyond the editable area.
    let joined = clipping.intersection(raw, [
      [
        [u - 1, 0.008],
        [u + 1, 0.008],
        [u + 1, 0.992],
        [u - 1, 0.992],
      ],
    ]);
    if (!joined.length) return raw.length ? "boundary" : "too-small";
    const largest = Math.max(...joined.map((p) => loopArea(p[0])));
    // Tiny closing overshoots are not intentional extra holes. Keep both large
    // lobes of a figure-eight, but let disconnected scraps fall out.
    joined = withoutIslands(joined.filter(
      (p) => loopArea(p[0]) >= Math.max(1e-8, largest * 0.015),
    ));
    if (!joined.length) return "too-small";
    const removed = new Set<SurfaceFeature>();
    let kind = feature.kind;
    // Joining one opening may connect to another. Restart until the cluster is complete.
    let merged = true;
    while (merged) {
      merged = false;
      for (const old of d.features) {
        if (old.kind === "groove" || removed.has(old)) continue;
        const shifted = polygon(old, Math.round(u - centerU(old.points)));
        const overlap = area(clipping.intersection(joined, shifted));
        if (overlap < 1e-10) continue;
        // A swallowed collar has no exposed edge. Preserve the surrounding
        // opening's kind instead of raising its entire rim.
        if (area(joined) - overlap < 1e-10) kind = old.kind;
        else if (loopArea(shifted[0]) - overlap > 1e-10 && old.kind === "raised-hole")
          kind = "raised-hole";
        joined = withoutIslands(clipping.union(joined, shifted));
        removed.add(old);
        merged = true;
      }
    }
    const result: SurfaceFeature[] = joined.map((p, i) => ({
      id: i ? uid() : feature.id,
      kind,
      points: p[0].slice(0, -1),
      width: feature.width,
    }));
    if (
      d.features.length - removed.size + result.length > MAX_FEATURES ||
      result.some((f) => f.points.length > MAX_CONTOUR_POINTS)
    )
      return "complex";
    d.features = [...d.features.filter((f) => !removed.has(f)), ...result];
    return null;
  } catch {
    // A numerical failure must not erase previous work or save invalid geometry.
    return "complex";
  }
}

/** Repair legacy floating scraps for rendering without rewriting saved art. */
export function openingsForDisplay(d: PotteryDocument): PotteryDocument {
  if (!d.features.some((f) => f.islands?.length)) return d;
  const display = { ...d, features: [] as SurfaceFeature[] };
  for (const f of d.features)
    if (addSurfaceFeature(display, f)) return d;
  return display;
}

/** Select by actual surface distance; hole centres and UV seam both work. */
export function nearestFeature(d: PotteryDocument, uv: UV, reach: number) {
  const p = surfacePoint(d, ...uv);
  let nearest: SurfaceFeature | undefined,
    best = reach;
  for (const f of [...d.features].reverse()) {
    const shift = Math.round(centerU(f.points) - uv[0]);
    if (
      f.kind !== "groove" &&
      insideLoop(uv[0] + shift, uv[1], f.points)
    )
      return f;
    const ring = f.points;
    for (let i = 0; i < ring.length - (f.kind === "groove" ? 1 : 0); i++) {
      const a = surfacePoint(d, ...ring[i]);
      const ab = surfacePoint(d, ...ring[(i + 1) % ring.length]).sub(a);
      const t = Math.max(
        0,
        Math.min(1, p.clone().sub(a).dot(ab) / (ab.lengthSq() || 1)),
      );
      const distance = p.distanceTo(a.addScaledVector(ab, t));
      if (distance < best) {
        best = distance;
        nearest = f;
      }
    }
  }
  return nearest;
}

/** Explicit refinement only; never run while drawing or loading artwork. */
function smoothRing(d: PotteryDocument, points: UV[], closed: boolean): UV[] {
  if (closed) {
    // A brief backtrack can leave a needle-shaped notch. Fairing densely sampled
    // points alone preserves that fold for too long. Remove only tight reversals
    // whose two edges are small relative to the whole contour.
    for (let pass = 0; pass < 2; pass++) {
      const world = points.map((p) => surfacePoint(d, ...p));
      const perimeter = world.reduce(
        (sum, p, i) => sum + p.distanceTo(world[(i + 1) % world.length]),
        0,
      );
      points = points.map((p, i) => {
        const ia = (i + points.length - 1) % points.length,
          ib = (i + 1) % points.length;
        const a = world[i].clone().sub(world[ia]),
          b = world[ib].clone().sub(world[i]);
        const reversal = a.dot(b) / Math.max(1e-12, a.length() * b.length());
        if (
          reversal > -0.35 ||
          Math.max(a.length(), b.length()) > perimeter * 0.08
        )
          return p;
        return [
          (points[ia][0] + points[ib][0]) / 2,
          (points[ia][1] + points[ib][1]) / 2,
        ];
      });
    }
  }
  const lengths = points.map((p, i) =>
    i === points.length - 1 && !closed
      ? 0
      : surfacePoint(d, ...p).distanceTo(
          surfacePoint(d, ...points[(i + 1) % points.length]),
        ),
  );
  const perimeter = lengths.reduce((sum, l) => sum + l, 0);
  if (perimeter < 1e-5) return points.map((p) => [...p]);
  const count = Math.max(24, Math.min(256, Math.ceil(perimeter / 0.0025)));
  let at = 0,
    edge = 0;
  let sampled: UV[] = Array.from({ length: count }, (_, i) => {
    const distance = (perimeter * i) / (closed ? count : count - 1);
    while (edge < lengths.length - 1 && at + lengths[edge] < distance)
      at += lengths[edge++];
    const t = Math.min(1, (distance - at) / (lengths[edge] || 1));
    const a = points[edge],
      b = points[(edge + 1) % points.length];
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  });
  // A short, local fairing pass softens small spikes without turning a mouth
  // into a circle. Repeated clicks deliberately increase the effect.
  for (let pass = 0; pass < 6; pass++) {
    const prev = sampled;
    sampled = prev.map((p, i) => {
      if (!closed && (i === 0 || i === prev.length - 1)) return p;
      const a = prev[(i + prev.length - 1) % prev.length],
        b = prev[(i + 1) % prev.length];
      return [
        p[0] * 0.5 + (a[0] + b[0]) * 0.25,
        p[1] * 0.5 + (a[1] + b[1]) * 0.25,
      ];
    });
  }
  return sampled;
}
export function refineFeature(
  d: PotteryDocument,
  feature: SurfaceFeature,
): FeatureIssue | null {
  const refined = {
    ...feature,
    points: smoothRing(d, feature.points, feature.kind !== "groove"),
    ...(feature.islands
      ? { islands: feature.islands.map((r) => smoothRing(d, r, true)) }
      : {}),
  };
  const draft = { ...d, features: d.features.filter((f) => f !== feature) };
  const issue = addSurfaceFeature(draft, refined);
  if (!issue) d.features = draft.features;
  return issue;
}
