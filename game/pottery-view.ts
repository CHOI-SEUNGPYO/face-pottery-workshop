import { openingGeometry } from "./openings";
import { openingsForDisplay } from "./features";
import * as T from "three";
import { MeshBVH, acceleratedRaycast } from "three-mesh-bvh";
import {
  COLS,
  ROWS,
  clamp,
  surfacePoint,
  alignedInterior,
  type PotteryDocument,
  type UV,
} from "./model";
import { grooveRibbon } from "./surface-path";
const canvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};
function geometry(inner: boolean) {
  // Duplicate only the UV seam for rendering. Saved topology stays unchanged.
  const g = new T.BufferGeometry(),
    n = (COLS + 1) * (ROWS + 1),
    uv = new Float32Array(n * 2),
    indices: number[] = [];
  for (let j = 0; j <= ROWS; j++)
    for (let i = 0; i <= COLS; i++) {
      uv.set([i / COLS, j / ROWS], (j * (COLS + 1) + i) * 2);
      if (j < ROWS && i < COLS) {
        const a = j * (COLS + 1) + i,
          b = a + 1,
          c = a + COLS + 1,
          d = c + 1;
        if (inner) indices.push(a, c, b, b, c, d);
        else indices.push(a, b, c, b, d, c);
      }
    }
  g.setAttribute("position", new T.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute("uv", new T.BufferAttribute(uv, 2));
  g.setIndex(indices);
  return g;
}
// A tiny repeatable texture replaces 24 procedural sine hashes per fragment.
// The source images and the editable clay geometry are unchanged.
const grainPixels = new Uint8Array(128 * 128 * 4);
let grainSeed = 731;
for (let i = 0; i < grainPixels.length; i += 4) {
  grainSeed = (Math.imul(grainSeed, 1664525) + 1013904223) >>> 0;
  const value = grainSeed >>> 24;
  grainPixels.set([value, value, value, 255], i);
}
const grainTexture = new T.DataTexture(grainPixels, 128, 128);
grainTexture.wrapS = grainTexture.wrapT = T.RepeatWrapping;
grainTexture.magFilter = T.LinearFilter;
grainTexture.minFilter = T.LinearMipmapLinearFilter;
grainTexture.generateMipmaps = true;
grainTexture.needsUpdate = true;
function grain(m: T.MeshStandardMaterial) {
  m.onBeforeCompile = (s) => {
    s.uniforms.clayGrain = { value: grainTexture };
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 clayP;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nclayP=position;",
      );
    s.fragmentShader = s.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 clayP;
uniform sampler2D clayGrain;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
float claySample=texture2D(clayGrain,clayP.xy*2.0+clayP.z*.37).r;
vec2 stampUV=vec2(atan(clayP.x,clayP.z)*14.3,clayP.y*48.0);
stampUV.x+=mod(floor(stampUV.y),2.0)*.5;
vec2 cell=fract(stampUV)-.5;
float stamp=1.0-smoothstep(.22,.49,length(cell*vec2(1.35,.88)));
diffuseColor.rgb*=.955+.06*claySample-.035*stamp;`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        "#include <normal_fragment_maps>\nfloat h=claySample*.0003+stamp*.0013; normal=perturbNormalArb(-vViewPosition,normal,vec2(dFdx(h),dFdy(h)),faceDirection);",
      );
  };
  m.customProgramCacheKey = () => "togi-shell-stamped-clay-v4";
}
export class PotteryView {
  root = new T.Group();
  body: T.Mesh;
  inner: T.Mesh;
  walls: T.Mesh;
  cap: T.Mesh;
  floor: T.Mesh;
  rim: T.Mesh;
  mask = canvas(2048, 1024);
  bump = canvas(2048, 1024);
  ink = canvas(2048, 1024);
  maskTexture = new T.CanvasTexture(this.mask);
  bumpTexture = new T.CanvasTexture(this.bump);
  inkTexture = new T.CanvasTexture(this.ink);
  material = new T.MeshStandardMaterial({
    color: 0xb87950,
    roughness: 0.58,
    metalness: 0,
    map: this.inkTexture,
    alphaMap: this.maskTexture,
    alphaTest: 0.5,
    bumpMap: this.bumpTexture,
    bumpScale: 0.0035,
  });
  plain = new T.MeshStandardMaterial({
    color: 0xb87950,
    roughness: 0.58,
    metalness: 0,
    side: T.DoubleSide,
    bumpMap: this.bumpTexture,
    bumpScale: 0,
  });
  interior = this.material.clone();
  tunnel = this.plain.clone();
  private shapeCache = "";
  constructor() {
    this.inkTexture.wrapS = T.RepeatWrapping;
    this.inkTexture.colorSpace = T.SRGBColorSpace;
    // A carved line darkens only the outside of the wall.
    this.interior.map = null;
    this.maskTexture.wrapS = T.RepeatWrapping;
    this.maskTexture.colorSpace = T.NoColorSpace;
    this.bumpTexture.wrapS = T.RepeatWrapping;
    grain(this.material);
    grain(this.plain);
    grain(this.interior);
    grain(this.tunnel);
    this.body = new T.Mesh(geometry(false), this.material);
    this.body.raycast = acceleratedRaycast;
    this.inner = new T.Mesh(geometry(true), this.interior);
    this.walls = new T.Mesh(new T.BufferGeometry(), [this.tunnel, this.plain]);
    this.rim = new T.Mesh(new T.BufferGeometry(), this.plain);
    this.cap = new T.Mesh(new T.BufferGeometry(), this.plain);
    this.floor = new T.Mesh(new T.BufferGeometry(), this.plain);
    for (const m of [
      this.body,
      this.inner,
      this.walls,
      this.cap,
      this.floor,
      this.rim,
    ]) {
      m.castShadow = true;
      m.receiveShadow = true;
      this.root.add(m);
    }
    const depth = new T.MeshDepthMaterial({
      depthPacking: T.RGBADepthPacking,
      alphaMap: this.maskTexture,
      alphaTest: 0.5,
    });
    this.body.customDepthMaterial = depth;
    this.inner.customDepthMaterial = depth;
  }
  update(d: PotteryDocument, features = true) {
    d = openingsForDisplay(d);
    // Correct older radial interiors for display without rewriting saved artwork.
    if (d.form) d = { ...d, innerXYZ: alignedInterior(d) };
    for (const [mesh, xyz] of [
      [this.body, d.outerXYZ],
      [this.inner, d.innerXYZ],
    ] as const) {
      const p = mesh.geometry.getAttribute("position") as T.BufferAttribute;
      for (let j = 0; j <= ROWS; j++)
        for (let i = 0; i <= COLS; i++) {
          const k = (j * COLS + (i % COLS)) * 3;
          p.setXYZ(j * (COLS + 1) + i, xyz[k], xyz[k + 1], xyz[k + 2]);
        }
      p.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
      // Average duplicated seam normals to avoid a lighting stripe.
      const normals = mesh.geometry.getAttribute("normal") as T.BufferAttribute;
      for (let j = 0; j <= ROWS; j++) {
        const a = j * (COLS + 1),
          b = a + COLS,
          n = new T.Vector3()
            .fromBufferAttribute(normals, a)
            .add(new T.Vector3().fromBufferAttribute(normals, b))
            .normalize();
        normals.setXYZ(a, n.x, n.y, n.z);
        normals.setXYZ(b, n.x, n.y, n.z);
      }
      normals.needsUpdate = true;
      mesh.geometry.computeBoundingSphere();
      mesh.geometry.computeBoundingBox();
      if (mesh === this.body) {
        if (mesh.geometry.boundsTree) mesh.geometry.boundsTree.refit();
        else mesh.geometry.boundsTree = new MeshBVH(mesh.geometry);
      }
    }
    const rim: number[] = [],
      caps: number[] = [],
      floor: number[] = [];
    const tri = (array: number[], a: T.Vector3, b: T.Vector3, c: T.Vector3) =>
      array.push(...a.toArray(), ...b.toArray(), ...c.toArray());
    for (let i = 0; i < COLS; i++) {
      const u = i / COLS,
        v = (i + 1) / COLS,
        o = surfacePoint(d, u, 1),
        p = surfacePoint(d, v, 1),
        a = surfacePoint(d, u, 1, true),
        b = surfacePoint(d, v, 1, true);
      tri(rim, o, p, a);
      tri(rim, p, b, a);
      tri(caps, new T.Vector3(...d.mouth.center), a, b);
      const bo = surfacePoint(d, u, 0),
        bp = surfacePoint(d, v, 0),
        bi = surfacePoint(d, u, 0, true),
        bj = surfacePoint(d, v, 0, true);
      tri(floor, new T.Vector3(0, 0, 0), bp, bo);
      tri(floor, new T.Vector3(0, 0.035, 0), bi, bj);
      tri(floor, bo, bp, bi);
      tri(floor, bp, bj, bi);
    }
    this.walls.geometry.dispose();
    this.walls.geometry = openingGeometry(d);
    for (const [m, a] of [
      [this.rim, rim],
      [this.cap, caps],
      [this.floor, floor],
    ] as const) {
      m.geometry.dispose();
      m.geometry = new T.BufferGeometry();
      m.geometry.setAttribute("position", new T.Float32BufferAttribute(a, 3));
      m.geometry.computeVertexNormals();
    }
    this.cap.visible = !d.mouth.opened;
    if (features) this.paint(d);
  }
  paint(d: PotteryDocument) {
    const key = JSON.stringify([d.features, d.form, d.revision]);
    if (key === this.shapeCache) return;
    this.shapeCache = key;
    const mask = this.mask.getContext("2d")!,
      bump = this.bump.getContext("2d")!;
    mask.fillStyle = "white";
    mask.fillRect(0, 0, 2048, 1024);
    bump.fillStyle = "#808080";
    bump.fillRect(0, 0, 2048, 1024);
    const ink = this.ink.getContext("2d")!;
    ink.fillStyle = "white";
    ink.fillRect(0, 0, 2048, 1024);
    const height =
      this.body.geometry.boundingBox!.max.y -
      this.body.geometry.boundingBox!.min.y;
    const path = (c: CanvasRenderingContext2D, ring: UV[], shift: number) => {
      ring.forEach(([u, v], i) =>
        i
          ? c.lineTo((u + shift) * 2048, (1 - v) * 1024)
          : c.moveTo((u + shift) * 2048, (1 - v) * 1024),
      );
      c.closePath();
    };
    for (const f of d.features) {
      if (f.kind === "groove") {
        const width = clamp(f.width * height, 0.0018, 0.0055);
        const edge = grooveRibbon(d, f.points, width * 0.7);
        const core = grooveRibbon(d, f.points, width * 0.5);
        for (const shift of [-1, 0, 1]) {
          ink.beginPath();
          path(ink, edge, shift);
          ink.fillStyle = "#e4d8cc";
          ink.fill();
          ink.beginPath();
          path(ink, core, shift);
          ink.fillStyle = "#c5ad97";
          ink.fill();
          bump.beginPath();
          path(bump, core, shift);
          bump.fillStyle = "#747474";
          bump.fill();
        }
        continue;
      }
      for (const shift of [-1, 0, 1]) {
        const c = mask;
        c.beginPath();
        for (const ring of [f.points, ...(f.islands ?? [])]) {
          path(c, ring, shift);
        }
        c.fillStyle = "black";
        c.fill("evenodd");
      }
    }
    this.maskTexture.needsUpdate = true;
    this.bumpTexture.needsUpdate = true;
    this.inkTexture.needsUpdate = true;
  }
  appearance(amount: number) {
    const wet = new T.Color("#b87950"),
      dry = new T.Color("#c19871"),
      fired = new T.Color("#766052");
    const c =
      amount < 0.45
        ? wet.lerp(dry, amount / 0.45)
        : dry.lerp(fired, (amount - 0.45) / 0.55);
    this.material.color.copy(c);
    this.plain.color.copy(c);
    this.interior.color.copy(c).multiplyScalar(0.3);
    this.tunnel.color.copy(c).multiplyScalar(0.55);
    this.tunnel.roughness = 0.95;
    this.interior.roughness = 0.94;
    this.material.roughness = this.plain.roughness =
      0.54 + Math.min(1, amount) * 0.3;
  }
  dispose() {
    for (const m of [
      this.body,
      this.inner,
      this.walls,
      this.cap,
      this.floor,
      this.rim,
    ])
      m.geometry.dispose();
    this.material.dispose();
    this.interior.dispose();
    this.tunnel.dispose();
    this.plain.dispose();
    this.maskTexture.dispose();
    this.bumpTexture.dispose();
    this.inkTexture.dispose();
    this.body.customDepthMaterial?.dispose();
  }
}
