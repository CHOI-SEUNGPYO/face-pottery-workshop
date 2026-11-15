import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { asset, characterImage } from "./assets";
import { PotteryView } from "./pottery-view";
import {ArtAssets} from './art-assets';
import { StrokePreview } from "./stroke-preview";
import { SoilTerrain, migrateSoilMask } from "./soil";
import { scenes } from "./content";
import { surfaceFrame } from "./surface-path";
import { FiringView, firingFrame } from './firing';
import {museum,museumAsset} from './museum';
import {outdoorSite,museumRoom,setEnvironmentMaterials} from './environments';
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
  firing: 32,
  excavation: 0,
  assembly: 22,
  compare: -12,
  ending: -16,
};

// The furniture never animates. One mesh per material avoids submitting every
// leaf, plank and vase separately, without changing their shapes or materials.
function batchStatic(root: T.Object3D) {
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
    const mesh=new T.Mesh(merged,material);mesh.castShadow=!(material instanceof T.MeshBasicMaterial)&&!material.transparent;mesh.receiveShadow=mesh.castShadow;root.add(mesh);
    geometries.forEach((g) => g.dispose());
  }
  originals.forEach((g) => g.dispose());
}
function batchWithParts(root:T.Group,flag:string){
  const holder=new T.Group(),parts:T.Object3D[]=[];
  root.updateMatrixWorld(true);
  root.traverse(object=>{if(object.userData[flag])parts.push(object);});
  for(const part of parts)holder.attach(part);
  batchStatic(root);
  for(const part of parts){batchStatic(part);root.attach(part);}
  return parts;
}

export class World {
  renderer: T.WebGLRenderer;
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(35, 1, 0.02, 60);
  pottery = new PotteryView();
  workshop = new T.Group();
  private art = new ArtAssets();
  private studioArchitecture = new T.Group();
  private galleryArchitecture = new T.Group();
  private walls:T.Object3D[]=[];
  private wallFixtures:T.Object3D[]=[];
  private forestSectors:T.Object3D[]=[];
  private galleryPots=new T.Group();
  private courtyard=new T.Group();
  private assemblyBench=new T.Group();
  private siruHeight=.70;
  private fieldProps = new T.Group();
  private firingView=new FiringView();
  private firingProgress:number|null=null;
  private displayPots=new T.Group();
  private exhibits=new T.Group();
  private museumRoom=new T.Group();
  private referenceArtifact=new T.Group();
  selectedArtifact:'own'|'reference'='own';
  private site=new T.Group();
  private digLevel=.8;
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
  private key = new T.DirectionalLight(0xfff4e8, 3.2);
  private ambient = new T.HemisphereLight(0xfff4e4, 0x676d67, 1.25);
  private fill = new T.DirectionalLight(0xc6e1ed, 0.7);
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
    new T.PlaneGeometry(4, 4),
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
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.domElement.setAttribute(
      "aria-label",
      "손으로 만드는 3차원 얼굴토기",
    );
    this.renderer.domElement.tabIndex = 0;
    host.append(this.renderer.domElement);
    this.scene.background = new T.Color("#ead4a9");
    this.scene.fog = new T.Fog("#ead4a9", 6, 16);
    this.scene.add(this.ambient);
    this.key.position.set(-3, 5, 2);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.camera.left = -3;
    this.key.shadow.camera.right = 3;
    this.key.shadow.camera.top = 3;
    this.key.shadow.camera.bottom = -3;
    this.key.shadow.bias = -0.00025;
    this.key.shadow.normalBias = 0.007;
    this.scene.add(this.key);
    this.fill.position.set(3, 2, -2);
    this.scene.add(this.fill);
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
      this.museumRoom,this.referenceArtifact,this.site,this.courtyard,this.assemblyBench,
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
    await this.art.load(this.renderer);
    this.pottery.setSurface(this.art.texture('grayware'));
    setEnvironmentMaterials(this.art.texture('earth'),this.art.texture('aged-oak'));
    for(const [name,root] of this.art.models){
      if(name==='studio-shell'||name==='gallery-shell')this.walls.push(...batchWithParts(root,'wall'));
      else if(name==='studio-furniture'||name==='gallery-fixtures')this.wallFixtures.push(...batchWithParts(root,'wallFixture'));
      else if(name==='courtyard')this.forestSectors.push(...batchWithParts(root,'forestSector'));
      else if(name!=='kiln-vault')batchStatic(root);
    }
    for(const name of ['Cutaway_shell','Permanent_half']){
      const part=this.art.model('kiln-vault').getObjectByName(name);
      if(part)batchStatic(part);
    }
    const siru=this.art.model('siru'),siruBounds=new T.Box3().setFromObject(siru);
    siru.position.y-=siruBounds.min.y;this.siruHeight=siruBounds.max.y-siruBounds.min.y;
    this.siru.add(siru);
    const stand=await loader.loadAsync(asset('models/display-stand.glb'));
    batchStatic(stand.scene);this.stand.add(stand.scene);
    this.studioArchitecture.add(this.art.model('studio-shell'));
    this.workshop.add(this.studioArchitecture,this.art.model('studio-furniture'),this.art.model('craft-bench'),this.art.model('craft-tools'));
    this.displayPots.clear();this.displayPots.add(this.art.model('studio-collection'));
    this.galleryArchitecture.add(this.art.model('gallery-shell'));
    this.galleryPots.add(this.art.model('gallery-collection'));
    const galleryDetails=museumRoom();
    galleryDetails.traverse(o=>{if(o.userData.wallFixture)this.wallFixtures.push(o);});
    this.museumRoom.add(this.galleryArchitecture,this.art.model('gallery-fixtures'),this.galleryPots,galleryDetails);
    this.fieldProps.add(this.art.model('field-tools'));this.site.add(this.fieldProps);
    this.courtyard.add(this.art.model('courtyard'));
    this.assemblyBench.add(this.art.model('conservation-bench'));
    this.firingView.applyArt(this.art.model('kiln-vault'),this.art.model('kiln-dressing'));
    const firingGarden=this.art.model('courtyard').clone();
    firingGarden.traverse(o=>{if(o.userData.forestSector)this.forestSectors.push(o);});
    this.firingView.group.add(firingGarden);
    this.terrain.setSurface(this.art.texture('earth'));
    this.earth.material.map=this.art.texture('earth');this.earth.material.color.set(0xb7a58d);
    const groundUV=this.earth.geometry.getAttribute('uv');for(let i=0;i<groundUV.count;i++)groundUV.setXY(i,groundUV.getX(i)*2,groundUV.getY(i)*2);
    this.referenceArtifact.name='Photo informed three face artifact';
    this.referenceArtifact.add(this.art.model('face-artifact'));
    this.referenceArtifact.position.set(.9,0,0);
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
      ["압이", "독이", "경산이"].map(async (name) => {
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
    this.pottery.outlineSize(w,h);
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
    const outdoors=stage==='excavation'||stage==='assembly',museumStage=stage==='compare'||stage==='ending';
    this.workshop.visible = !outdoors&&!museumStage&&stage!=='firing';
    this.exhibits.visible=this.workshop.visible;
    this.displayPots.visible=this.workshop.visible&&this.exhibits.children.length===0;
    this.excavation.visible = false;
    this.earth.visible = outdoors;
    this.soil.visible = outdoors;
    this.site.visible=outdoors;this.museumRoom.visible=museumStage;this.referenceArtifact.visible=museumStage;
    this.pottery.outline.visible=stage==='body'||stage==='mouth';
    this.firingView.group.visible=stage==='firing';
    this.courtyard.visible=outdoors;this.assemblyBench.visible=stage==='assembly';
    this.soil.position.x=this.site.position.x=this.earth.position.x=0;
    this.siru.visible = ["excavation", "assembly"].includes(stage);
    this.stand.visible = ["welcome", "inspect"].includes(
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
    // Use the buried poses to rebuild the same site even on a direct assembly resume.
    if(outdoors){
      this.pottery.root.rotation.x=this.siru.rotation.x=-Math.PI/2;
      this.pottery.root.position.set(-.58,.13,.47);
      this.siru.position.set(.62,.1,.3);
    }
    if(museumStage)this.pottery.root.position.set(-.78,0,0);
    if(stage==='firing')this.pottery.root.position.set(-1.95,.12,1.65);
    // Guides take turns in the physical scene; the three-carrier travel animation is separate.
    for (const [name, sprite] of this.sprites) {
      sprite.material.depthTest=true;
      sprite.visible=(stage==='welcome'&&name==='경산이')||(stage==='firing'&&name==='압이');
      const size=stage==='firing'?.64:.42,im=sprite.material.map!.image;
      sprite.scale.set(size*im.width/im.height,size,1);
      sprite.position.set(stage==='welcome'?1.12:1.8,0,stage==='welcome'?.55:1.3);
    }
    this.key.intensity = museumStage?1.8:stage === "firing" ? 2.3 : 2.5;
    this.ambient.intensity=museumStage?.65:1.25;
    this.fill.intensity=museumStage?.35:.7;
    this.update();
    if(stage==='firing')this.setFiringProgress(null);
    if (outdoors) {
      if (!s.excavationLayout) {
        s.excavationMask = migrateSoilMask(s.excavationMask);
        s.excavationLayout = "terrain-v1";
      }
      this.mask = s.excavationMask;
      // Rest the exposed objects on the excavation floor before calculating soil cover.
      for(const object of [this.pottery.root,this.siru]){
        object.updateMatrixWorld(true);
        const b=new T.Box3().setFromObject(object);
        object.position.y+=-.23-b.min.y;
      }
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
      this.digLevel=this.terrain.surfaceLevel;
      if(!this.site.userData.ground){
        this.site.add(outdoorSite(this.digLevel));this.fieldProps.position.y=this.digLevel;
        this.site.userData.ground=true;this.site.userData.level=this.digLevel;
      }
      this.site.position.y=this.digLevel-this.site.userData.level;
      this.courtyard.position.y=this.assemblyBench.position.y=this.digLevel;
    }
    if(stage==='assembly'){
      const placed=s.assembledRevision===s.document.revision;
      this.pottery.root.rotation.x=this.siru.rotation.x=0;
      this.site.position.x=this.soil.position.x=this.earth.position.x=-3.8;
      this.siru.position.set(0,this.digLevel+.72,0);
      this.pottery.root.position.set(placed?0:-.83,placed?this.assemblyHeight:this.digLevel+.72,placed?0:.15);
    }
    const color=museumStage?0x253941:outdoors||stage==='firing'?0xc1d0ca:0xdcd5c8;
    this.scene.background=new T.Color(color);
    this.scene.backgroundIntensity=.8;
    this.scene.fog=outdoors||stage==='firing'?null:new T.Fog(color,14,30);
    this.scene.environmentIntensity=museumStage?.55:.65;
    if(stage==='firing')this.firingView.update(0,this.reduced);
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
    this.elevation += delta;
    this.viewPreset = "custom";
    this.compose(true);
    this.refresh();
  }
  orbit(dx:number,dy:number){
    this.azimuth-=dx*.35;
    this.tilt(dy*.3);
  }
  get inGallery(){return this.stage==='compare'||this.stage==='ending';}
  artifactAt(x:number,y:number):'own'|'reference'|null{
    if(!this.inGallery)return null;
    this.scene.updateMatrixWorld(true);
    const hits=this.pointer(x,y).intersectObjects([this.pottery.body,this.referenceArtifact],true);
    let object=hits[0]?.object;
    if(object===this.pottery.body)return 'own';
    while(object){if(object===this.referenceArtifact)return 'reference';object=object.parent!;}
    return null;
  }
  rotateArtifact(which:'own'|'reference',dx:number,dy=0){
    if(!this.inGallery)return;
    this.selectedArtifact=which;
    const root=which==='own'?this.pottery.root:this.referenceArtifact;
    root.rotation.y+=dx*.008;
    if(which==='own')this.getSave().rotation=root.rotation.y;
    // Keep both objects on their plinths; vertical drags change viewing height.
    if(dy)this.tilt(dy*.22);
    this.refresh(true);
  }
  highlightPot(active:boolean){this.pottery.highlight(active);this.refresh();}
  zoomBy(factor: number) {
    this.zoom = clamp(this.zoom * factor, 0.65, 1.65);
    this.compose(true);
    this.refresh();
  }
  private compose(instant = false) {
    // The trench is viewed from above its rim. A low orbit reveals the underside
    // of the landscape and hides the very surface the player needs to brush.
    const digging=this.stage==='excavation';
    this.elevation=clamp(this.elevation,digging?45:this.stage==='assembly'?22:3,digging?82:86);
    if(this.inGallery){this.azimuth=clamp(this.azimuth,-32,32);this.elevation=clamp(this.elevation,8,48);}
    if(digging)this.zoom=clamp(this.zoom,.85,1);
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
    // Once found, frame the two artifacts rather than the full excavation pit.
    if (this.stage === "excavation") bounds.expandByObject(this.soil);
    if(this.stage==='compare'||this.stage==='ending'){
      bounds.expandByObject(this.referenceArtifact);
      bounds.expandByPoint(new T.Vector3(-1.46,-.50,-.65));
      bounds.expandByPoint(new T.Vector3(1.58,1.88,.65));
    }
    if(this.stage==='firing')bounds.set(new T.Vector3(-2.65,-.12,-1.9),new T.Vector3(1.4,2.7,2.3));
    if(this.stage==='welcome'){bounds.expandByPoint(new T.Vector3(-1.15,-.55,-.3));bounds.expandByPoint(new T.Vector3(1.65,.4,.85));}
    if (this.stage==='welcome')
      for (const sprite of this.sprites.values()) {
        if(!sprite.visible)continue;
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
        (distance * 1.025) / (this.photoFraming ? 1 : this.zoom),
      );
    // Only the wall between the camera and the room opens. Floors and plinths remain.
    for(const wall of this.walls){
      const position=wall.getWorldPosition(new T.Vector3());
      const normal=new T.Vector3(...wall.userData.inward as [number,number,number]);
      wall.visible=this.goalPos.clone().sub(position).dot(normal)>0;
    }
    const studioBack=this.goalPos.z>-3.7,galleryBack=this.goalPos.z>-4.4;
    for(const sector of this.forestSectors)sector.visible=away.dot(new T.Vector3(...sector.userData.outward as [number,number,number]))<.15;
    let studioClear=studioBack,galleryClear=galleryBack;
    for(const fixture of this.wallFixtures){
      const gallery=fixture.getWorldPosition(new T.Vector3()).z<-3.6;
      const box=new T.Box3().setFromObject(fixture).expandByScalar(.12);
      const targets=[this.goalTarget,...[bounds.min.y,bounds.max.y].flatMap(y=>[bounds.min.x,bounds.max.x].map(x=>new T.Vector3(x,y,this.goalTarget.z)))];
      const blocks=targets.some(point=>{
        const ray=new T.Ray(this.goalPos,point.clone().sub(this.goalPos).normalize()),hit=ray.intersectBox(box,new T.Vector3());
        return hit&&hit.distanceTo(this.goalPos)<point.distanceTo(this.goalPos);
      });
      fixture.visible=(gallery?galleryBack:studioBack)&&!blocks;
      if(!fixture.visible){if(gallery)galleryClear=false;else studioClear=false;}
    }
    this.displayPots.visible=this.workshop.visible&&!this.exhibits.children.length&&studioClear;
    this.exhibits.visible=this.workshop.visible&&studioClear;
    this.galleryPots.visible=galleryClear;
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
  shapeHit(x:number,y:number){
    const direct=this.hit(x,y,false,true);if(direct||this.stage!=='body')return direct;
    // The subtle screen-space outline and a finger should both catch the rim
    // of the silhouette. Distant background dragging remains camera control.
    for(const r of [3,6])for(const [dx,dy] of [[r,0],[-r,0],[0,r],[0,-r]]){
      const hit=this.hit(x+dx,y+dy,false,true);if(hit)return hit;
    }
    return undefined;
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
    const previous=this.firingProgress===null?0:firingFrame(this.firingProgress).placement;
    this.firingProgress=progress;
    const frame=firingFrame(progress??0),p=frame.placement;
    if(this.stage==='firing'){
      this.firingView.group.visible=true;
      this.scene.environmentIntensity=.8-.4*frame.heat;this.key.intensity=2.4-1.3*frame.heat;
      this.pottery.root.position.set(-1.95*(1-p),.12-.05*p+Math.sin(p*Math.PI)*.13,1.65-1.85*p+Math.sin(p*Math.PI)*.55);
      // Anchor even older, off-origin saved shapes to the same physical support.
      const bottom=this.pottery.body.geometry.boundingBox?.min.y??0;
      this.pottery.root.position.y-=Math.min(0,bottom);
      this.firingView.update(progress??0,this.reduced,progress!==null);
      if(progress!==null)this.pottery.appearance(progress);
    }
    this.refresh(previous!==p||progress===null);
  }
  get kilnCutaway(){return this.firingView.cutaway;}
  toggleKiln(){this.firingView.setCutaway(!this.firingView.cutaway);this.refresh(true);}
  get assemblyHeight(){return this.digLevel+.72+this.siruHeight;}
  async placeOnSiru(){
    const from=this.pottery.root.position.clone(),to=new T.Vector3(0,this.assemblyHeight,0);
    const start=performance.now(),duration=this.reduced?0:650;
    let elapsed=0,last=start;
    return new Promise<boolean>(resolve=>{
      const step=(now:number)=>{
        if(this.stage!=='assembly'){resolve(false);return;}
        if(!this.paused&&!document.hidden)elapsed+=now-last;
        last=now;
        const t=duration?clamp(elapsed/duration,0,1):1,p=t*t*(3-2*t);
        this.pottery.root.position.copy(from).lerp(to,p);
        this.pottery.root.position.y+=Math.sin(p*Math.PI)*.16;
        this.refresh(true);
        if(t<1)requestAnimationFrame(step);else resolve(true);
      };step(start);
    });
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
