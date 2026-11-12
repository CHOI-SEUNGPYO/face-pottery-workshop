import { build } from "esbuild";
import { createRequire } from "node:module";

const { outputFiles } = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
import assert from "node:assert/strict";
import { alignedInterior, COLS, ROWS, surfacePoint, cloneDoc, freshDocument, freshSave, setMouth, validateSave, isHole } from "./game/model.ts";
import { addSurfaceFeature, openingsForDisplay, nearestFeature, crossToolOverlap } from "./game/features.ts";
import { applyForm, createSoftDocument, forms, adjustMouth } from "./game/form.ts";
import { surfaceFrame, sampleSurfacePath } from "./game/surface-path.ts";
import { openingGeometry } from "./game/openings.ts";
import { placeOpening } from "./game/opening-placement.ts";
import { finishStroke, strokeIntent } from "./game/stroke.ts";
import { Vector3 } from "three";

const circle = (x, radius = 10) => Array.from({ length: 41 }, (_, i) => ({
  x: x + Math.cos(i * Math.PI / 20) * radius,
  y: Math.sin(i * Math.PI / 20) * radius,
}));
const plane = (x, y) => ({
  uv: [((x / 500) % 1 + 1) % 1, 0.5 + y / 1000],
  point: new Vector3(x * 0.001, y * 0.001, 0),
  normal: new Vector3(0, 0, 1), facing: 1,
});

// The continuous controls expose the full mouth range, including legacy art.
for (const soft of [false, true]) {
  const source = soft ? createSoftDocument() : freshDocument();
  source.features = [{ id: "existing-eye", kind: "hole", width: 0.006,
    points: [[-0.01, 0.5], [0.01, 0.5], [0.01, 0.53], [-0.01, 0.53]],
  }];
  for (const [radius, height] of [[0, 0], [1, 1], [0.11, 0.04]]) {
    const d = cloneDoc(source);
    (soft ? adjustMouth : setMouth)(d, radius, height);
    assert.ok(validateSave({ ...freshSave(), document: d }), "mouth limits remain saveable");
    assert.deepEqual(d.features, source.features, "mouth editing preserves facial features");
    assert.deepEqual(d.outerXYZ.slice(0, COLS * 3), source.outerXYZ.slice(0, COLS * 3), "base remains fixed");
    if (!soft) {
      assert.equal(d.form, undefined, "legacy art stays in its original representation");
      assert.deepEqual(d.outerXYZ.slice(0, 50 * COLS * 3), source.outerXYZ.slice(0, 50 * COLS * 3));
    }
  }
}
const edge = (x, y) => x <= 11 ? plane(x, y) : null;
const input = circle(2), original = structuredClone(input);
const placed = placeOpening(input, edge, 0.001);
assert.ok(placed.samples && placed.shifted, "slight overlap is translated");
const dx = placed.outline[0].x - input[0].x, dy = placed.outline[0].y - input[0].y;
assert.ok(Math.hypot(dx, dy) <= 2.40001);
placed.outline.forEach((p, i) => {
  assert.ok(Math.abs(p.x - input[i].x - dx) < 1e-9);
  assert.ok(Math.abs(p.y - input[i].y - dy) < 1e-9);
});
assert.deepEqual(input, original, "the user's contour stays intact");
const pending = placeOpening(circle(16), edge, 0.001);
assert.equal(pending.samples, null, "large overlap waits for repositioning");
assert.deepEqual(pending.outline, circle(16));
assert.ok(placeOpening(pending.outline.map(p => ({x:p.x-20,y:p.y})), edge, 0.001).samples);
const seam = placeOpening(circle(0), plane, 0.001);
assert.ok(seam.samples && !seam.shifted, "UV seam is not a physical edge");
assert.ok(Math.max(...seam.samples.map(p => p.uv[0])) - Math.min(...seam.samples.map(p => p.uv[0])) < 0.05);
assert.equal(placeOpening(circle(0), (x,y) => ({ ...plane(x,y),
  normal: new Vector3(x < 0 ? -Math.SQRT1_2 : Math.SQRT1_2, 0, Math.SQRT1_2), facing: 0.707,
}), 0.001, false).samples, null, "a sharp fold is not connected across faces");
assert.equal(placeOpening(circle(0), (x,y) => ({ ...plane(x,y), facing: 0.1 }), 0.001).samples, null);
assert.equal(placeOpening(circle(0), (x,y) => ({ ...plane(x,y),
  point: new Vector3(x * 0.001, y * 0.001, x < 0 ? 0 : 1),
}), 0.001, false).samples, null, "distant ray hits must not be bridged");
const cylinder = (x,y) => {
  const z = Math.sqrt(10000-x*x), normal = new Vector3(x/100,0,z/100);
  return { uv:[Math.asin(x/100)/(Math.PI*2),.5+y/1000],
    point:new Vector3(x*.001,y*.001,z*.001),normal,facing:normal.z };
};
assert.ok(placeOpening(circle(0,98),cylinder,.001,false).samples,
  "large continuous contours may span a wide range of surface normals");
assert.ok(placeOpening(circle(0,60),(x,y)=>Math.hypot(x,y)<1?null:cylinder(x,y),.001,false).samples,
  "a missing bounding-box centre must not veto a continuous contour");

// Closing a cluster drops the detached centre, including any holes in it.
for(const offset of [0,.5]) {
  const d=createSoftDocument();
  const rect=(id,x1,y1,x2,y2)=>({id,kind:"hole",width:.006,
    points:[[x1+offset,y1],[x2+offset,y1],[x2+offset,y2],[x1+offset,y2]]});
  const unrelated={id:"line",kind:"groove",width:.004,points:[[.2,.8],[.23,.82]]};
  d.features=[unrelated];
  for(const f of [rect("left",-.1,.42,-.06,.58),rect("top",-.1,.56,.1,.6),rect("right",.06,.42,.1,.58)])
    assert.equal(addSurfaceFeature(d,f),null);
  assert.equal(isHole(d,offset,.5),false,"clay still connected to the body is retained");
  assert.equal(addSurfaceFeature(d,rect("nested",-.01,.49,.01,.51)),null);
  assert.equal(addSurfaceFeature(d,rect("bottom",-.1,.4,.1,.44)),null);
  assert.equal(d.features.length,2,"swallow nested openings instead of leaving floating tunnel walls");
  assert.equal(d.features[0],unrelated,"unrelated art stays exact");
  assert.equal(d.features.some(f=>f.islands?.length),false);
  assert.equal(isHole(d,offset,.47),true,"disconnected centre falls out");
  assert.equal(isHole(d,offset+.12,.5),false,"surrounding clay remains");
}
const legacy=createSoftDocument();
legacy.features=[{id:"legacy",kind:"hole",width:.006,
  points:[[-.1,.4],[.1,.4],[.1,.6],[-.1,.6]],
  islands:[[[-.03,.48],[.03,.48],[0,.56]]]},
  {id:"nested",kind:"raised-hole",width:.006,
    points:[[-.005,.49],[.005,.49],[.005,.5],[-.005,.5]]}];
const savedLegacy=structuredClone(legacy),display=openingsForDisplay(legacy);
assert.equal(display.features.length,1);
assert.equal(display.features[0].kind,"hole","a swallowed collar must not change the outer rim");
assert.equal(display.features.some(f=>f.islands?.length),false);
assert.equal(isHole(legacy,0,.53),true,"picking agrees with repaired display");
assert.equal(nearestFeature(legacy,[0,.54],.01)?.id,"legacy");
assert.deepEqual(legacy,savedLegacy,"display repair never rewrites saved artwork");
assert.equal(openingsForDisplay(display),display,"normal artwork needs no extra processing");

// Cross-tool cuts respect actual contours, including the UV seam.
{
 const d=createSoftDocument(),f=(kind,x)=>({id:'check',kind,width:.006,points:[[x-.01,.45],[x+.01,.45],[x+.01,.49],[x-.01,.49]]});
 d.features=[f('hole',.99)];
 assert.equal(crossToolOverlap(d,f('raised-hole',-.01)),true);
 assert.equal(crossToolOverlap(d,f('raised-hole',.91)),false);
 assert.equal(crossToolOverlap(d,f('hole',.99)),false);
}
// Same-size click and hand-drawn side holes should have comparable raised rims.
const collarDoc=createSoftDocument();
const ring=jagged=>Array.from({length:48},(_,i)=>{
  const angle=i*Math.PI/24, wobble=jagged && i%9===0 ? .72 : 1;
  return [.022*Math.cos(angle)*wobble,.5+.048*Math.sin(angle)*wobble];
});
function collarLift(points){
  const d={...collarDoc,features:[{id:"collar",kind:"raised-hole",width:.008,points}]};
  const mesh=openingGeometry(d),position=mesh.getAttribute("position");
  const loop=sampleSurfacePath(d,points,true,.0025);
  const lifts=loop.map((uv,i)=>{
    const top=new Vector3().fromBufferAttribute(position,i*8+3);
    return top.sub(surfacePoint(d,...uv)).dot(surfaceFrame(d,...uv).normal);
  });
  assert.ok(position.array.every(Number.isFinite));
  mesh.dispose();
  return {min:Math.min(...lifts),max:Math.max(...lifts)};
}
const clicked=collarLift(ring(false)),drawn=collarLift(ring(true));
assert.ok(drawn.min>clicked.min*.9,
  "one narrow hand-drawn bend must not flatten the whole side-hole rim");
assert.ok(drawn.max<clicked.max*1.1,
  "similar-sized click and drawing should have comparable collar height");

assert.equal(strokeIntent([{x:0,y:0},{x:0.5,y:0.5}]).closed, false, "taps are not drawn contours");
const arc = end => Array.from({length:61},(_,i)=>({x:30*Math.cos(i*end/60),y:30*Math.sin(i*end/60)}));
assert.equal(strokeIntent(arc(Math.PI*1.5)).closed, false, "an unfinished C must not become a hole");
assert.equal(strokeIntent(arc(Math.PI*2-.08)).closed, true, "small closing gaps remain forgiving");
for (const corners of [
  [{x:-22,y:-18},{x:3,y:-25},{x:30,y:-9},{x:12,y:2},{x:24,y:20},{x:-18,y:9}],
  [{x:-8,y:-7},{x:8,y:-7},{x:8,y:7},{x:-8,y:7}],
]) {
  const outline = corners.flatMap((a,i)=>{
    const b=corners[(i+1)%corners.length], count=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y));
    return Array.from({length:count},(_,j)=>({x:a.x+(b.x-a.x)*j/count,y:a.y+(b.y-a.y)*j/count}));
  });
  outline.push({...outline[0]});
  const copy=structuredClone(outline), placement=placeOpening(outline,plane,.001);
  assert.ok(placement.samples);
  const shift=Math.round(placement.samples[0].uv[0]);
  const result=finishStroke(placement.samples,true).map(([u,v])=>({x:(u-shift)*500,y:(v-.5)*1000}));
  for (const p of corners)
    assert.ok(Math.min(...result.map(q=>Math.hypot(q.x-p.x,q.y-p.y)))<1.25,"preserve small corners and deliberate notches");
  const area=ps=>Math.abs(ps.reduce((s,p,i)=>{const q=ps[(i+1)%ps.length];return s+p.x*q.y-q.x*p.y;},0))/2;
  assert.ok(Math.abs(area(result)/area(corners)-1)<.03,"do not shrink or round the user's shape");
  assert.deepEqual(outline,copy);
}

let vertices = 0;
for (const form of [...Object.values(forms), {
  height: 0.65, width: 1.4, radii: [0.2, 0.3, 0.5, 0.5, 0.45, 0.26, 0.1],
}, {
  height: 0.65, width: 1.355, radii: [0.1563, 0.1749, 0.1574, 0.2375, 0.3452, 0.3802, 0.1],
}]) {
  const d = createSoftDocument();
  applyForm(d, form);
  for (let j = 8; j < ROWS; j++) for (const i of [0, 1, 24, 48, 95]) {
    const uv = [i / COLS, j / ROWS];
    const direction = surfacePoint(d, ...uv).sub(surfacePoint(d, ...uv, true));
    assert.ok(Math.abs(direction.length() - 0.035) < 1e-10);
    assert.ok(direction.normalize().dot(surfaceFrame(d, ...uv).normal) > 0.999999);
    vertices++;
  }
  assert.equal(d.innerXYZ[1], 0.035);
  assert.equal(d.innerXYZ[ROWS * COLS * 3 + 1], d.form.height);

  // Reproduce a saved radial interior, then fix only its render document.
  for (let j = 0; j <= ROWS; j++) for (let i = 0; i < COLS; i++) {
    const k = (j * COLS + i) * 3;
    const r = Math.hypot(d.outerXYZ[k], d.outerXYZ[k + 2]);
    d.innerXYZ[k] = d.outerXYZ[k] * (1 - 0.035 / r);
    d.innerXYZ[k + 1] = 0.035 + j / ROWS * (d.form.height - 0.035);
    d.innerXYZ[k + 2] = d.outerXYZ[k + 2] * (1 - 0.035 / r);
  }
  d.features = [{ id: "seam-hole", kind: "raised-hole", width: 0.01,
    points: [[-0.02, 0.79], [0.02, 0.79], [0.02, 0.84], [-0.02, 0.84]],
  }];
  const saved = structuredClone(d);
  const render = { ...d, innerXYZ: alignedInterior(d) };
  const walls = openingGeometry(render);
  assert.ok(walls.getAttribute("position").array.every(Number.isFinite));
  assert.ok(walls.getAttribute("normal").array.every(Number.isFinite));
  const positions = walls.getAttribute("position");
  const loop = sampleSurfacePath(render, d.features[0].points, true, 0.0025);
  // A raised collar stores eight vertices per sample; its first pair spans the wall.
  for (let i = 0; i < positions.count; i += 8) {
    const distance = Math.hypot(
      positions.getX(i + 1) - positions.getX(i),
      positions.getY(i + 1) - positions.getY(i),
      positions.getZ(i + 1) - positions.getZ(i),
    );
    // Interpolating normals shortens the offset slightly at a sharply curved shoulder.
    assert.ok(distance > 0.03 && distance < 0.036, "wall thickness " + distance);
    const uv = loop[i / 8];
    const through = surfacePoint(render, ...uv).sub(surfacePoint(render, ...uv, true));
    const alignment = through.normalize().dot(surfaceFrame(render, ...uv).normal);
    assert.ok(alignment > 0.97, "tunnel direction " + alignment);
  }
  walls.dispose();
  assert.deepEqual(d, saved);
}
console.log("PASS: large curved openings, detached clay removal, preserved legacy art, mouth limits, light contour correction, folds, UV seams and " + vertices + " wall directions.");
`,
  },
  bundle: true,
  platform: "node",
  format: "cjs",
  write: false,
});
new Function("require", outputFiles[0].text)(createRequire(import.meta.url));
