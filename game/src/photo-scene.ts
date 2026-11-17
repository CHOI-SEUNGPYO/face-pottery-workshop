import * as T from 'three';

/** A separate portrait scene keeps gallery exhibits out of the saved photo. */
export interface PhotoView {
  rotation:number;
  render(context:CanvasRenderingContext2D,fullSize?:boolean):void;
  dispose():void;
}

export function photoScene(artwork:T.Object3D,environment:T.Texture|null,direction:T.Vector3,timber:T.Texture){
  const scene=new T.Scene();scene.name='Player artwork portrait';
  scene.background=new T.Color('#354951');scene.environment=environment;scene.environmentIntensity=.55;
  const own=artwork.clone(false);own.name='Player artwork';
  for(const child of artwork.children)if(child.visible)own.add(child.clone(true));
  scene.add(own);
  let bounds=new T.Box3().setFromObject(own),center=bounds.getCenter(new T.Vector3());
  own.position.sub(new T.Vector3(center.x,bounds.min.y,center.z));
  bounds=new T.Box3().setFromObject(own);center=bounds.getCenter(new T.Vector3());
  const size=bounds.getSize(new T.Vector3());
  // Fit the enclosure to the whole turning radius, including a broad rim.
  let radius=0;const point=new T.Vector3();
  own.traverse(o=>{if(o instanceof T.Mesh){const positions=o.geometry.getAttribute('position');for(let i=0;i<positions.count;i++){point.fromBufferAttribute(positions,i).applyMatrix4(o.matrixWorld);radius=Math.max(radius,Math.hypot(point.x,point.z));}}});
  const width=Math.max(.84,radius*2+.18),height=size.y+.16,baseHeight=Math.max(.18,Math.min(.3,size.y*.24));
  const fixtures=new T.Group();fixtures.name='Photo room';scene.add(fixtures);
  const enclosure=new T.Group();enclosure.name='Own display case and plinth';fixtures.add(enclosure);
  const add=(geometry:T.BufferGeometry,material:T.Material,x=0,y=0,z=0)=>{
    const m=new T.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=m.receiveShadow=!material.transparent;enclosure.add(m);return m;
  };
  const standMaterial=new T.MeshStandardMaterial({color:0x354843,roughness:.85});
  const woodMaterial=new T.MeshStandardMaterial({color:0xc7a57c,map:timber,roughness:.8});
  add(new T.BoxGeometry(width+.08,baseHeight,width+.08),standMaterial,0,-baseHeight/2-.045);
  add(new T.BoxGeometry(width+.12,.045,width+.12),woodMaterial,0,-.0225);
  const glass=new T.MeshStandardMaterial({color:0xd8f2ed,transparent:true,opacity:.045,roughness:.12,side:T.DoubleSide,depthWrite:false});
  const edge=new T.MeshStandardMaterial({color:0xadc9c4,roughness:.3,transparent:true,opacity:.55});
  for(const sign of [-1,1]){
    const front=add(new T.PlaneGeometry(width,height),glass,0,height/2,sign*width/2);front.renderOrder=3;
    const side=add(new T.PlaneGeometry(width,height),glass,sign*width/2,height/2);side.rotation.y=Math.PI/2;side.renderOrder=3;
    for(const z of [-width/2,width/2])add(new T.BoxGeometry(.006,height,.006),edge,sign*width/2,height/2,z);
    add(new T.BoxGeometry(width,.006,.006),edge,0,height,sign*width/2);
    add(new T.BoxGeometry(.006,.006,width),edge,sign*width/2,height);
  }
  const lid=add(new T.PlaneGeometry(width,width),glass,0,height);lid.rotation.x=-Math.PI/2;lid.renderOrder=3;
  const framing=new T.Box3().setFromObject(enclosure);center=framing.getCenter(new T.Vector3());
  const floorTexture=timber.clone();floorTexture.repeat.set(8,8);
  const floor=add(new T.PlaneGeometry(20,20),new T.MeshStandardMaterial({color:0x947454,map:floorTexture,roughness:1}),0,-baseHeight-.046);floor.rotation.x=-Math.PI/2;fixtures.attach(floor);
  fixtures.attach(add(new T.PlaneGeometry(20,8),new T.MeshStandardMaterial({color:0x274655,roughness:1}),0,2,-3));
  const key=new T.DirectionalLight(0xfff4e8,1.8);key.position.set(-3,5,2);key.castShadow=true;
  key.shadow.mapSize.set(1024,1024);key.shadow.normalBias=.007;key.shadow.bias=-.00025;
  const fill=new T.DirectionalLight(0xc6e1ed,.35);fill.position.set(3,2,-2);
  scene.add(key,fill,new T.HemisphereLight(0xfff4e4,0x676d67,.65));
  const camera=new T.PerspectiveCamera(35,1920/1080,.02,60),away=direction.clone().normalize();
  const right=new T.Vector3(away.z,0,-away.x).normalize(),up=away.clone().cross(right);
  const tan=Math.tan(T.MathUtils.degToRad(camera.fov/2));let distance=1.4;
  for(const x of [framing.min.x,framing.max.x])for(const y of [framing.min.y,framing.max.y])for(const z of [framing.min.z,framing.max.z]){
    const p=new T.Vector3(x,y,z).sub(center);
    distance=Math.max(distance,Math.abs(p.dot(right))/(tan*camera.aspect*.88)+p.dot(away),Math.abs(p.dot(up))/(tan*.76)+p.dot(away));
  }
  // Leave space below the artwork for the disclosure printed by PhotoEditor.
  camera.position.copy(center).addScaledVector(away,distance*1.025);
  camera.lookAt(center);camera.setViewOffset(1920,1080,0,36,1920,1080);camera.updateMatrixWorld();
  return {scene,camera,own,dispose(){
    const materials=new Set<T.Material>();
    fixtures.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();materials.add(o.material);}});
    materials.forEach(m=>m.dispose());floorTexture.dispose();key.shadow.map?.dispose();key.shadow.mapPass?.dispose();
  }};
}
