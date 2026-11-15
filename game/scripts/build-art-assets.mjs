// Editable asset authoring source. Runtime loads the resulting GLBs; it does not
// rebuild these objects. Photo-informed proportions are interpretations, not scans.
import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {mkdir,writeFile} from 'node:fs/promises';
import {buildScenes} from './scene-art.mjs';
import {buildFaceArtifact} from './face-artifact.mjs';
import {finishFaceArtifactGlb} from './face-artifact-material.mjs';
import {finishSiruArtifactGlb} from './siru-artifact-material.mjs';

globalThis.FileReader=class{
  async readAsArrayBuffer(blob){this.result=await blob.arrayBuffer();this.onloadend?.();}
  async readAsDataURL(blob){this.result=`data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`;this.onloadend?.();}
};
const out=new URL('../asset/runtime/models/',import.meta.url);
await mkdir(out,{recursive:true});
const material=(name,color,surface,roughness=.85,metalness=0)=>{
  const m=new T.MeshStandardMaterial({color,roughness,metalness});m.name=name;
  if(surface)m.userData.surface=surface;return m;
};
const clay=material('Granular gray earthenware',0xe3ded3,'grayware',.96);
const darkClay=material('Smoke fired gray earthenware',0x929b99,'grayware',.94);
const brownClay=material('Warm fired earthenware',0xcfb69b,'grayware',.95);
const wood=material('Oiled oak',0xe4d5bd,'aged-oak',.67);
const darkWood=material('Endgrain and worn timber',0x9b8062,'aged-oak',.82);
const toolWood=material('Polished honey maple tools',0xd8a66e,null,.48);
const trayFrame=material('Dark walnut tray frame',0x62483c,'aged-oak',.72);
const toolLiner=material('Muted blue linen tool lining',0x728f98,'linen',1);
const archiveFrame=material('Warm gray archival tray',0xc3c9c8,null,.88);
const archiveLiner=material('Charcoal felt sherd lining',0x555f63,'linen',1);
const plaster=material('Lime plaster',0xf3efe3,'plaster');
const linen=material('Unbleached linen',0xf0e4cf,'linen',.99);
const earth=material('Excavation soil',0xc6ad8c,'earth',1);
const stone=material('Weathered stone',0x7c817a,'grayware',.97);
const bronze=material('Dark brushed metal',0x655b49,null,.46,.65);
const black=material('Dark blue gallery finish',0x162a35,'plaster',.84);
const amber=material('Terracotta exhibit panel',0xb46032,'plaster',.83);
const cream=material('Warm paper',0xece3cf,'linen',.94);
const lamp=material('Warm diffuser',0xffefd5,null,.6);lamp.emissive.set(0xffdfaa);lamp.emissiveIntensity=.65;
const group=name=>{const g=new T.Group();g.name=name;return g;};
function mesh(g,name,geo,mat,x=0,y=0,z=0){const m=new T.Mesh(geo,mat);m.name=name;m.position.set(x,y,z);g.add(m);return m;}
function box(g,name,w,h,d,mat,x=0,y=0,z=0,r=.012){
  const geo=r?new RoundedBoxGeometry(w,h,d,1,Math.min(r,w/4,h/4,d/4)):new T.BoxGeometry(w,h,d);
  // Real-scale UVs: timber fibers do not stretch across entire walls or benches.
  const p=geo.getAttribute('position'),n=geo.getAttribute('normal'),uv=geo.getAttribute('uv');
  for(let i=0;i<p.count;i++){
    const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i));
    if(ny>.7)uv.setXY(i,p.getX(i)*1.2,p.getZ(i)*.65);
    else if(nx>.7)uv.setXY(i,p.getZ(i)*1.2,p.getY(i)*.65);
    else uv.setXY(i,p.getX(i)*1.2,p.getY(i)*.65);
  }
  return mesh(g,name,geo,mat,x,y,z);
}
function lathe(g,name,profile,mat=clay,segments=48){
  const geo=new T.LatheGeometry(profile.map(([r,y])=>new T.Vector2(r,y)),segments);
  const p=geo.getAttribute('position');
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),a=Math.atan2(x,z);
    const k=1+.004*Math.sin(a*3+y*5)+.002*Math.sin(a*7-y*4);
    p.setXYZ(i,x*k,y+.0007*Math.sin(a*5),z*k);
  }
  geo.computeVertexNormals();return mesh(g,name,geo,mat);
}
function ring(g,name,r,y,t=.006,mat=clay){const m=mesh(g,name,new T.TorusGeometry(r,t,6,48),mat,0,y,0);m.rotation.x=Math.PI/2;return m;}
function smooth(points,steps=32){
  const curve=new T.SplineCurve(points.map(([r,y])=>new T.Vector2(r,y)));
  return curve.getPoints(steps).map(p=>[Math.max(.0005,p.x),p.y]);
}
function vessel(name,profile,{mat=clay,foot=0,rings=[],horns=false}={}){
  const g=group(name),outer=smooth(profile),[topR,topY]=profile.at(-1);
  const inner=outer.slice().reverse().map(([r,y])=>[Math.max(.008,r-.012),Math.max(foot+.02,y-.005)]);
  lathe(g,'Hand thrown body with inner wall',[[.001,foot],...outer,[topR-.006,topY+.003],...inner,[.001,foot+.02]],mat);
  for(const [r,y,t]of rings)ring(g,'Thrown cordon',r,y,t,mat);
  if(horns)for(const side of [-1,1]){
    const curve=new T.CatmullRomCurve3([new T.Vector3(side*.26,.29,0),new T.Vector3(side*.32,.32,0),new T.Vector3(side*.37,.34,0)]);
    mesh(g,'Short projecting lug',new T.TubeGeometry(curve,12,.018,10,false),mat);
  }
  return g;
}
// Perforated stands have actual open windows and visible thickness on every edge.
function pedestal(g,{bottom=.25,top=.15,height=.18,holes=6,triangle=false,mat=clay}={}){
  const rows=12,cols=72,pos=[],uv=[],indices=[],thickness=.016;
  const kept=(j,i)=>{
    const v=(j+.5)/rows,u=((i+.5)/cols*holes)%1;
    if(v<.17||v>.83)return true;
    const half=triangle?(1-(v-.17)/.66)*.29:.20;
    return Math.abs(u-.5)>half;
  };
  for(let side=0;side<2;side++)for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
    const v=j/rows,a=i/cols*Math.PI*2,r=bottom+(top-bottom)*v-thickness*side;
    pos.push(Math.sin(a)*r,v*height,Math.cos(a)*r);uv.push(i/cols,v);
  }
  const stride=cols+1,offset=(rows+1)*stride;
  const quad=(a,b,c,d,flip=false)=>indices.push(...(flip?[a,c,b,b,c,d]:[a,b,c,b,d,c]));
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
    if(!kept(j,i))continue;
    const a=j*stride+i,b=a+1,c=a+stride,d=c+1;
    quad(a,c,b,d);quad(a+offset,b+offset,c+offset,d+offset);
    if(j===0||!kept(j-1,i))quad(a,b,a+offset,b+offset);
    if(j===rows-1||!kept(j+1,i))quad(c,c+offset,d,d+offset);
    if(!kept(j,(i+cols-1)%cols))quad(a,a+offset,c,c+offset);
    if(!kept(j,(i+1)%cols))quad(b,d,b+offset,d+offset);
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();
  mesh(g,'Openwork pedestal with wall thickness',geo,mat);
  ring(g,'Foot rolled edge',bottom,.009,.009,mat);ring(g,'Foot upper cordon',top,height-.006,.006,mat);
}
const pottery=[];
const longneck=vessel('Long neck ringed pedestal jar',[[.055,.17],[.16,.2],[.255,.31],[.255,.47],[.16,.56],[.12,.62],[.12,.84],[.145,.87]],{foot:.17,rings:[[.123,.65,.006],[.123,.7,.005],[.125,.76,.005],[.137,.83,.005]]});pedestal(longneck,{bottom:.21,top:.09,height:.18,holes:6});pottery.push(['ring-neck-jar',longneck]);
const hornjar=vessel('Wide shoulder jar with two lugs',[[.08,.14],[.2,.2],[.29,.34],[.285,.42],[.235,.47],[.19,.58],[.19,.72]],{foot:.14,horns:true,rings:[[.286,.435,.006],[.193,.585,.005]]});pedestal(hornjar,{bottom:.205,top:.11,height:.16,holes:5});pottery.push(['lug-pedestal-jar',hornjar]);
const highbowl=vessel('Open bowl on pierced high foot',[[.08,.27],[.21,.3],[.29,.43],[.31,.55],[.315,.58]],{foot:.27,mat:darkClay,rings:[[.31,.565,.004,darkClay]]});pedestal(highbowl,{bottom:.25,top:.09,height:.29,holes:6,triangle:true,mat:darkClay});pottery.push(['pierced-high-bowl',highbowl]);
pottery.push(['round-storage-jar',vessel('Globular storage vessel',[[.09,0],[.21,.08],[.30,.28],[.27,.48],[.13,.57],[.125,.66],[.16,.69]],{mat:brownClay,rings:[[.16,.69,.007]]})]);
pottery.push(['small-neck-jar',vessel('Small narrow mouth vessel',[[.065,0],[.17,.05],[.23,.23],[.19,.36],[.09,.43],[.10,.49]],{mat:darkClay})]);
pottery.push(['low-foot-cup',vessel('Low footed cup',[[.12,0],[.11,.045],[.065,.09],[.12,.13],[.21,.23],[.225,.28]],{mat:clay})]);
const lid=group('Conical lid with ring knop');lathe(lid,'Lid',[[.25,0],[.255,.012],[.24,.026],[.16,.09],[.06,.125],[.015,.13],[.015,.115],[.16,.077],[.24,.012]],darkClay);lathe(lid,'Open ring knop',[[.025,.127],[.04,.14],[.04,.18],[.025,.18],[.025,.14]],darkClay);pottery.push(['ring-knop-lid',lid]);
const tall=vessel('Slender flared neck vessel',[[.08,.15],[.2,.22],[.24,.4],[.18,.52],[.11,.58],[.1,.76],[.17,.86]],{foot:.15,mat:brownClay,rings:[[.104,.68,.005],[.11,.75,.005]]});pedestal(tall,{bottom:.19,top:.08,height:.17,holes:5,mat:brownClay});pottery.push(['flared-neck-jar',tall]);

function brush(name='Soft excavation brush'){
  const g=group(name);lathe(g,'Turned wooden handle',[[.004,0],[.015,.025],[.013,.19],[.018,.22]],trayFrame,24);
  mesh(g,'Brush ferrule',new T.CylinderGeometry(.022,.018,.06,24),bronze,0,.245,0);
  for(let i=0;i<25;i++){const a=i*2.4,r=.018*Math.sqrt(i/25);mesh(g,'Individual bristle tuft',new T.CylinderGeometry(.002,.0035,.075+(i%3)*.005,5),linen,Math.sin(a)*r,.31,Math.cos(a)*r);}
  return g;
}
function rib(name,points){const g=group(name),s=new T.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();const hole=new T.Path();hole.absarc(0,0,.015,0,Math.PI*2,true);s.holes.push(hole);const m=mesh(g,name,new T.ExtrudeGeometry(s,{depth:.018,bevelEnabled:true,bevelSize:.007,bevelThickness:.004,bevelSegments:2,steps:1}),toolWood);m.rotation.x=-Math.PI/2;return g;}
const tools=[['soft-brush',brush()],['oval-rib',rib('Oval shaping rib',Array.from({length:36},(_,i)=>[Math.cos(i/36*Math.PI*2)*.095,Math.sin(i/36*Math.PI*2)*.16]))],['kidney-rib',rib('Kidney shaping rib',[[-.06,-.15],[.055,-.11],[.10,.02],[.06,.14],[-.03,.12],[-.065,.04],[-.03,-.03]])]];
const bowl=vessel('Water bowl',[[.065,0],[.11,.012],[.16,.07],[.17,.12]],{mat:brownClay});const water=material('Water',0x466368,null,.18,.15);mesh(bowl,'Water surface',new T.CircleGeometry(.142,48),water,0,.085,0).rotation.x=-Math.PI/2;tools.push(['water-bowl',bowl]);
const spool=group('Coiled cutting wire');for(let i=0;i<4;i++)ring(spool,'Wire coil',.065+i*.004,.012+i*.003,.0025,bronze);for(const x of [-.14,.14])mesh(spool,'Wooden wire grip',new T.CapsuleGeometry(.014,.09,4,12),wood,x,.018,0).rotation.z=Math.PI/2;tools.push(['wire-cutter',spool]);
const roll=group('Clay coil');const path=new T.CatmullRomCurve3(Array.from({length:80},(_,i)=>{const a=i/79*Math.PI*4,r=.05+i/79*.09;return new T.Vector3(Math.cos(a)*r,.025,Math.sin(a)*r);}));mesh(roll,'Continuous soft clay coil',new T.TubeGeometry(path,96,.022,10,false),brownClay);tools.push(['clay-coil',roll]);
const folded=group('Folded linen');for(let i=0;i<3;i++){const geo=new T.PlaneGeometry(.43,.34,14,12),p=geo.getAttribute('position');for(let j=0;j<p.count;j++){p.setZ(j,.005*Math.sin(p.getX(j)*35+p.getY(j)*21)+i*.008);}geo.computeVertexNormals();const m=mesh(folded,'Soft folded cloth',geo,linen,0,.008,0);m.rotation.x=-Math.PI/2;}tools.push(['folded-cloth',folded]);
const tray=group('Lined walnut tool tray');box(tray,'Tray base',.70,.018,.44,trayFrame);
box(tray,'Blue woven tool cushion',.65,.012,.39,toolLiner,0,.014,0,.004);
for(const x of [-.35,.35])box(tray,'Tray raised end',.025,.055,.45,trayFrame,x,.022);
for(const z of [-.22,.22])box(tray,'Tray raised side',.7,.055,.025,trayFrame,0,.022,z);
tools.push(['tool-tray',tray]);
const mat=group('Linen work mat');const matgeo=new T.PlaneGeometry(1.48,1.16,24,18),mp=matgeo.getAttribute('position');for(let i=0;i<mp.count;i++)mp.setZ(i,.003*Math.sin(mp.getX(i)*32)*Math.cos(mp.getY(i)*19));matgeo.computeVertexNormals();mesh(mat,'Woven mat with soft edge',matgeo,linen,0,.008,0).rotation.x=-Math.PI/2;tools.push(['work-mat',mat]);
const slab=group('Padded archaeological sherd tray');box(slab,'Archival tray',.56,.025,.39,archiveFrame);
box(slab,'Dark felt backing',.51,.01,.34,archiveLiner,0,.018,0,.003);
for(const x of [-.28,.28])box(slab,'Archival raised end',.018,.045,.4,archiveFrame,x,.026);
for(const z of [-.195,.195])box(slab,'Archival raised side',.56,.045,.018,archiveFrame,0,.026,z);
for(let i=0;i<7;i++){
  const shape=new T.Shape(),n=5+i%3,r=.038+i%3*.007;
  for(let j=0;j<n;j++){const a=j/n*Math.PI*2,rr=r*(.78+.22*Math.sin(i*3.7+j*2.2));const x=Math.cos(a)*rr,z=Math.sin(a)*rr;j?shape.lineTo(x,z):shape.moveTo(x,z);}shape.closePath();
  const geo=new T.ExtrudeGeometry(shape,{depth:.012+i%3*.004,bevelEnabled:true,bevelSize:.002,bevelThickness:.002,bevelSegments:1,steps:1});
  const m=mesh(slab,'Broken ceramic fragment',geo,i%2?clay:brownClay,(i%4-1.5)*.115,.025,(Math.floor(i/4)-.5)*.15);
  m.rotation.x=-Math.PI/2;m.rotation.z=i*.9;
}
tools.push(['sherd-tray',slab]);
function place(root,object,x,y,z,scale=1,rotation=0){const o=object.clone();o.position.set(x,y,z);o.scale.setScalar(scale);o.rotation.y=rotation;root.add(o);return o;}

const bench=group('Craft bench with worn oak boards');
for(let i=0;i<8;i++)box(bench,'Solid oak worktop plank',.49,.10,2.8,wood,(i-3.5)*.492,-.055,.45);
for(const x of [-1.64,1.64])for(const z of [-.62,1.5])box(bench,'Bench leg',.14,1.12,.14,darkWood,x,-.65,z);
box(bench,'Front bench apron',3.55,.23,.10,darkWood,0,-.2,1.62);
box(bench,'Back bench apron',3.55,.23,.10,darkWood,0,-.2,-.75);
const dressing=group('Craft tools arranged for use');
place(dressing,mat,0,0,0);place(dressing,tray,-1.15,.012,-.4,1,.12);
place(dressing,tools[1][1],-1.34,.04,-.43,1,.8);place(dressing,tools[2][1],-1.06,.04,-.38,1,-.4);
const lyingBrush=place(dressing,brush(),-1.22,.05,-.58,1,-.3);lyingBrush.rotation.x=Math.PI/2;
place(dressing,spool,-1.22,.015,.12);place(dressing,folded,1.16,.02,-.31,1,-.2);place(dressing,bowl,1.39,.01,.11);place(dressing,roll,.96,.015,.22,.85);place(dressing,slab,1.15,.016,-.8,1,-.1);

const room=group('Museum craft studio architecture');
// Window opening and joinery; side-facing panels are kept behind the work area.
box(room,'Lower plaster wall',9,1.35,.14,plaster,0,-.42,-2.65);
box(room,'Upper plaster wall',9,1.0,.14,plaster,0,3.48,-2.65);
for(const x of [-3.05,3.05])box(room,'Side plaster wall',2.9,2.45,.14,plaster,x,1.45,-2.65);
for(const x of [-1.64,1.64])box(room,'Window jamb',.12,2.20,.24,wood,x,1.68,-2.59);
for(const y of [.57,2.78])box(room,'Window sill and lintel',3.44,.12,.3,wood,0,y,-2.55);
box(room,'Window centre mullion',.055,2.15,.12,wood,0,1.68,-2.57);
box(room,'Window crossbar',3.2,.052,.12,wood,0,1.5,-2.57);
for(const x of [-2.5,2.5]){
  box(room,'Cabinet dark backing',1.5,2.45,.10,darkWood,x,1.1,-2.43);
  for(const sx of [-.76,.76])box(room,'Cabinet stile',.075,2.5,.40,wood,x+sx,1.1,-2.29);
  for(const y of [-.1,.62,1.38,2.22])box(room,'Cabinet oak shelf',1.6,.07,.5,wood,x,y,-2.18);
  for(const y of [.58,1.34,2.18])box(room,'Under-shelf warm strip',1.36,.015,.018,lamp,x,y,-2.05);
}
for(let i=0;i<20;i++)box(room,'Floor plank',.45,.05,9,wood,(i-9.5)*.452,-1.25,0);
const display=group('Photo informed ceramic collection');
for(let side=0;side<2;side++)for(let row=0;row<3;row++)for(let i=0;i<3;i++){
  const index=(side*3+row*2+i)%pottery.length;
  place(display,pottery[index][1],(side?2.5:-2.5)+(i-1)*.47,[-.06,.66,1.42][row],-2.14,.66+((index+row)%3)*.05,(side?-.3:.3)+i*.11);
}
// Pots near the window keep the centre of the room inhabited even on a narrow screen.
place(display,pottery[4][1],-.93,.64,-2.48,.72,.1);place(display,pottery[5][1],.91,.64,-2.48,.85,-.2);

const gallery=group('Gallery architecture and display furniture');
for(let i=0;i<25;i++)box(gallery,'Gallery timber floor',.38,.05,12,wood,(i-12)*.382,-.35,-1);
box(gallery,'Deep blue exhibition wall',10,4.5,.15,black,0,1.85,-2.75);
for(const x of [-3,0,3]){
  box(gallery,'Recessed warm exhibit panel',1.45,2.6,.06,amber,x,1.3,-2.64);
  box(gallery,'Museum display ledge',1.9,.10,.7,darkWood,x,.28,-2.18);
  box(gallery,'Display lighting',1.6,.025,.06,lamp,x,2.7,-2.20);
}
for(const x of [-.78,.9]){
  const plinth=lathe(gallery,'Circular plinth',[[.001,-.31],[.61,-.31],[.61,-.03],[.59,0],[.001,0]],black);
  plinth.position.x=x;ring(gallery,'Brushed display rim',.60,-.015,.006,bronze).position.x=x;
}
const collection=group('Gallery side exhibits');
for(const side of [-1,1])for(let i=0;i<4;i++)place(collection,pottery[(i+(side>0?3:0))%pottery.length][1],side*(2.35+i%2*.58),.335,-2.03+Math.floor(i/2)*.22,.8,side*.25);
place(collection,pottery[1][1],0,.335,-2.08,.85);

const field=group('Excavation equipment');
place(field,tray,2.05,0,-.2,1.4,.3);place(field,slab,2.05,.06,-.2,1.2,.3);
const fb=place(field,brush(),-1.96,.035,-.4,1.8,.5);fb.rotation.x=Math.PI/2;
place(field,folded,-2.15,.015,.2,1.5,.15);
for(let i=0;i<9;i++){
  const a=i/9*Math.PI*2,x=Math.cos(a)*2.15,z=Math.sin(a)*1.9;
  box(field,'Survey peg',.045,.25,.045,wood,x,.11,z);
  const b=(i+1)/9*Math.PI*2;
  const curve=new T.LineCurve3(new T.Vector3(x,.2,z),new T.Vector3(Math.cos(b)*2.15,.2,Math.sin(b)*1.9));
  mesh(field,'Survey cord',new T.TubeGeometry(curve,1,.004,5,false),cream);
}
for(let i=0;i<16;i++){
  const a=i*2.4,r=3+i%3*.5,m=mesh(field,'Rounded field stone',new T.IcosahedronGeometry(.12+(i%3)*.035,2),stone,Math.sin(a)*r,.04,Math.cos(a)*r);
  m.scale.set(1.4,.55,1);m.rotation.set(i*.31,i*.7,0);
}
const kiln=group('Kiln stonework and fuel');
for(let i=0;i<9;i++){const m=mesh(kiln,'Stacked split firewood',new T.CylinderGeometry(.065,.075,.6,10),darkWood,1.65+i%3*.13,.06+Math.floor(i/3)*.12,.6+Math.floor(i/3)*.03);m.rotation.x=Math.PI/2;m.rotation.z=(i%2-.5)*.08;}
for(let i=0;i<10;i++){const m=mesh(kiln,'Earth set stones',new T.IcosahedronGeometry(.22,2),stone,(i%5-2)*.5,-.02,-1.85+Math.floor(i/5)*2.9);m.scale.set(1,.45,.7);}

// An earthen climbing-kiln interpretation. Separate shell and facade let the
// interactive cutaway open without hiding the fuel, floor or permanent wall.
const vault=group('Earthen kiln vault'),cut=group('Cutaway shell'),fixed=group('Permanent half');vault.add(cut,fixed);
const firedEarth=material('Weathered kiln earth',0xe4c9a9,'earth',1);
const soot=material('Soot darkened inner clay',0x66574b,'grayware',1);
for(let half=0;half<2;half++)for(let inner=0;inner<2;inner++){
  const rows=22,cols=32,pos=[],uv=[],indices=[];
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
    const a=(half+i/cols)*Math.PI/2,z=1.2-j/rows*3;
    const ripple=inner?0:.012*Math.sin(a*19+z*5)+.009*Math.cos(a*31-z*7);
    const r=1-inner*.085+ripple;
    pos.push(Math.cos(a)*1.2*r,Math.sin(a)*1.85*r+(1.2-z)*.08,z);
    uv.push(a*1.1,z*.7);
    if(j<rows&&i<cols){const k=j*(cols+1)+i;indices.push(k,k+cols+1,k+1,k+1,k+cols+1,k+cols+2);}
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();
  const mat=(inner?soot:firedEarth).clone();mat.side=T.DoubleSide;mesh(half===0?cut:fixed,inner?'Inner fired wall':'Uneven earthen vault',geo,mat);
}
const facade=new T.Shape();facade.moveTo(-1.2,0);facade.absellipse(0,0,1.2,1.85,Math.PI,0,true,0);facade.lineTo(-1.2,0);
const firemouth=new T.Path();firemouth.moveTo(-.35,.01);firemouth.lineTo(.35,.01);firemouth.lineTo(.35,.3);firemouth.absellipse(0,.3,.35,.3,0,Math.PI,false,0);firemouth.closePath();facade.holes.push(firemouth);
mesh(cut,'Thick earth facade with open firemouth',new T.ExtrudeGeometry(facade,{depth:.16,bevelEnabled:true,bevelSize:.018,bevelThickness:.018,bevelSegments:2,curveSegments:32}),firedEarth,0,0,1.2);
for(let i=0;i<11;i++){
  const a=i/10*Math.PI,m=box(cut,'Firemouth stone',.16,.13,.2,stone,Math.cos(a)*.44,.28+Math.sin(a)*.39,1.4,.025);m.rotation.z=a-Math.PI/2;
}
for(const side of [-1,1])for(let i=0;i<2;i++)box(cut,'Firemouth jamb',.16,.14,.21,stone,side*.44,.07+i*.13,1.4,.025);
for(let i=0;i<13;i++){
  const a=i/12*Math.PI,m=box(cut,'Exposed arch edging',.22,.12,.16,firedEarth,Math.cos(a)*1.12,Math.sin(a)*1.73+.035,1.36,.025);m.rotation.z=a-Math.PI/2;
}
box(fixed,'Earthen foundation',2.5,.12,3.2,soot,0,-.06,-.2,.04);
lathe(fixed,'Open chimney',[[.18,1.91],[.17,2.33],[.12,2.34],[.12,1.91]],soot,32).position.z=-1.55;

const grove=group('Natural foliage grove');
const leaves=material('Cutout leaf clusters',0xc6d4a8,'foliage',.95);leaves.side=T.DoubleSide;leaves.alphaTest=.45;
for(let i=0;i<10;i++){
  const a=-Math.PI*.7+i/9*Math.PI*1.4,r=5.2+i%3*.55,x=Math.sin(a)*r,z=-Math.cos(a)*r-2.2;
  const tree=group('Branching garden tree');tree.position.set(x,0,z);tree.rotation.y=a;grove.add(tree);
  const trunk=new T.CatmullRomCurve3([new T.Vector3(0,0,0),new T.Vector3(.08,.9,.04),new T.Vector3(-.02,1.7,.05),new T.Vector3(.12,2.5,0)]);
  mesh(tree,'Natural curved trunk',new T.TubeGeometry(trunk,12,.075,8,false),darkWood);
  for(let j=0;j<7;j++){
    const b=j*2.4,end=new T.Vector3(Math.sin(b)*.76,1.65+j*.13,Math.cos(b)*.76);
    const branch=new T.QuadraticBezierCurve3(new T.Vector3(0,1.1,0),new T.Vector3(end.x*.55,end.y-.15,end.z*.55),end);
    mesh(tree,'Branch',new T.TubeGeometry(branch,5,.022,6,false),darkWood);
    for(let k=0;k<3;k++){
      const card=mesh(tree,'Photographic leaf card',new T.PlaneGeometry(1.6,1.35),leaves,end.x,end.y+.24,end.z);
      card.rotation.set(k*.6,b+k*Math.PI/3,j*.2);card.scale.setScalar(.8+(j%3)*.14);
    }
  }
}
const assets=[...pottery,...tools,['craft-bench',bench],['craft-tools',dressing],['studio-room',room],['studio-collection',display],['gallery-room',gallery],['gallery-collection',collection],['excavation-kit',field],['kiln-dressing',kiln],['kiln-vault',vault],['garden-grove',grove]];
const manifest=[];
for(const [id,root]of assets){
  root.userData.provenance='Game art interpretation, 2026-11-15; not a measured artifact scan';
  const data=await new GLTFExporter().parseAsync(root,{binary:true,onlyVisible:false});
  await writeFile(new URL(`${id}-v2.glb`,out),Buffer.from(data));
  let vertices=0,triangles=0;root.traverse(o=>{if(o.isMesh){vertices+=o.geometry.attributes.position.count;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});
  manifest.push({id,file:`${id}-v2.glb`,bytes:data.byteLength,vertices,triangles});
}
await writeFile(new URL('../asset/source/model-manifest.json',import.meta.url),JSON.stringify(manifest,null,2)+'\n');
console.log(`Authored ${manifest.length} GLB assets; ${(manifest.reduce((n,a)=>n+a.bytes,0)/1024/1024).toFixed(2)} MiB including reusable standalone props.`);
const scenes=buildScenes({T,group,mesh,box,lathe,ring,place,material,pottery,tools,wood,darkWood,plaster,linen,bronze,lamp,clay,darkClay,vault,kiln,brush});
scenes.assets.push(['face-artifact',buildFaceArtifact()]);
const sceneManifest=[];
for(const [id,root]of scenes.assets){
  if(!['face-artifact','siru'].includes(id))root.userData.provenance='Photo-informed game environment; not a measured artifact scan';
  let data=await new GLTFExporter().parseAsync(root,{binary:true,onlyVisible:false});
  if(id==='face-artifact')data=finishFaceArtifactGlb(data);
  if(id==='siru')data=finishSiruArtifactGlb(data);
  const version=['face-artifact','siru'].includes(id)?'v4':'v3';
  await writeFile(new URL(`${id}-${version}.glb`,out),Buffer.from(data));
  sceneManifest.push({id,file:`${id}-${version}.glb`,bytes:data.byteLength});
}
await writeFile(new URL('../asset/source/scene-layout-v3.json',import.meta.url),JSON.stringify({models:sceneManifest,exhibits:scenes.records},null,2)+'\n');
console.log(`Authored ${sceneManifest.length} separated room, courtyard and support assets.`);
