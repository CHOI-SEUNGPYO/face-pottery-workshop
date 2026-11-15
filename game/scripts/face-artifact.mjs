import * as T from 'three';
import polygonClipping from 'polygon-clipping';

// Visual study of the museum's public 28.3 s scan video (1, 3, 6, 9, 11, 14,
// 16, 18, 21, 23, 26 s) and the supplied three-face colour photographs.
// These are authored coordinates, not recovered scan vertices or measurements.
export const artifactHeight=1.58;
const TAU=Math.PI*2,firstFace=Math.PI/4,paramRadius=.54;
const profile=[
  [.440,0],[.444,.026],[.426,.070],[.413,.18],[.414,.34],
  [.432,.49],[.490,.65],[.540,.83],[.560,.99],[.552,1.12],
  [.520,1.26],[.454,1.38],[.350,1.455],[.219,1.495],
  [.126,1.515],[.114,1.545],[.120,artifactHeight],
];
function radius(y){
  let i=1;while(i<profile.length-1&&profile[i][1]<y)i++;
  const a=profile[i-1],b=profile[i],p=profile[Math.max(0,i-2)],n=profile[Math.min(profile.length-1,i+1)];
  const span=b[1]-a[1],t=T.MathUtils.clamp((y-a[1])/span,0,1);
  const ma=(b[0]-p[0])/(b[1]-p[1]),mb=(n[0]-a[0])/(n[1]-a[1]);
  return (2*t**3-3*t*t+1)*a[0]+(t**3-2*t*t+t)*span*ma+(-2*t**3+3*t*t)*b[0]+(t**3-t*t)*span*mb;
}
const angleDistance=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const bell=(x,s)=>Math.exp(-((x/s)**2));
function surface(u,y,inset=0){
  const v=y/artifactHeight;
  let relief=(.010*Math.sin(2*u+.5)+.006*Math.sin(5*u+y*6))*Math.sin(Math.PI*v);
  for(let face=0;face<3;face++){
    const du=angleDistance(u,firstFace+face*TAU/3);
    relief+=.018*bell(du,.12)*bell(y-1.12,.14);
    relief-=.013*bell(du-.23,.20)*bell(y-.88,.24);
    relief-=.009*bell(du+.24,.18)*bell(y-1.14,.13);
    const ear=angleDistance(u,firstFace+face*TAU/3+Math.PI/3);
    relief+=.028*bell(ear,.055)*bell(y-1.37,.032);
  }
  const neck=T.MathUtils.smoothstep(y,1.49,artifactHeight);
  const rimWarp=neck*(.0025*Math.sin(7*u)+.0015*Math.sin(13*u+1));
  const r=radius(y)+relief-inset;
  return new T.Vector3(Math.sin(u)*r+.009*Math.sin(Math.PI*v),y+rimWarp,Math.cos(u)*r+.008*Math.sin(Math.PI*v*1.4));
}
function surfaceNormal(u,y,inset=0){
  const e=.0001,du=surface(u+e,y,inset).sub(surface(u-e,y,inset));
  const dy=surface(u,Math.min(artifactHeight,y+e),inset).sub(surface(u,Math.max(0,y-e),inset));
  return du.cross(dy).normalize().multiplyScalar(inset? -1:1);
}

// Each side has its own cut contours and slopes, including a nearly closed
// horizontal mouth and two different leaf-shaped openings.
const eye=[[-1,0],[-.72,.67],[-.15,.88],[.52,.55],[1,-.02],[.56,-.67],[-.10,-.76],[-.74,-.41]];
const mouth=[[-1,0],[-.58,.58],[-.08,.83],[.40,.56],[1,.08],[.60,-.70],[.06,-.85],[-.61,-.51]];
const slit=[[-1,.10],[-.55,.58],[.08,.62],[.73,.47],[1,-.02],[.50,-.59],[-.19,-.42],[-.76,-.55]];
const round=Array.from({length:12},(_,i)=>{const a=-i/12*TAU;return [Math.cos(a)*(1+.05*Math.sin(i*2)),Math.sin(a)*(1+.05*Math.cos(i*3))];});
const faces=[
  {eyeY:[1.235,1.248],eyeW:[.101,.106],eyeH:[.024,.019],eyeTilt:[-.09,.20],noseY:[1.100,1.086],mouthY:.954,mouthW:.137,mouthH:.031,mouthTilt:.055},
  {eyeY:[1.242,1.247],eyeW:[.104,.111],eyeH:[.017,.015],eyeTilt:[-.06,.13],noseY:[1.112,1.105],mouthY:.925,mouthW:.129,mouthH:.010,mouthTilt:.015},
  {eyeY:[1.249,1.228],eyeW:[.099,.104],eyeH:[.020,.030],eyeTilt:[-.04,.19],noseY:[1.110,1.097],mouthY:.968,mouthW:.124,mouthH:.025,mouthTilt:-.03},
];

export function buildFaceArtifact(){
  const root=new T.Group();root.name='Sowolri scan-video-informed three face pottery';
  root.userData.provenance='Authored from public scan video and photographs; not measured scan data';
  root.userData.reference='https://www.instagram.com/reel/DOLEa8RE4-2/';
  const holes=[];
  function aperture(name,u,y,w,h,tilt,outline,seed,kind){
    const curve=new T.CatmullRomCurve3(outline.map(([x,z])=>new T.Vector3(x,z,0)),true,'centripetal');
    const points=Array.from({length:48},(_,i)=>{
      const p=curve.getPoint(i/48),jitter=1+.012*Math.sin(i*2.3+seed);
      const x=p.x*w*jitter;
      return new T.Vector2((u+x/radius(y))*paramRadius,y+p.y*h*jitter+tilt*x);
    });
    holes.push({name,u,y,points,kind});
  }
  for(let face=0;face<3;face++){
    const u=firstFace+face*TAU/3,f=faces[face];
    for(let s=0;s<2;s++){
      const side=s?1:-1;
      aperture(`Face ${face+1} ${s?'right':'left'} eye`,u+side*.35,f.eyeY[s],f.eyeW[s],f.eyeH[s],f.eyeTilt[s],eye,face*3+s,'eye');
      aperture(`Face ${face+1} ${s?'right':'left'} nostril`,u+side*.155,f.noseY[s],.024+s*.002,.031-s*.003,side*.13,round,face*5+s,'nostril');
    }
    aperture(`Face ${face+1} mouth`,u,f.mouthY,f.mouthW,f.mouthH,f.mouthTilt,face===1?slit:mouth,face+9,'mouth');
    aperture(`Side opening ${face+1}`,u+Math.PI/3,1.174+face*.006,.063,.078,-.09+face*.06,round,face+14,'ear');
  }
  const outer=new T.MeshStandardMaterial({color:0xffffff,roughness:.96});
  outer.name='Sowol charcoal clay with vertical paddle impressions';outer.userData.artifactSurface='exterior';
  const inner=new T.MeshStandardMaterial({color:0x30332f,roughness:.97});inner.name='Continuous unglazed interior';
  function add(name,coords,indices,mat,uv,normals){
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(coords.flatMap(v=>v.toArray()),3));
    geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices.flat());geo.computeVertexNormals();
    if(normals)geo.setAttribute('normal',new T.Float32BufferAttribute(normals.flatMap(v=>v.toArray()),3));
    const m=new T.Mesh(geo,mat);m.name=name;root.add(m);return m;
  }
  const toUV=p=>[p.x/paramRadius/TAU,p.y/artifactHeight];
  const scaledPoint=(hole,p,scale)=>new T.Vector2(hole.u*paramRadius+(p.x-hole.u*paramRadius)*scale,hole.y+(p.y-hole.y)*scale);
  const segments=192;
  // Clip openings into small regular surface cells. This avoids the long,
  // almost collinear triangles between separate eyes and nostrils.
  // The outside opening meets the lip's outer edge, without overlapping clay.
  for(const inside of [false,true]){
    const points=[],triangles=[],vertexIds=new Map();
    const cutouts=holes.map(h=>{
      const ring=h.points.map(p=>scaledPoint(h,p,inside?1:h.kind==='ear'?1.33:1.18).toArray());
      return {ring,minX:Math.min(...ring.map(p=>p[0])),maxX:Math.max(...ring.map(p=>p[0])),minY:Math.min(...ring.map(p=>p[1])),maxY:Math.max(...ring.map(p=>p[1]))};
    });
    const ys=[...new Set([...Array.from({length:129},(_,i)=>i/128*artifactHeight),...profile.map(p=>p[1])])].sort((a,b)=>a-b);
    function vertex(p){
      const key=`${p.x.toFixed(9)}:${p.y.toFixed(9)}`;
      if(!vertexIds.has(key)){vertexIds.set(key,points.length);points.push(p);}
      return vertexIds.get(key);
    }
    for(let row=0;row<ys.length-1;row++)for(let col=0;col<segments;col++){
      const x0=col/segments*TAU*paramRadius,x1=(col+1)/segments*TAU*paramRadius,y0=ys[row],y1=ys[row+1];
      const clips=cutouts.filter(h=>h.minX<x1&&h.maxX>x0&&h.minY<y1&&h.maxY>y0);
      const cell=[[[x0,y0],[x1,y0],[x1,y1],[x0,y1]]];
      const pieces=clips.length?polygonClipping.difference(cell,...clips.map(h=>[h.ring])):[cell];
      for(const polygon of pieces){
        const rings=polygon.map(r=>r.map(p=>new T.Vector2(...p)));
        for(const r of rings)if(r.length>1&&r[0].equals(r.at(-1)))r.pop();
        const ids=rings.flat().map(vertex),faces=T.ShapeUtils.triangulateShape(rings[0],rings.slice(1));
        triangles.push(...faces.map(t=>t.map(i=>ids[i])));
      }
    }
    const coords=points.map(p=>surface(p.x/paramRadius,p.y,inside?.030:0));
    const ids=inside?triangles.map(([a,b,c])=>[a,c,b]):triangles;
    const normals=points.map(p=>surfaceNormal(p.x/paramRadius,p.y,inside?.030:0));
    add(inside?'Continuous inner wall':'Perforated stamped body',coords,ids,inside?inner:outer,points.flatMap(toUV),normals);
  }
  for(const hole of holes){
    const vertices=[],uv=[],indices=[],n=hole.points.length;
    const ear=hole.kind==='ear',nose=hole.kind==='nostril';
    // A flared clay sleeve joins the pierced body. No floating torus or dark cap.
    const rings=ear?[[1.33,0],[1.25,-.033],[1.07,-.065],[.94,-.071],[.90,-.055],[1,.030]]:
      [[1.18,0],[1.04,-(nose?.007:hole.kind==='mouth'?.012:.009)],[1,.030]];
    for(const [scale,depth] of rings)for(let i=0;i<n;i++){
      const q=scaledPoint(hole,hole.points[i],scale);
      const wear=ear?1+.04*Math.sin(i/n*TAU*3)+.02*Math.sin(i/n*TAU*7):1;
      vertices.push(surface(q.x/paramRadius,q.y,depth<0?depth*wear:depth));uv.push(...toUV(q));
    }
    for(let j=0;j<rings.length-1;j++)for(let i=0;i<n;i++){
      const a=j*n+i,b=j*n+(i+1)%n,c=a+n,d=b+n;indices.push([a,c,b],[b,c,d]);
    }
    const collar=add(hole.name+' clay edge',vertices,indices,outer,uv);collar.userData.opening={u:hole.u,y:hole.y,kind:hole.kind};
    const normals=collar.geometry.attributes.normal;
    for(const row of [0,rings.length-1])for(let i=0;i<n;i++){
      const p=scaledPoint(hole,hole.points[i],rings[row][0]),v=surfaceNormal(p.x/paramRadius,p.y,row?.030:0);
      normals.setXYZ(row*n+i,...v.toArray());
    }
  }
  // The scan shows a completely open underside with a flared, thick edge.
  for(const y of [0,artifactHeight]){
    const vertices=[],uv=[],indices=[],n=segments;
    for(const inset of [0,.010,.030])for(let i=0;i<=n;i++){
      const u=i/n*TAU,p=surface(u,y,inset);if(y===artifactHeight&&inset===.010)p.y+=.004;
      vertices.push(p);uv.push(i/n,y/artifactHeight);
    }
    for(let row=0;row<2;row++)for(let i=0;i<n;i++){
      const a=row*(n+1)+i,b=a+1,c=a+n+1,d=c+1;indices.push(...(y===0?[[a,c,b],[b,c,d]]:[[a,b,c],[b,d,c]]));
    }
    add(y===0?'Open flared basal rim':'Uneven short neck rim',vertices,indices,outer,uv);
  }
  root.rotation.y=-firstFace;root.userData.faces=3;root.userData.openings=holes.length;
  root.userData.openingCentres=holes.map(({u,y,kind})=>({u,y,kind}));return root;
}
