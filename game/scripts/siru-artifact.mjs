import * as T from 'three';
import polygonClipping from 'polygon-clipping';

// KHS, 2019-12-03, attachment p.2: bottom-removed siru, two mid-body
// ox-horn lugs, broken narrow end and a continuous flared mouth. The model
// follows the photographed display orientation; these are not measured units.
const TAU=Math.PI*2,SCALE=.88,N=128,ROWS=80;
const profile=[[.50,0],[.507,.018],[.505,.036],[.482,.068],[.456,.12],
  [.428,.25],[.409,.42],[.399,.54],[.383,.70],[.353,.84],[.310,.95],[.274,1]];
function radius(y){
  let i=1;while(i<profile.length-1&&profile[i][1]<y)i++;
  const a=profile[i-1],b=profile[i],p=profile[Math.max(0,i-2)],n=profile[Math.min(profile.length-1,i+1)];
  const d=b[1]-a[1],t=T.MathUtils.clamp((y-a[1])/d,0,1);
  const ma=(b[0]-p[0])/(b[1]-p[1]),mb=(n[0]-a[0])/(n[1]-a[1]);
  return (2*t**3-3*t*t+1)*a[0]+(t**3-2*t*t+t)*d*ma+(-2*t**3+3*t*t)*b[0]+(t**3-t*t)*d*mb;
}
const rim=[[0,.912],[.21,.918],[.39,.931],[.54,.990],[.81,.987],[1.06,.979],
  [1.35,.974],[1.55,.943],[1.76,.938],[1.93,.978],[2.32,.984],[2.75,.992],
  [3.14,.998],[3.46,.982],[3.72,.951],[3.90,.965],[4.12,.987],[4.56,.978],
  [4.88,.938],[5.06,.949],[5.23,.979],[5.49,.981],[5.69,.961],[5.88,.923],[6.11,.909],[TAU,.912]];
function rimHeight(u){
  u=(u%TAU+TAU)%TAU;
  let i=1;while(i<rim.length-1&&rim[i][0]<u)i++;
  const a=rim[i-1],b=rim[i],t=(u-a[0])/(b[0]-a[0]);
  return a[1]+(b[1]-a[1])*t+.002*Math.sin(u*29)+.001*Math.sin(u*53);
}
function surface(u,v,inside=false){
  const y=v-(1-rimHeight(u))*T.MathUtils.smoothstep(v,.83,1);
  const uneven=(.004*Math.sin(u*3+.5)+.003*Math.sin(u*7+v*8))*Math.sin(Math.PI*v);
  const thickness=.033+.005*Math.cos(v*Math.PI);
  const r=radius(y)+uneven-(inside?thickness:0);
  return new T.Vector3(Math.sin(u)*r,y,Math.cos(u)*r).multiplyScalar(SCALE);
}
function normal(u,v,inside=false){
  const e=.0001,du=surface(u+e,v,inside).sub(surface(u-e,v,inside));
  const dy=surface(u,Math.min(1,v+e),inside).sub(surface(u,Math.max(0,v-e),inside));
  return du.cross(dy).normalize().multiplyScalar(inside?-1:1);
}
const chipU=TAU-.57;
const chip=[[chipU-.031,.731],[chipU+.031,.724],[chipU+.008,.674],[chipU-.012,.666]];

export function buildSiruArtifact(){
  const root=new T.Group();root.name='Sowolri bottom-removed siru with ox-horn lugs';
  root.userData={
    provenance:'Authored from KHS excavation photographs; proportions estimated, not a measured scan',
    reference:'https://www.khs.go.kr/newsBbz/selectNewsBbzView.do?newsItemId=155701798&sectionId=b_sec_1',
    removedBottom:true,handleCount:2,displayOrientation:'Flared mouth below, as photographed with the face vessel',
    missingSherd:{u:chipU,v:.704},
  };
  const outer=new T.MeshStandardMaterial({color:0xffffff,roughness:.96});
  outer.name='Siru grey-brown impressed clay';outer.userData.siruSurface='exterior';
  const inner=new T.MeshStandardMaterial({color:0x666155,roughness:.98});inner.name='Siru continuous clay interior';
  const fracture=new T.MeshStandardMaterial({color:0x83755c,roughness:1});fracture.name='Siru exposed clay breaks';
  function mesh(name,vertices,ids,material,uv,normals){
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices.flatMap(p=>p.toArray()),3));
    g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ids.flat());g.computeVertexNormals();
    if(normals)g.setAttribute('normal',new T.Float32BufferAttribute(normals.flatMap(p=>p.toArray()),3));
    const m=new T.Mesh(g,material);m.name=name;m.castShadow=m.receiveShadow=true;root.add(m);return m;
  }
  for(const inside of [false,true]){
    const points=[],ids=[],lookup=new Map();
    function vertex(p){
      const key=p.map(v=>v.toFixed(8)).join(':');
      if(!lookup.has(key)){lookup.set(key,points.length);points.push(p);}return lookup.get(key);
    }
    for(let row=0;row<ROWS;row++)for(let col=0;col<N;col++){
      const u0=col/N*TAU,u1=(col+1)/N*TAU,v0=row/ROWS,v1=(row+1)/ROWS;
      const cell=[[[u0,v0],[u1,v0],[u1,v1],[u0,v1]]];
      const cut=u0<chipU+.031&&u1>chipU-.031&&v0<.731&&v1>.666;
      const pieces=cut?polygonClipping.difference(cell,[chip]):[cell];
      for(const polygon of pieces){
        const rings=polygon.map(r=>r.map(p=>new T.Vector2(...p)));
        for(const r of rings)if(r[0].equals(r.at(-1)))r.pop();
        const index=rings.flat().map(p=>vertex(p.toArray()));
        for(const face of T.ShapeUtils.triangulateShape(rings[0],rings.slice(1))){
          const [a,b,c]=face.map(i=>index[i]);ids.push(inside?[a,c,b]:[a,b,c]);
        }
      }
    }
    mesh(inside?'Open inner shell':'Impressed tapering body',points.map(([u,v])=>surface(u,v,inside)),ids,inside?inner:outer,
      points.flatMap(([u,v])=>[u/TAU,v]),points.map(([u,v])=>normal(u,v,inside)));
  }
  // Join the two walls at the edges only. There is no intact floor, sieve
  // plate, floating foot ring or dark disk covering either opening.
  for(const v of [0,1]){
    const vertices=[],uv=[],ids=[];
    for(const inside of [false,true])for(let i=0;i<=N;i++){
      vertices.push(surface(i/N*TAU,v,inside));uv.push(i/N,v);
    }
    for(let i=0;i<N;i++){
      const a=i,b=i+1,c=i+N+1,d=c+1;
      ids.push(...(v?[[a,b,c],[b,d,c]]:[[a,c,b],[b,c,d]]));
    }
    mesh(v?'Broken removed-bottom edge':'Integrated flared mouth edge',vertices,ids,v?fracture:outer,uv);
  }
  const chipVertices=[],chipUV=[],chipIds=[];
  for(const inside of [false,true])for(const [u,v] of chip){chipVertices.push(surface(u,v,inside));chipUV.push(u/TAU,v);}
  for(let i=0;i<4;i++){const j=(i+1)%4;chipIds.push([i,j,i+4],[j,j+4,i+4]);}
  mesh('Missing sherd broken wall',chipVertices,chipIds,fracture,chipUV);

  for(const side of [-1,1]){
    // Broad, flattened clay roots narrow to a downturned solid horn tip.
    // The photographed handles are lugs, not tubular or loop handles.
    const stations=[
      [.354,.520,.077,.090],[.392,.526,.064,.084],[.438,.536,.053,.067],
      [.476,.524,.041,.052],[.518,.497,.025,.034],[.558,.480,.010,.015],[.566,.479,.001,.002],
    ],vertices=[],uv=[],ids=[],steps=24,lengthSteps=32;
    const centres=new T.CatmullRomCurve3(stations.map(([x,y])=>new T.Vector3(x,y,0)),false,'centripetal');
    const widths=new T.CatmullRomCurve3(stations.map(([, ,ry,rz])=>new T.Vector3(ry,rz,0)),false,'centripetal');
    for(let j=0;j<=lengthSteps;j++){
      const centre=centres.getPoint(j/lengthSteps),width=widths.getPoint(j/lengthSteps);
      const [x,y,ry,rz]=[centre.x,centre.y,Math.max(.001,width.x),Math.max(.002,width.y)];
      for(let i=0;i<=steps;i++){
        const a=i/steps*TAU,py=y+Math.cos(a)*ry+(side===1?j/lengthSteps*.0048:0),pz=Math.sin(a)*rz;
        vertices.push(new T.Vector3(side*x,py,pz).multiplyScalar(SCALE));
        let u=Math.atan2(side*x,pz);if(u<0)u+=TAU;uv.push(u/TAU,py);
      }
    }
    for(let j=0;j<lengthSteps;j++)for(let i=0;i<steps;i++){
      const a=j*(steps+1)+i,b=a+1,c=a+steps+1,d=c+1;
      ids.push(...(side===1?[[a,b,c],[b,d,c]]:[[a,c,b],[b,c,d]]));
    }
    const end=vertices.length;vertices.push(new T.Vector3(side*.5665,.479+(side===1?.0048:0),0).multiplyScalar(SCALE));uv.push(side===1?.25:.75,.479);
    for(let i=0;i<steps;i++){
      const a=lengthSteps*(steps+1)+i;ids.push(side===1?[a,a+1,end]:[a,end,a+1]);
    }
    const lug=mesh(side===1?'Right ox-horn lug':'Left ox-horn lug',vertices,ids,outer,uv);lug.userData.siruHandle=true;
  }
  return root;
}
