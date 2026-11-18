import * as T from "three";
import { clamp, smooth } from "./model";

export const SOIL_WIDTH = 3.4,
  SOIL_DEPTH = 3,
  SOIL_FLOOR = -0.235;
const GRID = 112,
  MASK = 256;
export type FindBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  top: number;
};
export function migrateSoilMask(old: Uint8Array) {
  const result = new Uint8Array(MASK * MASK);
  for (let y = 0; y < MASK; y++)
    for (let x = 0; x < MASK; x++) {
      const ox = Math.round(
        (((x / (MASK - 1) - 0.5) * SOIL_WIDTH) / 2.7 + 0.5) * (MASK - 1),
      );
      const oy = Math.round(
        (((y / (MASK - 1) - 0.5) * SOIL_DEPTH) / 1.8 + 0.5) * (MASK - 1),
      );
      if (ox >= 0 && ox < MASK && oy >= 0 && oy < MASK)
        result[y * MASK + x] = old[oy * MASK + ox];
    }
  return result;
}
export class SoilTerrain {
  surfaceLevel=.8;
  mesh: T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>;
  cursor = new T.Mesh(
    new T.RingGeometry(0.135, 0.145, 48),
    new T.MeshBasicMaterial({
      color: 0xffe9ac,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      side: T.DoubleSide,
    }),
  );
  mask: Uint8Array = new Uint8Array(MASK * MASK);
  private bases = new Float32Array((GRID + 1) ** 2);
  private grainShade = new Float32Array((GRID + 1) ** 2);
  private heights = new Float32Array((GRID + 1) ** 2);
  private targets: FindBounds[] = [];
  private targetMap = new Uint8Array(MASK * MASK);
  private targetPixels:number[]=[];
  private removedAmount:number[]=[];
  private activeCells=new Uint8Array(GRID*GRID);
  private minX=0;private minZ=0;private maxX=MASK-1;private maxZ=MASK-1;
  private last: T.Vector3 | null = null;
  private carried = 0;
  dirty = true;
  constructor() {
    const positions: number[] = [],
      indices: number[] = [],
      uv: number[] = [];
    for (let j = 0; j <= GRID; j++)
      for (let i = 0; i <= GRID; i++) {
        positions.push(
          (i / GRID - 0.5) * SOIL_WIDTH,
          SOIL_FLOOR,
          (j / GRID - 0.5) * SOIL_DEPTH,
        );
        const x=(i/GRID-.5)*SOIL_WIDTH,z=(j/GRID-.5)*SOIL_DEPTH;
        this.grainShade[j*(GRID+1)+i]=.98+.025*Math.sin(x*17+z*13)*Math.sin(z*19-x*11);
        uv.push((i / GRID) * 9, (j / GRID) * 8);
        if (
          i < GRID &&
          j < GRID &&
          (((i + 0.5) / GRID) * 2 - 1) ** 2 +
            (((j + 0.5) / GRID) * 2 - 1) ** 2 <
            0.995
        ) {
          this.activeCells[j*GRID+i]=1;
          const a = j * (GRID + 1) + i,
            b = a + 1,
            c = a + GRID + 1;
          indices.push(a, c, b, b, c, c + 1);
        }
      }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    g.setAttribute(
      "color",
      new T.Float32BufferAttribute(new Float32Array(positions.length), 3),
    );
    g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    g.setIndex(indices);
    const pixels = new Uint8Array(128 * 128 * 4);
    let seed = 97;
    for (let i = 0; i < pixels.length; i += 4) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const n = seed >>> 24;
      pixels.set([n, n, n, 255], i);
    }
    const grain = new T.DataTexture(pixels, 128, 128);
    grain.wrapS = grain.wrapT = T.RepeatWrapping;
    grain.magFilter = T.LinearFilter;
    grain.minFilter = T.LinearMipmapLinearFilter;
    grain.generateMipmaps = true;
    grain.needsUpdate = true;
    this.mesh = new T.Mesh(
      g,
      new T.MeshStandardMaterial({
        vertexColors: true,
        roughness: 1,
        metalness: 0,
        bumpMap: grain,
        bumpScale: 0.003,
      }),
    );
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.cursor.visible = false;
    this.cursor.renderOrder = 4;
  }
  setSurface(texture:T.Texture){
    this.mesh.material.map=texture;this.mesh.material.bumpMap=texture;this.mesh.material.bumpScale=.009;
    const uv=this.mesh.geometry.getAttribute('uv');
    for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)/3,uv.getY(i)/3);
    this.mesh.material.needsUpdate=true;
  }
  configure(mask: Uint8Array, targets: FindBounds[]) {
    this.mask = mask;
    this.targets = targets;
    this.targetPixels=targets.map(()=>0);
    this.removedAmount=targets.map(()=>0);
    this.surfaceLevel=Math.max(.6,...targets.map(t=>t.top+.13));
    for (let j = 0; j <= GRID; j++)
      for (let i = 0; i <= GRID; i++) {
        const x = (i / GRID - 0.5) * SOIL_WIDTH,
          z = (j / GRID - 0.5) * SOIL_DEPTH;
        const grain =
          0.007 * Math.sin(x * 11 + z * 9) * Math.sin(z * 13 - x * 7) +
          0.004 * Math.sin(x * 21 - z * 17);
        // Loose soil sits slightly higher around the finds, giving the first
        // brush stroke a visual starting point without uncovering either pot.
        let mound = 0;
        for (const t of targets) {
          const dx = (x - (t.minX + t.maxX) / 2) / ((t.maxX - t.minX) / 2 + .15);
          const dz = (z - (t.minZ + t.maxZ) / 2) / ((t.maxZ - t.minZ) / 2 + .15);
          const falloff = Math.max(0, 1 - dx * dx - dz * dz);
          mound += falloff * falloff;
        }
        this.bases[j * (GRID + 1) + i] = this.surfaceLevel + grain * .18 + mound * (.065 + grain);
      }
    for (let y = 0; y < MASK; y++)
      for (let x = 0; x < MASK; x++) {
        const wx = (x / (MASK - 1) - 0.5) * SOIL_WIDTH,
          wz = (y / (MASK - 1) - 0.5) * SOIL_DEPTH;
        this.targetMap[y * MASK + x] =
          targets.findIndex(
            (t) =>
              ((wx - (t.minX + t.maxX) / 2) / ((t.maxX - t.minX) / 2 + 0.04)) **
                4 +
                ((wz - (t.minZ + t.maxZ) / 2) /
                  ((t.maxZ - t.minZ) / 2 + 0.04)) **
                  4 <
              1,
          ) + 1;
        const k=y*MASK+x,target=this.targetMap[k]-1;
        if(target>=0){this.targetPixels[target]++;this.removedAmount[target]+=mask[k];}
      }
    this.minX=this.minZ=0;this.maxX=this.maxZ=MASK-1;
    this.dirty = true;
    this.update();
  }
  get findBounds(){return this.targets;}
  private removed(x: number, z: number) {
    const px = clamp((x / SOIL_WIDTH + 0.5) * (MASK - 1), 0, MASK - 1),
      py = clamp((z / SOIL_DEPTH + 0.5) * (MASK - 1), 0, MASK - 1);
    const i = Math.min(MASK - 2, Math.floor(px)),
      j = Math.min(MASK - 2, Math.floor(py)),
      a = px - i,
      b = py - j;
    return (
      ((1 - a) * (1 - b) * this.mask[j * MASK + i] +
        a * (1 - b) * this.mask[j * MASK + i + 1] +
        (1 - a) * b * this.mask[(j + 1) * MASK + i] +
        a * b * this.mask[(j + 1) * MASK + i + 1]) /
      255
    );
  }
  update() {
    if (!this.dirty) return;
    const p = this.mesh.geometry.getAttribute("position") as T.BufferAttribute,
      c = this.mesh.geometry.getAttribute("color") as T.BufferAttribute;
    const top = new T.Color("#b6a38c"),
      bottom = new T.Color("#8c7969"),
      color = new T.Color();
    // Only vertices whose two-pixel mask interpolation touches a changed
    // sample can move. Neighbouring faces also contribute to their normals.
    const lower=(v:number)=>Math.max(0,Math.floor((v-1)*GRID/(MASK-1)));
    const upper=(v:number)=>Math.min(GRID,Math.ceil((v+1)*GRID/(MASK-1)));
    const x0=lower(this.minX),x1=upper(this.maxX),z0=lower(this.minZ),z1=upper(this.maxZ);
    const stride=GRID+1,g=this.mesh.geometry;
    for(let j=z0;j<=z1;j++)for(let i=x0;i<=x1;i++){
      const k=j*stride+i;
      const x = p.getX(k),
        z = p.getZ(k),
        dug = this.removed(x, z);
      const height = SOIL_FLOOR + (this.bases[k] - SOIL_FLOOR) * (1 - dug);
      this.heights[k] = height;
      p.setY(k, height);
      color
        .copy(top)
        .lerp(bottom, dug * 0.7)
        .multiplyScalar(this.grainShade[k] + (this.bases[k] - this.surfaceLevel) * (1 - dug) * 2.8);
      c.setXYZ(k, color.r, color.g, color.b);
    }
    const full=x0===0&&x1===GRID&&z0===0&&z1===GRID;
    if(full){
      g.computeVertexNormals();
      g.computeBoundingBox();
      // Brushing can only lower the terrain to its floor.
      const envelope=g.boundingBox!.clone();envelope.min.y=SOIL_FLOOR;
      g.boundingSphere=envelope.getBoundingSphere(new T.Sphere());
    }else{
      this.updateNormals(x0,x1,z0,z1);
      // Keep hit testing and framing exact after a hollow becomes deeper or
      // after brushing away the old high point, including restored masks.
      let low=Infinity,high=-Infinity;
      for(let k=0;k<this.heights.length;k++){
        const h=this.heights[k];if(h<low)low=h;if(h>high)high=h;
      }
      g.boundingBox!.min.y=low;g.boundingBox!.max.y=high;
    }
    for(const attribute of [p,c,g.getAttribute('normal') as T.BufferAttribute]){
      const start=Math.max(0,z0-1)*stride,end=(Math.min(GRID,z1+1)+1)*stride;
      if(full)attribute.clearUpdateRanges();
      attribute.addUpdateRange(start*3,(end-start)*3);attribute.needsUpdate=true;
    }
    this.minX=this.minZ=MASK;this.maxX=this.maxZ=-1;
    this.dirty = false;
  }
  private updateNormals(x0:number,x1:number,z0:number,z1:number){
    const n=this.mesh.geometry.getAttribute('normal') as T.BufferAttribute;
    const h=this.heights,stride=GRID+1,dx=SOIL_WIDTH/GRID,dz=SOIL_DEPTH/GRID;
    for(let j=Math.max(0,z0-1);j<=Math.min(GRID,z1+1);j++)for(let i=Math.max(0,x0-1);i<=Math.min(GRID,x1+1);i++){
      let nx=0,ny=0,nz=0;
      for(let z=Math.max(0,j-1);z<=Math.min(j,GRID-1);z++)for(let x=Math.max(0,i-1);x<=Math.min(i,GRID-1);x++){
        if(!this.activeCells[z*GRID+x])continue;
        const a=z*stride+x,b=a+1,c=a+stride,d=c+1,corner=i-x+j-z;
        if(corner<=1){nx+=(h[a]-h[b])*dz;ny+=dx*dz;nz+=(h[a]-h[c])*dx;}
        if(corner>=1){nx+=(h[c]-h[d])*dz;ny+=dx*dz;nz+=(h[b]-h[d])*dx;}
      }
      const length=Math.hypot(nx,ny,nz)||1;n.setXYZ(j*stride+i,nx/length,ny/length,nz/length);
    }
  }
  heightAt(x: number, z: number) {
    const px = clamp((x / SOIL_WIDTH + 0.5) * GRID, 0, GRID),
      py = clamp((z / SOIL_DEPTH + 0.5) * GRID, 0, GRID);
    const i = Math.min(GRID - 1, Math.floor(px)),
      j = Math.min(GRID - 1, Math.floor(py)),
      a = px - i,
      b = py - j,
      k = j * (GRID + 1) + i;
    // Match the two triangles used by the rendered grid, not a separate plane.
    return a + b <= 1
      ? this.heights[k] * (1 - a - b) +
          this.heights[k + 1] * a +
          this.heights[k + GRID + 1] * b
      : this.heights[k + 1] * (1 - b) +
          this.heights[k + GRID + 1] * (1 - a) +
          this.heights[k + GRID + 2] * (a + b - 1);
  }
  hit(ray: T.Ray) {
    const bounds = this.mesh.geometry.boundingBox!;
    const entry = ray.intersectBox(bounds, new T.Vector3());
    if (!entry) return null;
    const start = ray.origin.distanceTo(entry),
      point = new T.Vector3();
    let previous = start;
    for (let t = start; t < start + 6; t += 0.025) {
      ray.at(t, point);
      if (
        point.x < bounds.min.x - 0.001 ||
        point.x > bounds.max.x + 0.001 ||
        point.z < bounds.min.z - 0.001 ||
        point.z > bounds.max.z + 0.001 ||
        point.y < SOIL_FLOOR - 0.03
      )
        break;
      if (point.y <= this.heightAt(point.x, point.z) + 0.00001) {
        let lo = previous,
          hi = t;
        for (let n = 0; n < 12; n++) {
          const mid = (lo + hi) / 2;
          ray.at(mid, point);
          if (point.y > this.heightAt(point.x, point.z)) lo = mid;
          else hi = mid;
        }
        ray.at((lo + hi) / 2, point);
        // The rendered cells form an ellipse, not the enclosing rectangular box.
        const i=Math.floor((point.x/SOIL_WIDTH+.5)*GRID),
          j=Math.floor((point.z/SOIL_DEPTH+.5)*GRID);
        if((((i+.5)/GRID)*2-1)**2+(((j+.5)/GRID)*2-1)**2>=.995)return null;
        const normal = new T.Vector3(
          this.heightAt(point.x - 0.01, point.z) -
            this.heightAt(point.x + 0.01, point.z),
          0.02,
          this.heightAt(point.x, point.z - 0.01) -
            this.heightAt(point.x, point.z + 0.01),
        ).normalize();
        return { point: point.clone(), normal, distance: (lo + hi) / 2 };
      }
      previous = t;
    }
    return null;
  }
  begin() {
    this.last = null;
    this.carried = 0;
  }
  end() {
    this.last = null;
    this.update();
  }
  dig(point: T.Vector3) {
    const first = !this.last;
    if (first) this.stamp(point.x, point.z, 0.38);
    else {
      const distance = point.distanceTo(this.last!),
        step = 0.047;
      for (let d = step - this.carried; d <= distance; d += step) {
        const p = this.last!.clone().lerp(point, d / distance);
        this.stamp(p.x, p.z, 0.2);
      }
      this.carried = (this.carried + distance) % step;
    }
    this.last = point.clone();
  }
  private stamp(x: number, z: number, strength: number) {
    const radius = 0.145,
      cx = (x / SOIL_WIDTH + 0.5) * (MASK - 1),
      cy = (z / SOIL_DEPTH + 0.5) * (MASK - 1);
    const rx = (radius / SOIL_WIDTH) * (MASK - 1),
      ry = (radius / SOIL_DEPTH) * (MASK - 1);
    for (
      let j = Math.max(0, Math.floor(cy - ry));
      j <= Math.min(MASK - 1, cy + ry);
      j++
    )
      for (
        let i = Math.max(0, Math.floor(cx - rx));
        i <= Math.min(MASK - 1, cx + rx);
        i++
      ) {
        const r = Math.hypot((i - cx) / rx, (j - cy) / ry);
        if (r < 1) {
          const k = j * MASK + i;
          this.removeSoil(k,Math.min(255,this.mask[k]+Math.round(strength*255*(1-smooth(r)))));
        }
      }
  }
  private removeSoil(k:number,value:number){
    const delta=value-this.mask[k];
    if(!delta)return;
    this.mask[k]=value;
    const target=this.targetMap[k]-1;
    if(target>=0)this.removedAmount[target]+=delta;
    const x=k%MASK,z=Math.floor(k/MASK);
    this.minX=Math.min(this.minX,x);this.maxX=Math.max(this.maxX,x);
    this.minZ=Math.min(this.minZ,z);this.maxZ=Math.max(this.maxZ,z);
    this.dirty=true;
  }
  coverage() {
    return this.targetPixels.map((count,i)=>this.removedAmount[i]/(255*Math.max(1,count)));
  }
  assist() {
    let budget = 3500;
    for (let k = 0; k < this.mask.length && budget > 0; k++)
      if (this.targetMap[k] && this.mask[k] < 255) {
        this.removeSoil(k,255);
        budget--;
      }
    this.update();
  }
}
