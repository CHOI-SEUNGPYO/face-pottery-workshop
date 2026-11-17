import * as T from 'three';

/** A separate portrait scene keeps gallery exhibits out of the saved photo. */
export interface PhotoView {
  rotation:number;
  elevation:number;
  render(context:CanvasRenderingContext2D,fullSize?:boolean):void;
  dispose():void;
}

export function photoScene(artwork:T.Object3D,environment:T.Texture|null,direction:T.Vector3,stone:T.Texture){
  const scene=new T.Scene();scene.name='Player artwork portrait';
  scene.background=new T.Color('#d3cabb');scene.environment=environment;scene.environmentIntensity=.42;
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
  const width=Math.max(.72,radius*2+.12),height=size.y+.10,baseHeight=Math.max(.10,Math.min(.16,size.y*.14));
  const fixtures=new T.Group();fixtures.name='Photo room';scene.add(fixtures);
  const enclosure=new T.Group();enclosure.name='Own display case and plinth';fixtures.add(enclosure);
  const add=(geometry:T.BufferGeometry,material:T.Material,x=0,y=0,z=0)=>{
    const m=new T.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=m.receiveShadow=!material.transparent;enclosure.add(m);return m;
  };
  const surface=stone.clone();surface.repeat.set(1.2,1.2);
  const standMaterial=new T.MeshStandardMaterial({color:0xb6ab98,map:surface,bumpMap:surface,bumpScale:.001,roughness:.9});
  const topMaterial=new T.MeshStandardMaterial({color:0xe3d9c7,map:surface,bumpMap:surface,bumpScale:.0007,roughness:.82});
  const bronze=new T.MeshStandardMaterial({color:0x82715a,roughness:.55,metalness:.35});
  add(new T.BoxGeometry(width+.06,baseHeight,width+.06),standMaterial,0,-baseHeight/2-.04);
  add(new T.BoxGeometry(width+.075,.012,width+.075),bronze,0,-.044);
  add(new T.BoxGeometry(width+.09,.038,width+.09),topMaterial,0,-.019);
  const glass=new T.MeshStandardMaterial({color:0xf4f3e9,transparent:true,opacity:.025,roughness:.1,side:T.DoubleSide,depthWrite:false});
  const edge=new T.MeshStandardMaterial({color:0x8d9186,roughness:.28,transparent:true,opacity:.6});
  for(const sign of [-1,1]){
    const front=add(new T.PlaneGeometry(width,height),glass,0,height/2,sign*width/2);front.renderOrder=3;
    const side=add(new T.PlaneGeometry(width,height),glass,sign*width/2,height/2);side.rotation.y=Math.PI/2;side.renderOrder=3;
    for(const z of [-width/2,width/2])add(new T.BoxGeometry(.004,height,.004),edge,sign*width/2,height/2,z);
    add(new T.BoxGeometry(width,.004,.004),edge,0,height,sign*width/2);
    add(new T.BoxGeometry(.004,.004,width),edge,sign*width/2,height);
  }
  const lid=add(new T.PlaneGeometry(width,width),glass,0,height);lid.rotation.x=-Math.PI/2;lid.renderOrder=3;
  const framing=new T.Box3().setFromObject(enclosure);center=framing.getCenter(new T.Vector3());
  // A curved, finely grained gallery wall joins the floor without a hard horizon.
  // It is actual lit geometry, so the case stays grounded as the pot turns.
  const floorY=-baseHeight-.04,back=width*.83,curve=width*.65,span=width*5;
  const profile=[[floorY,width*5],[floorY,-back]];
  for(let i=1;i<=24;i++){const a=i/24*Math.PI/2;profile.push([floorY+curve*(1-Math.cos(a)),-back-curve*Math.sin(a)]);}
  profile.push([height+width*4,-back-curve]);
  const positions:number[]=[],uvs:number[]=[],indices:number[]=[];let along=0;
  for(let i=0;i<profile.length;i++){
    const [y,z]=profile[i];if(i)along+=Math.hypot(y-profile[i-1][0],z-profile[i-1][1]);
    positions.push(-span,y,z,span,y,z);uvs.push(0,along,span*2,along);
    if(i<profile.length-1){const a=i*2;indices.push(a,a+1,a+3,a,a+3,a+2);}
  }
  const backdropGeometry=new T.BufferGeometry();backdropGeometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));backdropGeometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));backdropGeometry.setIndex(indices);backdropGeometry.computeVertexNormals();
  const backdropTexture=stone.clone();backdropTexture.repeat.set(1.5,1.5);
  const backdrop=new T.Mesh(backdropGeometry,new T.MeshStandardMaterial({color:0xc9c1b3,bumpMap:backdropTexture,bumpScale:.00035,roughness:1}));
  backdrop.name='Quiet stone gallery backdrop';backdrop.receiveShadow=true;fixtures.add(backdrop);
  const key=new T.DirectionalLight(0xfff5e7,1.9);key.position.set(-3,5,3);key.castShadow=true;
  key.shadow.mapSize.set(1024,1024);key.shadow.normalBias=.0015;key.shadow.bias=-.00008;key.shadow.radius=3;
  const reach=width+1;Object.assign(key.shadow.camera,{left:-reach,right:reach,top:reach,bottom:-reach,near:.1,far:12});key.shadow.camera.updateProjectionMatrix();
  const fill=new T.DirectionalLight(0xfffaf1,.65);fill.position.set(3,2,-1);
  scene.add(key,fill,new T.HemisphereLight(0xfff9ef,0x8b8171,.7));
  const camera=new T.PerspectiveCamera(32,1920/1080,.02,60),away=direction.clone();
  away.y=0;if(away.lengthSq()<.001)away.set(0,0,1);away.normalize();away.y=.14;away.normalize();
  const right=new T.Vector3(away.z,0,-away.x).normalize();
  let elevation=Math.asin(away.y);
  const frame=(canvasWidth:number,canvasHeight:number)=>{
    away.set(-right.z*Math.cos(elevation),Math.sin(elevation),right.x*Math.cos(elevation));
    const up=away.clone().cross(right);
    camera.aspect=canvasWidth/canvasHeight;
    const tan=Math.tan(T.MathUtils.degToRad(camera.fov/2));let distance=.5;
    for(const x of [framing.min.x,framing.max.x])for(const y of [framing.min.y,framing.max.y])for(const z of [framing.min.z,framing.max.z]){
      const p=new T.Vector3(x,y,z).sub(center);
      distance=Math.max(distance,Math.abs(p.dot(right))/(tan*camera.aspect*.88)+p.dot(away),Math.abs(p.dot(up))/(tan*.86)+p.dot(away));
    }
    camera.position.copy(center).addScaledVector(away,distance*1.015);
    camera.lookAt(center);camera.setViewOffset(canvasWidth,canvasHeight,0,canvasHeight*.025,canvasWidth,canvasHeight);camera.updateProjectionMatrix();camera.updateMatrixWorld();
  };
  frame(1920,1080);
  return {scene,camera,own,frame,get elevation(){return elevation;},set elevation(value:number){elevation=T.MathUtils.clamp(value,-.10,1.30);},dispose(){
    const materials=new Set<T.Material>();
    fixtures.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();materials.add(o.material);}});
    materials.forEach(m=>m.dispose());surface.dispose();backdropTexture.dispose();key.shadow.map?.dispose();key.shadow.mapPass?.dispose();
  }};
}
