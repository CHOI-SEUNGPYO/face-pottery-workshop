import { Vector3 } from "three";

export const COLS = 96,
  ROWS = 64,
  COUNT = COLS * (ROWS + 1);
export type SceneId =
  | "welcome"
  | "body"
  | "mouth"
  | "faces"
  | "inspect"
  | "firing"
  | "excavation"
  | "assembly"
  | "compare"
  | "ending";
export const order: SceneId[] = [
  "welcome",
  "body",
  "mouth",
  "faces",
  "inspect",
  "firing",
  "excavation",
  "assembly",
  "compare",
  "ending",
];
export type UV = [number, number];
export interface SurfaceFeature {
  id: string;
  kind: "groove" | "hole" | "raised-hole";
  points: UV[];
  /** Legacy detached clay, retained in saves but removed for display. */
  islands?: UV[][];
  width: number;
}
export const MAX_FEATURES = 256;
export const MAX_CONTOUR_POINTS = 1024;
export interface PotteryDocument {
  schemaVersion: 2;
  topologyId: "shell-96x64-v1";
  revision: string;
  outerXYZ: Float64Array;
  innerXYZ: Float64Array;
  mouth: {
    opened: boolean;
    innerRadius: number;
    neckHeight: number;
    center: [number, number, number];
    rotation: [number, number, number, number];
  };
  features: SurfaceFeature[];
  /** Optional authoring controls. Old XYZ documents remain unchanged on load. */
  form?: SoftForm;
}
export interface SoftForm {
  height: number;
  width: number;
  radii: number[];
}
export interface GameSave {
  schemaVersion: 2;
  document: PotteryDocument;
  stage: SceneId;
  firedRevision: string | null;
  excavationMask: Uint8Array;
  excavationLayout?: "terrain-v1";
  assembledRevision: string | null;
  rotation: number;
}
export const clamp = (v: number, a: number, b: number) =>
  Math.max(a, Math.min(b, v));
export const smooth = (x: number) => {
  x = clamp(x, 0, 1);
  return x * x * (3 - 2 * x);
};
export const uid = () => crypto.randomUUID();
export function radiusAt(v: number) {
  const profile = [
    [0, 0.22],
    [0.08, 0.215],
    [0.3, 0.275],
    [0.58, 0.345],
    [0.73, 0.34],
    [0.84, 0.285],
    [0.93, 0.16],
    [0.97, 0.115],
    [1, 0.115],
  ];
  for (let i = 1; i < profile.length; i++)
    if (v <= profile[i][0]) {
      const [a, r] = profile[i - 1],
        [b, s] = profile[i],
        prev = profile[Math.max(0, i - 2)],
        next = profile[Math.min(profile.length - 1, i + 1)];
      const slope = (x: number, y: number) =>
          x * y > 0 ? (2 * x * y) / (x + y) : 0,
        span = b - a,
        t = (v - a) / span,
        d = (s - r) / span;
      const m0 = i === 1 ? d : slope((r - prev[1]) / (a - prev[0]), d),
        m1 =
          i === profile.length - 1
            ? d
            : slope(d, (next[1] - s) / (next[0] - b));
      return clamp(
        (2 * t ** 3 - 3 * t * t + 1) * r +
          (t ** 3 - 2 * t * t + t) * m0 * span +
          (-2 * t ** 3 + 3 * t * t) * s +
          (t ** 3 - t * t) * m1 * span,
        Math.min(r, s),
        Math.max(r, s),
      );
    }
  return 0.115;
}
export function freshDocument(): PotteryDocument {
  const outerXYZ = new Float64Array(COUNT * 3),
    innerXYZ = new Float64Array(COUNT * 3);
  for (let j = 0; j <= ROWS; j++)
    for (let i = 0; i < COLS; i++) {
      const v = j / ROWS,
        a = (i / COLS) * Math.PI * 2,
        r = radiusAt(v),
        k = (j * COLS + i) * 3;
      outerXYZ.set([r * Math.sin(a), v, r * Math.cos(a)], k);
      // Offset along the actual surface normal. A purely radial offset makes
      // the steep shoulder paper-thin and incorrectly blocks a downward press.
      const lo = Math.max(0, v - 0.0005),
        hi = Math.min(1, v + 0.0005),
        slope = (radiusAt(hi) - radiusAt(lo)) / (hi - lo),
        length = Math.hypot(1, slope),
        innerR = r - 0.04 / length;
      const innerY =
        (0.035 + v * 0.965) * (1 - smooth(v / 0.15)) +
        (v + (0.04 * slope) / length) * smooth(v / 0.15);
      innerXYZ.set([innerR * Math.sin(a), innerY, innerR * Math.cos(a)], k);
    }
  return {
    schemaVersion: 2,
    topologyId: "shell-96x64-v1",
    revision: uid(),
    outerXYZ,
    innerXYZ,
    mouth: {
      opened: false,
      innerRadius: 0.075,
      neckHeight: 0.03,
      center: [0, 1, 0],
      rotation: [0, 0, 0, 1],
    },
    features: [],
  };
}
export function freshSave(): GameSave {
  return {
    schemaVersion: 2,
    document: freshDocument(),
    stage: "body",
    firedRevision: null,
    excavationMask: new Uint8Array(256 * 256),
    excavationLayout: "terrain-v1",
    assembledRevision: null,
    rotation: 0,
  };
}
export function cloneDoc(d: PotteryDocument): PotteryDocument {
  return structuredClone(d);
}
/** Offset the inner wall along the clay surface, including sloping shoulders. */
export function alignedInterior(d: PotteryDocument) {
  const outer = d.outerXYZ,
    inner = new Float64Array(outer.length),
    across = new Vector3(),
    up = new Vector3(),
    normal = new Vector3(),
    other = new Vector3();
  for (let j = 0; j <= ROWS; j++) {
    const v = j / ROWS,
      blend = j === ROWS ? 0 : smooth(v / 0.12);
    for (let i = 0; i < COLS; i++) {
      const k = (j * COLS + i) * 3;
      across
        .fromArray(outer, (j * COLS + ((i + 1) % COLS)) * 3)
        .sub(
          other.fromArray(outer, (j * COLS + ((i + COLS - 1) % COLS)) * 3),
        );
      up
        .fromArray(outer, (Math.min(ROWS, j + 1) * COLS + i) * 3)
        .sub(other.fromArray(outer, (Math.max(0, j - 1) * COLS + i) * 3));
      normal.crossVectors(across, up).normalize();
      const radius = Math.hypot(outer[k], outer[k + 2]) || 1;
      // Keep the raised floor and level mouth edge; the shoulder uses its normal.
      inner[k] =
        outer[k] - 0.035 * (normal.x * blend + (outer[k] / radius) * (1 - blend));
      inner[k + 1] =
        outer[k + 1] - 0.035 * (normal.y * blend - (1 - v) * (1 - blend));
      inner[k + 2] =
        outer[k + 2] -
        0.035 * (normal.z * blend + (outer[k + 2] / radius) * (1 - blend));
    }
  }
  return inner;
}
export function changed(s: GameSave) {
  s.document.revision = uid();
  s.firedRevision = null;
  s.assembledRevision = null;
  s.excavationMask.fill(0);
}
export function surfacePoint(
  doc: PotteryDocument,
  u: number,
  v: number,
  inside = false,
): Vector3 {
  const col = (((u % 1) + 1) % 1) * COLS,
    row = clamp(v, 0, 1) * ROWS;
  const i = Math.floor(col) % COLS,
    j = Math.min(ROWS - 1, Math.floor(row)),
    x = col - Math.floor(col),
    y = row - j;
  const positions = inside ? doc.innerXYZ : doc.outerXYZ;
  const ids = [
    j * COLS + i,
    j * COLS + ((i + 1) % COLS),
    (j + 1) * COLS + i,
    (j + 1) * COLS + ((i + 1) % COLS),
  ];
  const weights =
    x + y <= 1 ? [1 - x - y, x, y, 0] : [0, 1 - y, 1 - x, x + y - 1];
  const p = new Vector3();
  for (let k = 0; k < 4; k++) {
    const index = ids[k] * 3,
      weight = weights[k];
    p.x += positions[index] * weight;
    p.y += positions[index + 1] * weight;
    p.z += positions[index + 2] * weight;
  }
  return p;
}
export function surfaceNormal(d: PotteryDocument, u: number, v: number) {
  return surfacePoint(d, u + 0.0002, v)
    .sub(surfacePoint(d, u - 0.0002, v))
    .cross(surfacePoint(d, u, v + 0.0002).sub(surfacePoint(d, u, v - 0.0002)))
    .normalize();
}
export function setMouth(d: PotteryDocument, radius: number, height: number) {
  radius = clamp(radius, 0.06, 0.13);
  height = clamp(height, 0.02, 0.06);
  const dr = radius - d.mouth.innerRadius,
    dy = height - d.mouth.neckHeight;
  for (let j = 0; j <= ROWS; j++)
    for (let i = 0; i < COLS; i++) {
      const w = smooth((j / ROWS - 0.86) / 0.11),
        a = (i / COLS) * Math.PI * 2,
        k = (j * COLS + i) * 3;
      for (const xyz of [d.outerXYZ, d.innerXYZ]) {
        xyz[k] += Math.sin(a) * dr * w;
        xyz[k + 2] += Math.cos(a) * dr * w;
        xyz[k + 1] += dy * w;
      }
    }
  d.mouth.innerRadius = radius;
  d.mouth.neckHeight = height;
  d.mouth.center[1] += dy;
}
export function insideLoop(u: number, v: number, points: UV[]) {
  let yes = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i],
      b = points[j];
    if (
      a[1] > v !== b[1] > v &&
      u < ((b[0] - a[0]) * (v - a[1])) / (b[1] - a[1]) + a[0]
    )
      yes = !yes;
  }
  return yes;
}
export function isHole(d: PotteryDocument, u: number, v: number) {
  return d.features.some(
    (f) =>
      f.kind !== "groove" &&
      [-1, 0, 1].some(
        (k) =>
          insideLoop(u + k, v, f.points),
      ),
  );
}
export function validateSave(value: unknown): value is GameSave {
  const s = value as GameSave,
    d = s?.document;
  const vector = (v: unknown, n: number) =>
    Array.isArray(v) &&
    v.length === n &&
    v.every(
      (x) => typeof x === "number" && Number.isFinite(x) && Math.abs(x) < 4,
    );
  return !!(
    s?.schemaVersion === 2 &&
    order.includes(s.stage) &&
    d?.schemaVersion === 2 &&
    d.topologyId === "shell-96x64-v1" &&
    typeof d.revision === "string" &&
    d.revision.length > 0 &&
    typeof d.mouth?.opened === "boolean" &&
    vector(d.mouth.center, 3) &&
    vector(d.mouth.rotation, 4) &&
    (s.firedRevision === null || typeof s.firedRevision === "string") &&
    (s.assembledRevision === null || typeof s.assembledRevision === "string") &&
    [d.outerXYZ, d.innerXYZ].every(
      (a) =>
        a instanceof Float64Array &&
        a.length === COUNT * 3 &&
        a.every((n) => Number.isFinite(n) && Math.abs(n) < 4),
    ) &&
    Array.isArray(d.features) &&
    d.features.length <= MAX_FEATURES &&
    d.features.every(
      (f) =>
        f &&
        typeof f.id === "string" &&
        ["groove", "hole", "raised-hole"].includes(f.kind) &&
        Number.isFinite(f.width) &&
        f.width > 0 &&
        f.width < 0.1 &&
        Array.isArray(f.points) &&
        f.points.length >= (f.kind === "groove" ? 2 : 3) &&
        f.points.length <= MAX_CONTOUR_POINTS &&
        f.points.every((p) => vector(p, 2) && p[1] >= 0 && p[1] <= 1) &&
        (f.islands === undefined ||
          (f.kind !== "groove" &&
            Array.isArray(f.islands) &&
            f.islands.length <= 64 &&
            f.islands.every(
              (ring) =>
                Array.isArray(ring) &&
                ring.length >= 3 &&
                ring.length <= MAX_CONTOUR_POINTS &&
                ring.every((p) => vector(p, 2) && p[1] >= 0 && p[1] <= 1),
            ))),
    ) &&
    Number.isFinite(d.mouth?.innerRadius) &&
    d.mouth.innerRadius >= 0.025 &&
    d.mouth.innerRadius <= 0.7 &&
    Number.isFinite(d.mouth.neckHeight) &&
    d.mouth.neckHeight >= 0.02 &&
    d.mouth.neckHeight <= 0.06 &&
    (d.form === undefined ||
      (Number.isFinite(d.form.height) &&
        d.form.height >= 0.65 &&
        d.form.height <= 1.65 &&
        Number.isFinite(d.form.width) &&
        d.form.width >= 0.65 &&
        d.form.width <= 1.4 &&
        Array.isArray(d.form.radii) &&
        d.form.radii.length === 7 &&
        d.form.radii.every(
          (r) => Number.isFinite(r) && r >= 0.1 && r <= 0.5,
        ))) &&
    s.excavationMask instanceof Uint8Array &&
    s.excavationMask.length === 65536 &&
    (s.excavationLayout === undefined || s.excavationLayout === "terrain-v1") &&
    Number.isFinite(s.rotation)
  );
}
export class History {
  undoStack: { doc: PotteryDocument; stage: SceneId }[] = [];
  redoStack: { doc: PotteryDocument; stage: SceneId }[] = [];
  push(doc: PotteryDocument, stage: SceneId) {
    this.undoStack.push({ doc: cloneDoc(doc), stage });
    if (this.undoStack.length > 32) this.undoStack.shift();
    this.redoStack = [];
  }
  undo(doc: PotteryDocument, stage: SceneId) {
    const entry = this.undoStack.pop();
    if (entry) this.redoStack.push({ doc: cloneDoc(doc), stage });
    return entry;
  }
  redo(doc: PotteryDocument, stage: SceneId) {
    const entry = this.redoStack.pop();
    if (entry) this.undoStack.push({ doc: cloneDoc(doc), stage });
    return entry;
  }
}
