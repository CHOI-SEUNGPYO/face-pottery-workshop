import * as T from 'three';
import {SOIL_DEPTH, SOIL_FLOOR, SOIL_WIDTH, type FindBounds} from './soil';

type Outline = T.Vector2[]; // world x, z
type Section = {depth: number; scale: number; color: number};
const tau = Math.PI * 2;

function footprint(box: T.Box3): FindBounds {
  return {minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z, top: box.max.y};
}

export function findMeshBounds(root: T.Object3D) {
  const bounds = new T.Box3(), point = new T.Vector3();
  root.updateWorldMatrix(true, true);
  // Hidden drawing guides have screen-space line geometry, unrelated to the clay.
  root.traverseVisible(mesh => {
    if (!(mesh instanceof T.Mesh)) return;
    const vertices = mesh.geometry.getAttribute('position');
    if (!vertices) return;
    for (let i = 0; i < vertices.count; i++) {
      bounds.expandByPoint(point.fromBufferAttribute(vertices, i).applyMatrix4(mesh.matrixWorld));
    }
  });
  return bounds;
}

export function arrangeBuriedFinds(pot: T.Object3D, siru: T.Object3D, migrating: boolean) {
  const finds = [pot, siru];
  pot.rotation.x = siru.rotation.x = -Math.PI / 2;
  pot.position.set(-.58, 0, .47);
  siru.position.set(.62, 0, .30);
  const bounds = finds.map(findMeshBounds);
  const gap = .18;
  // Leave room for the sloping walls and for a brush around each find.
  const rx = SOIL_WIDTH * .41, rz = SOIL_DEPTH * .41;
  const fits = bounds[0].max.x + gap <= bounds[1].min.x && bounds.every(b =>
    Math.hypot(Math.max(-b.min.x, b.max.x) / rx, Math.max(-b.min.z, b.max.z) / rz) <= 1);
  let previous: FindBounds[] | undefined;
  if (!fits) {
    // Old saves used these unscaled positions and box-based discovery targets.
    if (migrating) previous = finds.map(find => footprint(new T.Box3().setFromObject(find)));
    const sizes = bounds.map(b => b.getSize(new T.Vector3()));
    const width = sizes[0].x + sizes[1].x, depth = Math.max(sizes[0].z, sizes[1].z);
    const scale = Math.min(1, (1 - gap / (2 * rx)) / Math.hypot(width / (2 * rx), depth / (2 * rz)));
    let left = -(width * scale + gap) / 2;
    for (const [i, find] of finds.entries()) {
      const b = bounds[i];
      find.position.x = left + (find.position.x - b.min.x) * scale;
      find.position.z = (find.position.z - (b.min.z + b.max.z) / 2) * scale;
      find.scale.multiplyScalar(scale);
      left += sizes[i].x * scale + gap;
      bounds[i] = findMeshBounds(find);
    }
  }
  const targets = bounds.map((b, i) => {
    const lift = SOIL_FLOOR + .005 - b.min.y;
    finds[i].position.y += lift;
    return {...footprint(b), top: b.max.y + lift};
  });
  return {targets, previous};
}

function oval(x: number, z: number, rx: number, rz: number, seed: number, count: number): Outline {
  return Array.from({length: count}, (_, i) => {
    const a = tau * i / count;
    const irregularity = 1 + .022 * Math.sin(3*a+seed) + .018 * Math.cos(7*a-seed);
    return new T.Vector2(x + rx*Math.cos(a)*irregularity, z + rz*Math.sin(a)*irregularity);
  });
}

// Build the cut profiles and the undisturbed ground from the same outlines.
// This keeps their edges joined even when seen at a shallow angle.
export function excavationField(loam: T.Texture) {
  const group = new T.Group();
  const border = oval(0,0,7.94,7.94,1,112);
  const planePath = (points: Outline) => points.map(p => new T.Vector2(p.x,-p.y));
  const field = new T.Shape(planePath(border));
  const profiles = new T.MeshStandardMaterial({map:loam, vertexColors:true, side:T.DoubleSide, roughness:1});
  let positions: number[] = [], colors: number[] = [], uv: number[] = [], indices: number[] = [];

  function cut(outline: Outline, sections: Section[], bottom: boolean) {
    field.holes.push(new T.Path(planePath(outline)));
    const center = outline.reduce((sum,p) => sum.add(p), new T.Vector2()).divideScalar(outline.length);
    const start = positions.length / 3, count = outline.length;
    const tint = new T.Color();
    for (const [row,section] of sections.entries()) {
      for (const [i,p] of outline.entries()) {
        const x = center.x + (p.x-center.x)*section.scale, z = center.y + (p.y-center.y)*section.scale;
        const y = -section.depth * (1 + .045*Math.sin(i*tau/count*3 + center.x));
        positions.push(x,y,z);
        uv.push(x*.84 + y*.46, z*.84 + y*.83);
        tint.setHex(section.color).multiplyScalar(.97 + .035*Math.sin(i*2.71 + row*.32));
        colors.push(tint.r,tint.g,tint.b);
        if (row > 0) {
          const k = start + row*count+i, n = start + row*count+(i+1)%count;
          indices.push(k-count,n-count,k, n-count,n,k);
        }
      }
    }
    if (bottom) {
      const last = start+(sections.length-1)*count;
      for (const tri of T.ShapeUtils.triangulateShape(outline,[])) indices.push(...tri.map(i=>last+i));
    }
  }
  function finishCuts(name: string) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const result = new T.Mesh(geometry,profiles);
    result.name=name; result.receiveShadow=true; group.add(result);
    positions=[]; colors=[]; uv=[]; indices=[];
    return result;
  }

  cut(oval(0,0,SOIL_WIDTH*.48,SOIL_DEPTH*.48,2.1,96), [
    {depth:0,scale:1,color:0xd6cec3}, {depth:.065,scale:.985,color:0xc6af92},
    {depth:.16,scale:.96,color:0xaa987e}, {depth:.32,scale:.95,color:0xb3a58c},
    {depth:.48,scale:.94,color:0x9c9287}, {depth:1.07,scale:.91,color:0x82776b},
  ],false);
  const pitWall=finishCuts('Section around the artifact pit');

  // Dark post settings and a longer drainage cut recall the traces visible
  // in the site photographs. Their layout is illustrative.
  const postGroups=[[-3.9,-2.72],[-2.6,-3.13],[-1.32,-3.49],[-.01,-3.85],
    [-3.43,-1.44],[-2.16,-1.85],[-.9,-2.2],[.42,-2.53],[2.25,-1.14],[2.83,-2.47],[3.45,-3.72]];
  for (const [i,[x,z]] of postGroups.entries()) {
    const size=.13+.045*(1+Math.sin(i*2.1));
    cut(oval(x,z,size,size*(.88+.12*Math.cos(i)),i,16),[
      {depth:0,scale:1,color:0xd0bda0},{depth:.035,scale:.84,color:0xa89a88},
      {depth:.055+.055*(i%3),scale:.70,color:0x7e7369}],true);
  }
  // A narrow sample trench retains a flat section for reading the deposits.
  const step=[[-4.85,-.98],[-3.26,-.83],[-3.12,-.28],[-4.76,-.41]];
  cut(step.map(([x,z])=>new T.Vector2(x,z)),[
    {depth:0,scale:1,color:0xe1d1b7},{depth:.095,scale:.985,color:0xbfaf9a},
    {depth:.11,scale:.80,color:0xb5a99b},{depth:.24,scale:.77,color:0x9b8f80}],true);
  const channel=[[1.15,-5.45],[2.4,-4.78],[3.68,-4.11],[4.73,-3.35],[5.54,-2.51],
    [5.63,-2.65],[4.88,-3.54],[3.82,-4.34],[2.51,-5.03],[1.25,-5.60]];
  cut(channel.map(([x,z])=>new T.Vector2(x,z)),[
    {depth:0,scale:1,color:0xd5c1a0},{depth:.14,scale:.99,color:0xa38b70}],true);
  finishCuts('Recorded post settings and drainage cut');

  const topGeometry=new T.ShapeGeometry(field);
  const direction=topGeometry.attributes.position, topUV=topGeometry.attributes.uv;
  for(let i=0;i<direction.count;i++)topUV.setXY(i,direction.getX(i)*.84,-direction.getY(i)*.84);
  const surface=new T.Mesh(topGeometry,new T.MeshStandardMaterial({map:loam,bumpMap:loam,bumpScale:.004,color:0xd6cec3,roughness:1}));
  surface.name='Cleaned survey surface'; surface.rotation.x=-Math.PI/2; surface.receiveShadow=true;
  group.add(surface);
  return {group,pitWall};
}
