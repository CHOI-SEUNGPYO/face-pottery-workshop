import * as T from 'three';

/** A separate portrait scene keeps gallery exhibits out of the saved photo. */
export function photoScene(artwork:T.Object3D,environment:T.Texture|null,direction:T.Vector3){
  const scene=new T.Scene();scene.name='Player artwork portrait';
  scene.background=new T.Color('#e8dfce');scene.environment=environment;scene.environmentIntensity=.55;
  const own=artwork.clone(false);own.name='Player artwork';
  for(const child of artwork.children)if(child.visible)own.add(child.clone(true));
  scene.add(own);
  let bounds=new T.Box3().setFromObject(own),center=bounds.getCenter(new T.Vector3());
  own.position.sub(new T.Vector3(center.x,bounds.min.y,center.z));
  bounds=new T.Box3().setFromObject(own);center=bounds.getCenter(new T.Vector3());
  const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:0xe8dfce,roughness:1}));
  floor.rotation.x=-Math.PI/2;floor.position.y=-.006;floor.receiveShadow=true;scene.add(floor);
  const key=new T.DirectionalLight(0xfff4e8,1.8);key.position.set(-3,5,2);key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);key.shadow.normalBias=.007;key.shadow.bias=-.00025;
  const fill=new T.DirectionalLight(0xc6e1ed,.35);fill.position.set(3,2,-2);
  scene.add(key,fill,new T.HemisphereLight(0xfff4e4,0x676d67,.65));
  const camera=new T.PerspectiveCamera(35,1920/1080,.02,60),away=direction.clone().normalize();
  const right=new T.Vector3(away.z,0,-away.x).normalize(),up=away.clone().cross(right);
  const tan=Math.tan(T.MathUtils.degToRad(camera.fov/2));let distance=1.4;
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
    const p=new T.Vector3(x,y,z).sub(center);
    distance=Math.max(distance,Math.abs(p.dot(right))/(tan*camera.aspect*.88)+p.dot(away),Math.abs(p.dot(up))/(tan*.76)+p.dot(away));
  }
  // Leave space below the artwork for the disclosure printed by PhotoEditor.
  camera.position.copy(center).addScaledVector(away,distance*1.025);
  camera.lookAt(center);camera.setViewOffset(1920,1080,0,36,1920,1080);camera.updateMatrixWorld();
  return {scene,camera,dispose(){floor.geometry.dispose();floor.material.dispose();key.shadow.map?.dispose();key.shadow.mapPass?.dispose();}};
}
