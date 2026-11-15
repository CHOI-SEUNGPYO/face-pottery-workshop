import * as T from 'three';

// Authored from the supplied three-face and exhibition photographs. The profile,
// apertures and firing marks are an interpretation, not measured scan data.
export function buildFaceArtifact(){
  const root=new T.Group();root.name='Sowolri three face pottery study';
  root.userData.provenance='Photo-informed 3D reconstruction; not a scan';
  const height=1.58, circumference=Math.PI*2, radiusScale=.50;
  const profile=new T.SplineCurve([
    [.355,0],[.365,.025],[.345,.09],[.334,.28],[.356,.48],
    [.416,.72],[.482,.96],[.488,1.10],[.459,1.25],
    [.387,1.36],[.274,1.45],[.119,1.51],[.110,1.55],[.117,height],
  ].map(([r,y])=>new T.Vector2(r,y))).getPoints(600);
  function radius(y){
    let i=1;while(i<profile.length-1&&profile[i].y<y)i++;
    const a=profile[i-1],b=profile[i],t=T.MathUtils.clamp((y-a.y)/(b.y-a.y),0,1);
    return T.MathUtils.lerp(a.x,b.x,t);
  }
  function surface(u,y,inset=0){
    const r=radius(y)-inset;
    const wobble=(.004*Math.sin(3*u+y*8)+.002*Math.sin(7*u-y*11))*Math.sin(Math.PI*y/height);
    const lip=T.MathUtils.smoothstep(y,1.49,height)*(.003*Math.sin(u*9)+.002*Math.sin(u*17));
    return new T.Vector3(Math.sin(u)*(r+wobble),y+lip,Math.cos(u)*(r+wobble));
  }
  const holes=[];
  function aperture(name,u,y,w,h,tilt=0,seed=0,lip=.004){
    const points=Array.from({length:48},(_,i)=>{
      const a=-i/48*circumference,k=1+.035*Math.sin(a*5+seed)+.025*Math.sin(a*9-seed);
      const x=Math.cos(a)*w*k,v=Math.sin(a)*h*k;
      return new T.Vector2((u+x/radius(y))*radiusScale,y+v+tilt*x);
    });
    holes.push({name,points,lip});
  }
  for(let face=0;face<3;face++){
    const u=Math.PI/6+face*circumference/3;
    const eyeHeight=[.026,.017,.021][face],mouthHeight=[.032,.012,.025][face];
    for(const side of [-1,1]){
      aperture(`Face ${face+1} eye`,u+side*.245,1.307,.078,eyeHeight,side*.12,face+side,.008);
      aperture(`Face ${face+1} nostril`,u+side*.087,1.198,.020,.026,0,face+3,.004);
    }
    aperture(`Face ${face+1} mouth`,u,1.075,.101,mouthHeight,.025,face+8,.014);
    aperture(`Side opening ${face+1}`,u+Math.PI/3,1.215,.066,.075,-.08,face+12,.032);
  }
  const contour=[new T.Vector2(0,0),new T.Vector2(circumference*radiusScale,0),new T.Vector2(circumference*radiusScale,height),new T.Vector2(0,height)];
  const points=[...contour,...holes.flatMap(h=>h.points)];
  let triangles=T.ShapeUtils.triangulateShape(contour,holes.map(h=>h.points));
  // Conforming subdivision retains the exact aperture outlines and gives the
  // curved body enough interior vertices without stair-stepped cut-outs.
  for(let pass=0;pass<13;pass++){
    const cuts=new Map(),key=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;
    for(const t of triangles)for(let j=0;j<3;j++){
      const a=t[j],b=t[(j+1)%3],k=key(a,b);
      if(!cuts.has(k)&&points[a].distanceTo(points[b])>.090){cuts.set(k,points.length);points.push(points[a].clone().lerp(points[b],.5));}
    }
    if(!cuts.size)break;
    const next=[];
    for(const [a,b,c] of triangles){
      const ab=cuts.get(key(a,b)),bc=cuts.get(key(b,c)),ca=cuts.get(key(c,a));
      if(ab!==undefined&&bc!==undefined&&ca!==undefined)next.push([a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]);
      else if(ab!==undefined&&bc!==undefined)next.push([b,bc,ab],[a,ab,c],[ab,bc,c]);
      else if(bc!==undefined&&ca!==undefined)next.push([c,ca,bc],[b,bc,a],[bc,ca,a]);
      else if(ca!==undefined&&ab!==undefined)next.push([a,ab,ca],[c,ca,b],[ca,ab,b]);
      else if(ab!==undefined)next.push([a,ab,c],[ab,b,c]);
      else if(bc!==undefined)next.push([b,bc,a],[bc,c,a]);
      else if(ca!==undefined)next.push([c,ca,b],[ca,a,b]);
      else next.push([a,b,c]);
    }
    triangles=next;
  }
  const outer=new T.MeshStandardMaterial({color:0xe1e6e7,roughness:.94,vertexColors:true});
  outer.name='Charcoal gray stamped earthenware';outer.userData.surface='stamped-clay';
  const inner=new T.MeshStandardMaterial({color:0x353633,roughness:1});inner.name='Unglazed hollow interior';
  function colour(u,y){
    const cloud=(Math.sin(u*5+y*7)+Math.sin(u*11-y*4)+Math.sin(u*17+y*13))/3;
    const worn=T.MathUtils.smoothstep(cloud,.10,.72)*T.MathUtils.smoothstep(y,1.14,1.52);
    const lower=T.MathUtils.smoothstep(y,.25,.95),gray=.52+lower*.26+cloud*.06;
    return [gray+worn*.16,gray-worn*.04,gray-worn*.20];
  }
  function add(name,coords,indices,mat,colors){
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(coords.flatMap(v=>v.toArray()),3));
    if(colors)geo.setAttribute('color',new T.Float32BufferAttribute(colors.flat(),3));
    geo.setIndex(indices.flat());geo.computeVertexNormals();
    const m=new T.Mesh(geo,mat);m.name=name;root.add(m);return geo;
  }
  for(const inside of [false,true]){
    const coords=points.map(p=>surface(p.x/radiusScale,p.y,inside?.028:0));
    // Mapping (angle,height) has outward-facing CCW triangles.
    const ids=inside?triangles.map(([a,b,c])=>[a,c,b]):triangles;
    const geo=add(inside?'Continuous inner wall':'Perforated stamped body',coords,ids,inside?inner:outer,inside?null:points.map(p=>colour(p.x/radiusScale,p.y)));
    geo.setAttribute('uv',new T.Float32BufferAttribute(points.flatMap(p=>[p.x/radiusScale/circumference*3,p.y*1.8]),2));
  }
  for(const hole of holes){
    const vertices=[],colors=[],uv=[],indices=[],n=hole.points.length;
    for(const depth of [-hole.lip,0,.028])for(const p of hole.points){
      const u=p.x/radiusScale;vertices.push(surface(u,p.y,depth));colors.push(colour(u,p.y));uv.push(u/circumference*3,p.y*1.8);
    }
    for(let j=0;j<2;j++)for(let i=0;i<n;i++){
      const a=j*n+i,b=j*n+(i+1)%n,c=a+n,d=b+n;indices.push([a,b,c],[b,d,c]);
    }
    const geo=add(hole.name+' clay edge',vertices,indices,outer,colors);
    geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  }
  // Open neck and open lower rim, with ceramic thickness visible from below.
  for(const y of [0,height]){
    const vertices=[],colors=[],uv=[],indices=[],n=144;
    for(const depth of [0,.028])for(let i=0;i<=n;i++){
      const u=i/n*circumference;vertices.push(surface(u,y,depth));colors.push(colour(u,y));uv.push(i/n*3,y*1.8);
    }
    for(let i=0;i<n;i++){const a=i,b=i+1,c=i+n+1,d=c+1;indices.push(...(y===0?[[a,c,b],[b,c,d]]:[[a,b,c],[b,d,c]]));}
    const geo=add(y===0?'Open basal rim':'Uneven neck rim',vertices,indices,outer,colors);geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  }
  root.rotation.y=-Math.PI/6;
  root.userData.faces=3;root.userData.openings=holes.length;
  return root;
}
