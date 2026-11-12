import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { asset, characterImage } from "./assets";
import { PotteryView } from "./pottery-view";
import { StrokePreview } from "./stroke-preview";
import { SoilTerrain, migrateSoilMask } from "./soil";
import { scenes } from "./content";
import { surfaceFrame } from "./surface-path";
import { FiringView, firingFrame } from './firing';
import {museum,museumAsset} from './museum';
import {
  clamp,
  isHole,
  surfacePoint,
  surfaceNormal,
  type GameSave,
  type SceneId,
  type UV,
} from "./model";

export type ViewPreset =
  "stage" | "front" | "angle" | "side" | "top" | "custom";
const stageYaw: Record<SceneId, number> = {
  welcome: -18,
  body: -14,
  mouth: 18,
  faces: 0,
  inspect: -26,
  firing: 12,
  excavation: 0,
  assembly: 22,
  compare: -12,
  ending: -16,
};

// The furniture never animates. One mesh per material avoids submitting every
// leaf, plank and vase separately, without changing their shapes or materials.
function batchStatic(root: T.Group) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert();
  const batches = new Map<
    string,
    { material: T.Material; geometries: T.BufferGeometry[] }
  >();
  const originals = new Set<T.BufferGeometry>();
  root.traverse((o) => {
    if (!(o instanceof T.Mesh) || Array.isArray(o.material)) return;
    const g = o.geometry
      .clone()
      .applyMatrix4(inverse.clone().multiply(o.matrixWorld));
    const flat = g.index ? g.toNonIndexed() : g;
    if (flat !== g) g.dispose();
    const key = o.material.uuid + Object.keys(flat.attributes).sort().join(",");
    if (!batches.has(key))
      batches.set(key, { material: o.material, geometries: [] });
    batches.get(key)!.geometries.push(flat);
    originals.add(o.geometry);
  });
  root.clear();
  for (const { material, geometries } of batches.values()) {
    const merged = mergeGeometries(geometries)!;
    merged.computeBoundingSphere();
    root.add(new T.Mesh(merged, material));
    geometries.forEach((g) => g.dispose());
  }
  originals.forEach((g) => g.dispose());
}

export class World {
  renderer: T.WebGLRenderer;
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(35, 1, 0.02, 35);
  pottery = new PotteryView();
  workshop = new T.Group();
  private firingView=new FiringView();
  private firingProgress:number|null=null;
  private displayPots=new T.Group();
  private exhibits=new T.Group();
  onExhibit?:(stage:SceneId)=>void;
  excavation = new T.Group();
  siru = new T.Group();
  stand = new T.Group();
  ray = new T.Raycaster();
  stage: SceneId = "welcome";
  paused = false;
  reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  viewPreset: ViewPreset = "stage";
  private elevation = 15;
  private azimuth = 0;
  private zoom = 1;
  private photoFraming = false;
  private key = new T.DirectionalLight(0xffe0ac, 3.2);
  private target = new T.Vector3(0, 0.48, 0);
  private goalPos = new T.Vector3();
  private goalTarget = new T.Vector3();
  private transition = 0;
  private observer: ResizeObserver;
  private frame = 0;
  private sprites = new Map<string, T.Sprite>();
  private stroke = new StrokePreview();
  private dirty = true;
  private reactionUntil = 0;
  terrain = new SoilTerrain();
  soil = this.terrain.mesh;
  earth = new T.Mesh(
    new T.PlaneGeometry(40, 40),
    new T.MeshStandardMaterial({ color: 0x95734b, roughness: 1 }),
  );
  private brushScreen: [number, number] | null = null;
  mask: Uint8Array = new Uint8Array(65536);
  constructor(
    private host: HTMLElement,
    private getSave: () => GameSave,
  ) {
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.toneMappingExposure = 0.92;
    this.renderer.domElement.setAttribute(
      "aria-label",
      "손으로 만드는 3차원 얼굴토기",
    );
    this.renderer.domElement.tabIndex = 0;
    host.append(this.renderer.domElement);
    this.scene.background = new T.Color("#ead4a9");
    this.scene.fog = new T.Fog("#ead4a9", 6, 16);
    this.scene.add(new T.HemisphereLight(0xfff2d5, 0x947058, 2));
    this.key.position.set(-3, 5, 2);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024, 1024);
    this.key.shadow.camera.left = -3;
    this.key.shadow.camera.right = 3;
    this.key.shadow.camera.top = 3;
    this.key.shadow.camera.bottom = -3;
    this.key.shadow.bias = -0.00025;
    this.key.shadow.normalBias = 0.018;
    this.scene.add(this.key);
    const fill = new T.DirectionalLight(0xc6e1ed, 0.7);
    fill.position.set(3, 2, -2);
    this.scene.add(fill);
    const pmrem = new T.PMREMGenerator(this.renderer),
      room = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(room, 0.05).texture;
    room.dispose();
    pmrem.dispose();
    this.scene.add(
      this.pottery.root,
      this.workshop,
      this.excavation,
      this.siru,
      this.stand,
      this.firingView.group,
      this.displayPots,
      this.exhibits,
    );
    this.excavation.position.y = 0.45;
    this.stroke.renderOrder = 9;
    this.pottery.root.add(this.stroke);
    this.earth.rotation.x = -Math.PI / 2;
    this.earth.position.y = -0.24;
    this.earth.receiveShadow = true;
    this.earth.visible = false;
    this.scene.add(this.soil, this.terrain.cursor, this.earth);
    this.soil.visible = false;
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) this.refresh();
    });
    this.renderer.domElement.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.paused = true;
      host.dispatchEvent(new CustomEvent("render-lost", { bubbles: true }));
    });
    this.renderer.domElement.addEventListener("webglcontextrestored", () => {
      this.paused = false;
      this.update();
      host.dispatchEvent(new CustomEvent("render-restored", { bubbles: true }));
    });
    this.animate();
  }
  async load() {
    const loader = new GLTFLoader();
    await Promise.all(
      (
        [
          ["workshop", this.workshop],
          ["excavation", this.excavation],
          ["siru", this.siru],
          ["display-stand", this.stand],
        ] as const
      ).map(async ([name, group]) => {
        const gltf = await loader.loadAsync(asset("models/" + name + ".glb"));
        if(name==='workshop'){
          gltf.scene.updateMatrixWorld(true);
          const pots:T.Object3D[]=[];
          gltf.scene.traverse(o=>{if(o.name.startsWith('Shelf_pottery')||o.name.startsWith('Shelf pottery'))pots.push(o);});
          for(const pot of pots)this.displayPots.attach(pot);
        }
        batchStatic(gltf.scene);
        group.add(gltf.scene);
        group.traverse((o) => {
          if (o instanceof T.Mesh) {
            o.castShadow = true;
            o.receiveShadow = true;
            if (
              name === "excavation" &&
              !Array.isArray(o.material) &&
              o.material.name === "Warm earth"
            )
              o.visible = false;
          }
        });
      }),
    );
    for(const entry of museum.exhibits){
      try{
        const gltf=await loader.loadAsync(museumAsset(entry.file));
        const box=new T.Box3().setFromObject(gltf.scene),size=box.getSize(new T.Vector3());
        if(size.y<.001||!Number.isFinite(size.y))throw Error('Invalid exhibit bounds');
        const holder=new T.Group();
        gltf.scene.position.sub(new T.Vector3((box.min.x+box.max.x)/2,box.min.y,(box.min.z+box.max.z)/2));
        holder.add(gltf.scene);holder.scale.setScalar(entry.height/size.y);
        holder.position.set(...entry.position);holder.rotation.y=T.MathUtils.degToRad(entry.rotation);
        holder.userData.storyStage=entry.stage;holder.name=entry.name;this.exhibits.add(holder);
      }catch{console.warn('전시 모델을 불러오지 못했어요:',entry.name);}
    }
    this.displayPots.visible=museum.exhibits.length===0;
    this.renderer.domElement.addEventListener('click',event=>{
      if(this.paused||this.firingProgress!==null)return;
      this.scene.updateMatrixWorld(true);
      const hits=this.pointer(event.clientX,event.clientY).intersectObjects([this.pottery.body,...this.exhibits.children],true);
      let object:T.Object3D|undefined=hits[0]?.object;
      while(object&&object.parent!==this.exhibits)object=object.parent??undefined;
      if(object?.userData.storyStage)this.onExhibit?.(object.userData.storyStage as SceneId);
    });
    await Promise.all(
      ["압이", "소월이", "독이", "경산이"].map(async (name) => {
        const texture = await new T.TextureLoader().loadAsync(
          characterImage(name),
        );
        texture.colorSpace = T.SRGBColorSpace;
        const sprite = new T.Sprite(
          new T.SpriteMaterial({
            map: texture,
            transparent: true,
            toneMapped: false,
            depthWrite: false,
          }),
        );
        sprite.scale.set(0.43, 0.47, 1);
        sprite.center.set(0.5, 0);
        this.sprites.set(name, sprite);
        this.scene.add(sprite);
      }),
    );
    this.update();
    this.setStage("welcome", true);
    this.resize();
  }
  refresh(shadows = false) {
    this.dirty = true;
    if (shadows) this.renderer.shadowMap.needsUpdate = true;
    if (!this.frame) this.frame = requestAnimationFrame(this.animate);
  }
  onRender?: () => void;
  update(features = true) {
    this.pottery.update(this.getSave().document, features);
    this.pottery.appearance(
      this.getSave().firedRevision === this.getSave().document.revision ? 1 : 0,
    );
    this.pottery.root.rotation.y = this.getSave().rotation;
    this.refresh(true);
  }
  get transitioning() {
    return this.transition > performance.now();
  }
  resize() {
    const w = this.host.clientWidth,
      h = this.host.clientHeight;
    // Cap fill rate on high-DPI displays; the exported photo keeps full resolution.
    this.renderer.setPixelRatio(
      Math.min(devicePixelRatio, 1.5, Math.sqrt(1800000 / Math.max(1, w * h))),
    );
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.compose(true);
    this.refresh();
  }
  setStage(stage: SceneId, instant = false) {
    this.setFiringProgress(null);
    this.stage = stage;
    this.viewPreset = "stage";
    this.elevation = scenes[stage].elevation;
    this.azimuth = stageYaw[stage];
    this.zoom = 1;
    this.terrain.cursor.visible = false;
    const s = this.getSave();
    this.workshop.visible = stage !== "excavation";
    this.exhibits.visible=stage!=='excavation';
    this.displayPots.visible=stage!=='excavation'&&this.exhibits.children.length===0;
    this.excavation.visible = stage === "excavation";
    this.earth.visible = stage === "excavation";
    this.soil.visible = stage === "excavation";
    this.siru.visible = ["excavation", "assembly"].includes(stage);
    this.stand.visible = ["welcome", "inspect", "compare", "ending"].includes(
      stage,
    );
    this.pottery.root.position.set(
      stage === "compare"
        ? -0.34
        : stage === "assembly"
          ? s.assembledRevision === s.document.revision
            ? 0
            : -0.6
          : stage === "excavation"
            ? -0.58
            : stage === "welcome"
              ? 0.35
              : 0,
      stage === "excavation"
        ? -0.43
        : stage === "assembly"
          ? s.assembledRevision === s.document.revision
            ? 0.61
            : 0
          : 0,
      0,
    );
    this.pottery.root.rotation.x = stage === "excavation" ? -Math.PI / 2 : 0;
    if (stage === "excavation")
      this.pottery.root.position.set(-0.58, 0.13, 0.47);
    this.siru.position.set(
      stage === "excavation" ? 0.62 : 0,
      stage === "excavation" ? -0.18 : 0,
      0,
    );
    this.siru.scale.setScalar(1);
    this.stand.position.copy(this.pottery.root.position);
    this.mask = s.excavationMask;
    this.siru.rotation.x = stage === "excavation" ? -Math.PI / 2 : 0;
    if (stage === "excavation") this.siru.position.set(0.62, 0.1, 0.3);
    for (const [name, sprite] of this.sprites) {
      sprite.material.depthTest = stage !== "excavation";
      sprite.visible = stage === "ending" || stage === "welcome";
      const size = stage === "welcome" ? 0.3 : 0.34;
      const im = sprite.material.map!.image;
      sprite.scale.set((size * im.width) / im.height, size, 1);
      const idx = ["압이", "독이", "소월이", "경산이"].indexOf(name);
      sprite.position.set(
        stage === "ending" ? -1.04 + idx * 0.69 : -0.85,
        0,
        stage === "ending" ? 0.25 : 0.3,
      );
      if (stage === "welcome") sprite.position.set(-0.04 + idx * 0.31, 0, 0.55);
      if (stage === "excavation") sprite.position.set(-1.04, 0.61, 0.75);
    }
    this.key.intensity = stage === "firing" ? 2.4 : 3.2;
    this.update();
    if (stage === "excavation") {
      if (!s.excavationLayout) {
        s.excavationMask = migrateSoilMask(s.excavationMask);
        s.excavationLayout = "terrain-v1";
      }
      this.mask = s.excavationMask;
      this.scene.updateMatrixWorld(true);
      const targets = [this.pottery.root, this.siru].map((object) => {
        const b = new T.Box3().setFromObject(object);
        return {
          minX: b.min.x,
          maxX: b.max.x,
          minZ: b.min.z,
          maxZ: b.max.z,
          top: b.max.y,
        };
      });
      this.terrain.configure(this.mask, targets);
    }
    this.compose(instant);
  }
  reframe() {
    this.compose(!this.transitioning);
    this.refresh();
  }
  setView(view: ViewPreset) {
    this.viewPreset = view;
    const angles = {
      front: [0, 10],
      angle: [35, 28],
      side: [72, 15],
      top: [0, 76],
    };
    const a = angles[view as keyof typeof angles] ?? [
      stageYaw[this.stage],
      scenes[this.stage].elevation,
    ];
    this.azimuth = a[0];
    this.elevation = a[1];
    this.zoom = 1;
    this.compose();
    this.refresh();
  }
  tilt(delta: number) {
    this.elevation = clamp(this.elevation + delta, 3, 78);
    this.viewPreset = "custom";
    this.compose(true);
    this.refresh();
  }
  zoomBy(factor: number) {
    this.zoom = clamp(this.zoom * factor, 0.8, 1.3);
    this.compose(true);
    this.refresh();
  }
  private compose(instant = false) {
    const width = this.photoFraming ? 1920 : this.host.clientWidth,
      height = this.photoFraming ? 1080 : this.host.clientHeight;
    this.camera.aspect = width / height;
    const area = document
      .querySelector<HTMLElement>(".work-area")
      ?.getBoundingClientRect();
    const rect = this.photoFraming
      ? {
          x: width * 0.06,
          y: height * 0.08,
          width: width * 0.88,
          height: height * 0.84,
        }
      : area && area.width > 0
        ? area
        : {
            x: width * 0.2,
            y: height * 0.18,
            width: width * 0.7,
            height: height * 0.6,
          };
    this.scene.updateMatrixWorld(true);
    // Drawing a raised rim must not reframe the pot and shift the contour
    // away from the pointer. Photos still include the complete artwork.
    const bounds = new T.Box3().setFromObject(
      this.stage === "faces" && !this.photoFraming ? this.pottery.body : this.pottery.root,
    );
    // Keep the scale visible while shaping. Refitting after every edit hides
    // the player's size changes and moves the target away from their finger.
    if (this.stage === "body" && !this.photoFraming)
      bounds.set(
        new T.Vector3(-0.55, 0, -0.55),
        new T.Vector3(0.55, 1.55, 0.55),
      );
    if (this.siru.visible) bounds.expandByObject(this.siru);
    if (this.soil.visible) bounds.expandByObject(this.soil);
    if (["welcome", "ending"].includes(this.stage))
      for (const sprite of this.sprites.values()) {
        bounds.expandByPoint(
          sprite.position
            .clone()
            .add(new T.Vector3(-sprite.scale.x / 2, 0, -0.1)),
        );
        bounds.expandByPoint(
          sprite.position
            .clone()
            .add(new T.Vector3(sprite.scale.x / 2, sprite.scale.y, 0.1)),
        );
      }
    bounds.getCenter(this.goalTarget);
    const pitch = T.MathUtils.degToRad(this.elevation),
      yaw = T.MathUtils.degToRad(this.azimuth);
    const away = new T.Vector3(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      Math.cos(yaw) * Math.cos(pitch),
    );
    const right = new T.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const up = away.clone().cross(right);
    const tan = Math.tan(T.MathUtils.degToRad(this.camera.fov / 2));
    const tanY = (tan * rect.height) / height,
      tanX = (tan * this.camera.aspect * rect.width) / width;
    let distance = 1.4;
    for (const x of [bounds.min.x, bounds.max.x])
      for (const y of [bounds.min.y, bounds.max.y])
        for (const z of [bounds.min.z, bounds.max.z]) {
          const p = new T.Vector3(x, y, z).sub(this.goalTarget);
          distance = Math.max(
            distance,
            Math.abs(p.dot(right)) / tanX + p.dot(away),
            Math.abs(p.dot(up)) / tanY + p.dot(away),
          );
        }
    this.goalPos
      .copy(this.goalTarget)
      .addScaledVector(
        away,
        (distance * 1.09) / (this.photoFraming ? 1 : this.zoom),
      );
    // Render the room edge to edge, but frame the artwork inside the space left
    // by real DOM controls. This also handles the portrait and comparison views.
    this.camera.setViewOffset(
      width,
      height,
      width / 2 - rect.x - rect.width / 2,
      height / 2 - rect.y - rect.height / 2,
      width,
      height,
    );
    if (instant || this.reduced) {
      this.camera.position.copy(this.goalPos);
      this.target.copy(this.goalTarget);
      this.camera.lookAt(this.target);
      this.camera.updateMatrixWorld();
      this.transition = 0;
    } else this.transition = performance.now() + 450;
  }
  previewStroke(points: UV[]) {
    const d = this.getSave().document;
    this.stroke.setPoints(
      points.map((p) =>
        surfacePoint(d, ...p).addScaledVector(surfaceNormal(d, ...p), 0.004),
      ),
    );
    this.refresh();
  }
  react() {
    this.reactionUntil = performance.now() + 900;
    this.refresh();
  }
  pointer(x: number, y: number) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ray.firstHitOnly = true;
    this.ray.setFromCamera(
      new T.Vector2(
        ((x - r.left) / r.width) * 2 - 1,
        (-(y - r.top) / r.height) * 2 + 1,
      ),
      this.camera,
    );
    return this.ray;
  }
  hit(x: number, y: number, includeHoles = false, includeTop = false) {
    const ray = this.pointer(x, y);
    this.scene.updateMatrixWorld(true);
    const objects = includeTop
      ? [
          this.pottery.body,
          this.pottery.rim,
          ...(this.pottery.cap.visible ? [this.pottery.cap] : []),
        ]
      : [this.pottery.body];
    return ray.intersectObjects(objects, false).find((h) => {
      if (!h.uv && includeTop) {
        const p = this.pottery.root.worldToLocal(h.point.clone()),
          c = this.getSave().document.mouth.center;
        h.uv = new T.Vector2(
          (Math.atan2(p.x - c[0], p.z - c[2]) / Math.PI / 2 + 1) % 1,
          1,
        );
      }
      return (
        h.uv &&
        (includeHoles || !isHole(this.getSave().document, h.uv.x, h.uv.y))
      );
    });
  }
  openingHit(x: number, y: number) {
    // The caller updates matrices once for the whole contour. Keep existing
    // openings in the ray target so overlap and the UV seam remain drawable.
    const ray = this.pointer(x, y);
    const h = ray.intersectObject(this.pottery.body, false)[0];
    if (!h?.uv) return null;
    const uv: UV = [h.uv.x, h.uv.y];
    const normal = surfaceFrame(this.getSave().document, ...uv).normal
      .transformDirection(this.pottery.root.matrixWorld);
    return { uv, point: h.point, normal, facing: -normal.dot(ray.ray.direction) };
  }
  groundHit(x: number, y: number, yPlane: number) {
    const p = new T.Vector3();
    return this.pointer(x, y).ray.intersectPlane(
      new T.Plane(new T.Vector3(0, 1, 0), -yPlane),
      p,
    );
  }
  private brushHit(x: number, y: number) {
    if (this.stage !== "excavation") return null;
    const ray = this.pointer(x, y);
    this.scene.updateMatrixWorld(true);
    const ground = this.terrain.hit(ray.ray);
    if (!ground) return null;
    const potteryHit = this.hit(x, y);
    const siruHit = ray.intersectObject(this.siru, true)[0];
    const objectHit = [potteryHit, siruHit]
      .filter((h) => h && h.distance < ground.distance)
      .sort((a, b) => a!.distance - b!.distance)[0];
    if (objectHit)
      return {
        point: objectHit.point,
        distance: objectHit.distance,
        normal:
          objectHit.face?.normal
            .clone()
            .transformDirection(objectHit.object.matrixWorld) ??
          new T.Vector3(0, 1, 0),
      };
    return ground;
  }
  moveBrush(x: number, y: number) {
    const hit = this.brushHit(x, y),
      cursor = this.terrain.cursor;
    cursor.visible = !!hit;
    if (hit) {
      cursor.position.copy(hit.point).addScaledVector(hit.normal, 0.008);
      cursor.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), hit.normal);
    }
    this.refresh();
  }
  hideBrush() {
    this.terrain.cursor.visible = false;
    this.refresh();
  }
  beginBrush() {
    this.terrain.begin();
    this.brushScreen = null;
  }
  endBrush() {
    this.terrain.end();
    this.brushScreen = null;
  }
  brushAt(x: number, y: number) {
    if (
      this.brushScreen &&
      Math.hypot(x - this.brushScreen[0], y - this.brushScreen[1]) < 0.5
    )
      return false;
    const hit = this.brushHit(x, y);
    if (!hit) {
      this.terrain.begin();
      this.brushScreen = null;
      return false;
    }
    this.terrain.dig(hit.point);
    this.brushScreen = [x, y];
    this.moveBrush(x, y);
    this.refresh(true);
    return true;
  }
  assistBrush() {
    this.terrain.assist();
    this.refresh(true);
  }
  coverage() {
    return this.terrain.coverage();
  }
  setFiringProgress(progress:number|null){
    const wasInKiln=this.firingProgress!==null&&firingFrame(this.firingProgress).inKiln;
    this.firingProgress=progress;
    const inKiln=progress!==null&&firingFrame(progress).inKiln;
    this.firingView.group.visible=inKiln;
    this.workshop.visible=this.stage!=='excavation'&&!inKiln;
    this.exhibits.visible=this.stage!=='excavation'&&!inKiln;
    this.displayPots.visible=this.stage!=='excavation'&&!inKiln&&this.exhibits.children.length===0;
    this.scene.background=new T.Color(inKiln?0x241914:0xead4a9);
    this.scene.fog=new T.Fog(inKiln?0x241914:0xead4a9,6,16);
    this.scene.environmentIntensity=inKiln?.28:1;
    this.key.intensity=inKiln?.6:this.stage==='firing'?2.4:3.2;
    if(progress!==null){this.firingView.update(progress,this.reduced);this.pottery.appearance(progress);}
    this.refresh(wasInKiln!==inKiln);
  }
  private animate = () => {
    this.frame = 0;
    const now = performance.now();
    if (this.paused || document.hidden) return;
    if (this.transition > now) {
      this.camera.position.lerp(this.goalPos, 0.18);
      this.target.lerp(this.goalTarget, 0.18);
    } else {
      this.camera.position.copy(this.goalPos);
      this.target.copy(this.goalTarget);
    }
    this.camera.lookAt(this.target);
    if(this.firingProgress!==null&&!this.reduced){
      const t=this.firingProgress,zoom=Math.sin(Math.PI*t)*.09;
      this.camera.position.lerp(this.target,zoom);this.camera.lookAt(this.target);
    }
    if (this.stage === "excavation") this.terrain.update();
    for (const s of this.sprites.values()) {
      s.material.rotation =
        !this.reduced && now < this.reactionUntil
          ? Math.sin((this.reactionUntil - now) * 0.013) * 0.075
          : 0;
    }
    const animated =
      this.transition > now ||
      (!this.reduced &&
        this.reactionUntil > now &&
        ["welcome", "ending"].includes(this.stage));
    if (this.dirty || animated || this.transition !== 0) {
      this.dirty = false;
      this.renderer.render(this.scene, this.camera);
      this.onRender?.();
      if (this.transition <= now) this.transition = 0;
    }
    if (animated && !this.frame)
      this.frame = requestAnimationFrame(this.animate);
  };
  async capturePhoto() {
    const width = 1920,
      height = 1080,
      oldTarget = this.renderer.getRenderTarget(),
      oldSize = this.renderer.getSize(new T.Vector2()),
      ratio = this.renderer.getPixelRatio();
    // A direct canvas render preserves the exact on-screen tone mapping,
    // sprite colours and MSAA; rendering to an LDR target clips highlights.
    try {
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(width, height, false);
      this.renderer.setRenderTarget(null);
      this.photoFraming = true;
      this.compose(true);
      this.renderer.render(this.scene, this.camera);
      return await new Promise<Blob>((resolve, reject) => {
        this.renderer.domElement.toBlob(
          (blob) =>
            blob ? resolve(blob) : reject(new Error("Photo encoding failed")),
          "image/png",
        );
      });
    } finally {
      this.renderer.setRenderTarget(oldTarget);
      this.renderer.setPixelRatio(ratio);
      this.renderer.setSize(oldSize.x, oldSize.y, false);
      this.photoFraming = false;
      this.compose(true);
      this.renderer.render(this.scene, this.camera);
    }
  }
  dispose() {
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.pottery.dispose();
    this.firingView.dispose();
    this.terrain.cursor.geometry.dispose();
    this.terrain.cursor.material.dispose();
    this.terrain.mesh.material.bumpMap?.dispose();
    this.scene.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          m.dispose();
      }
    });
    this.renderer.dispose();
  }
}
