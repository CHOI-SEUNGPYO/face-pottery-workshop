// V3 scene composition: architectural boundaries, permanent supports and
// individual exhibit clearances are authored separately from removable walls.
import {buildSiruArtifact} from './siru-artifact.mjs';
export function buildScenes(c){
  const {T,group,mesh,box,lathe,ring,place,material,pottery,tools,wood,darkWood,plaster,linen,bronze,lamp,clay,darkClay,vault,kiln,brush}=c;
  const stone=material('Honed warm limestone',0xe7e4dd,'limestone',.9);
  const dark=material('Museum bronze charcoal',0x414742,null,.7,.1);
  const wallMat=material('Warm museum plaster',0xddd5c6,'plaster',.92);
  const panel=material('Muted clay interpretation panel',0xb18e69,null,.95);
  const navy=material('Museum sage gray case backing',0x62716e,null,.95);
  const museumWall=material('Warm gray museum wall',0xa49d8f,null,.98);
  const shelfWood=material('Pale exhibit shelving',0xc9c2ae,'limestone',.9);
  const glass=material('Clear exhibit glazing',0xc0dedf,null,.16);
  glass.transparent=true;glass.opacity=.045;glass.depthWrite=false;glass.side=T.DoubleSide;
  const soil=material('Courtyard compacted earth',0xaaa99a,'earth',1);
  const leaves=material('Natural leaf clusters',0x9ba68c,'foliage',1);leaves.side=T.DoubleSide;leaves.alphaTest=.5;
  const shrubMat=material('Planting bed',0x52664b,'earth',1);
  const records=[];
  function exhibit(g,index,x,y,z,scale=.7,angle=0){
    const p=place(g,pottery[index][1],x,y,z,scale,angle);p.updateMatrixWorld(true);
    const b=new T.Box3().setFromObject(p);p.position.y+=y-b.min.y;p.updateMatrixWorld(true);b.setFromObject(p);
    records.push({collection:g.name,index,supportY:y,min:b.min.toArray(),max:b.max.toArray()});return p;
  }
  function wall(g,name,x,z,angle,width,base,height,mat=wallMat){
    const p=group(name);p.position.set(x,0,z);p.rotation.y=angle;
    p.userData.wall=true;p.userData.inward=[Math.sin(angle),0,Math.cos(angle)];
    mesh(p,'Interior wall surface',new T.PlaneGeometry(width,height),mat,0,base+height/2,0);
    box(p,'Stone skirting',width,.12,.055,stone,0,base+.06,.028);
    box(p,'Wall ceiling reveal',width,.065,.055,darkWood,0,base+height-.04,.03);
    g.add(p);return p;
  }
  function tiledFloor(g,base,width=10,depth=10,z=0){
    box(g,'Permanent stone floor',width,.10,depth,stone,0,base-.05,z,.005);
    const grout=material('Fine limestone joints',0xbab6ac,null,1);
    for(let x=-width/2+1;x<width/2;x+=1)box(g,'Floor joint',.006,.002,depth,grout,x,base+.001,z,0);
    for(let dz=-depth/2+1;dz<depth/2;dz+=1)box(g,'Floor joint',width,.002,.006,grout,0,base+.001,z+dz,0);
  }
  const studio=group('Studio shell');tiledFloor(studio,-1.12,10,10,.8);
  const back=group('Studio window wall');back.position.z=-3.7;back.userData.wall=true;back.userData.inward=[0,0,1];studio.add(back);
  box(back,'Wall below window',10,1.62,.12,wallMat,0,-.31,0,.008);
  box(back,'Continuous wall above window',10,.6,.12,wallMat,0,2.6,0,.008);
  for(const x of [-3.4,3.4])box(back,'Wall beside window',3.2,1.8,.12,wallMat,x,1.4,0,.008);
  for(const x of [-1.82,1.82])box(back,'Recessed window jamb',.10,1.92,.20,wood,x,1.4,.06);
  for(const y of [.46,2.34])box(back,'Window sill and lintel',3.74,.10,.25,wood,0,y,.08);
  box(back,'Window mullion',.055,1.8,.12,wood,0,1.4,.06);
  box(back,'Window crossbar',3.6,.045,.12,wood,0,1.38,.06);
  const garden=material('Window courtyard',0xffffff,'garden',1);mesh(back,'Courtyard inside window opening',new T.PlaneGeometry(3.6,1.8),garden,0,1.4,-.07);
  box(back,'Continuous skirting',10,.12,.05,stone,0,-1.06,.08);
  wall(studio,'Studio left wall',-5,.8,Math.PI/2,9,-1.12,4.02);
  wall(studio,'Studio right wall',5,.8,-Math.PI/2,9,-1.12,4.02);
  wall(studio,'Studio entrance wall',0,5.3,Math.PI,10,-1.12,4.02);
  const cabinets=group('Studio cabinetry'),collection=group('Studio ceramics');
  for(const x of [-3,3]){
    const cabinet=group('Cabinet against window wall');cabinet.userData.wallFixture=true;cabinet.position.set(x,0,-3.35);cabinets.add(cabinet);
    box(cabinet,'Inset cabinet back',1.82,3.15,.07,wallMat,0,.485,-.15);
    for(const sx of [-.94,.94])box(cabinet,'Cabinet side',.09,3.2,.50,wood,sx,.48,.06);
    for(const y of [-1.08,-.65,.20,1.05,2.12])box(cabinet,'Recessed shelf',1.94,.07,.53,wood,0,y,.07);
    for(const row of [0,1,2])for(const i of [0,1])exhibit(collection,(row*2+i+(x>0?3:0))%pottery.length,x+(i-.5)*.86,[-.61,.24,1.09][row],-3.23,.65,i*.2);
    for(const y of [.16,1.01,2.08])box(cabinet,'Under shelf light',1.7,.012,.018,lamp,0,y,.23);
  }
  const bench=group('Finite oak studio worktable');
  const worktop=material('Matte sage worktable surface',0x9ba598,'limestone',1);
  box(bench,'Solid worktable with muted stone top',3.85,.13,2.05,worktop,0,-.067,0,.04);
  box(bench,'Oak front edge',3.85,.045,.035,wood,0,-.11,1.03,.008);
  for(const x of [-1.65,1.65])for(const z of [-.75,.75])box(bench,'Table leg',.14,.99,.14,darkWood,x,-.625,z);
  for(const z of [-.84,.84])box(bench,'Apron',3.5,.18,.08,darkWood,0,-.24,z);
  for(const x of [-1.66,1.66])box(bench,'Side apron',.08,.18,1.7,darkWood,x,-.24,0);
  box(bench,'Lower shelf',3.25,.055,1.5,darkWood,0,-.82,0);
  const conservation=group('Conservation worktable');
  box(conservation,'Padded working surface',2.6,.08,1.6,linen,0,.68,0,.03);
  box(conservation,'Worktable edge',2.65,.07,1.65,wood,0,.61,0,.03);
  for(const x of [-1.12,1.12])for(const z of [-.62,.62])box(conservation,'Conservation table leg',.085,.58,.085,dark,x,.29,z);

  // Reference: supplied Gyeongsan Museum VR views, 03 pottery shelves,
  // 05 central showcase and 06 gallery passage. Room proportions serve gameplay.
  const gallery=group('Museum gallery shell');tiledFloor(gallery,-.86,12,12,.6);
  for(const [name,x,z,a,w]of [['back',0,-4.4,0,12],['left',-6,.6,Math.PI/2,10],['right',6,.6,-Math.PI/2,10],['entrance',0,5.6,Math.PI,12]]){
    const face=wall(gallery,`Gallery ${name} wall`,x,z,a,w,-.86,4.3,museumWall);
    box(face,'Black lighting track',w-.4,.045,.04,dark,0,3.18,.34);
    for(let sx=-w/2+1;sx<w/2;sx+=2){
      box(face,'Recessed wall panel seam',.012,4.1,.012,dark,sx,1.2,.012,0);
      const lampBody=mesh(face,'Gallery track spotlight',new T.CylinderGeometry(.07,.07,.18,16),dark,sx,3.15,.25);lampBody.rotation.x=.5;
      mesh(face,'Spotlight warm lens',new T.CircleGeometry(.055,16),lamp,sx,3.06,.30).rotation.x=-Math.PI/2+.5;
    }
  }
  const fixtures=group('Permanent gallery fixtures'),galleryPots=group('Gallery ceramics');
  for(const x of [-.78,.9]){
    box(fixtures,'Warm limestone showcase plinth',1.36,.78,1.30,stone,x,-.45,0,.015);
    box(fixtures,'Fine bronze plinth reveal',1.34,.015,1.28,bronze,x,-.067,0,.003);
    box(fixtures,'Pale exhibit platform',1.32,.06,1.26,stone,x,-.03,0,.008);
    box(fixtures,'Recessed plinth foot',1.20,.08,1.16,dark,x,-.82,0,.006);
  }
  const cabinet=group('Gyeongsan pottery wall showcase');cabinet.userData.wallFixture=true;cabinet.position.z=-3.95;fixtures.add(cabinet);
  box(cabinet,'Continuous blue exhibit recess',8.5,3.4,.08,navy,0,1,-.30);
  for(const x of [-4.31,4.31])box(cabinet,'Showcase outer frame',.14,3.58,.98,dark,x,1,.1);
  for(const y of [-.77,2.77])box(cabinet,'Showcase head and foot',8.75,.14,.98,dark,0,y,.1);
  box(cabinet,'Case warm timber platform',8.5,.13,.96,shelfWood,0,-.65,.11);
  box(cabinet,'Hidden case light',8.2,.025,.08,lamp,0,2.65,.3);
  for(const x of [-2.75,-1.15]){
    for(const side of [-.72,.72])box(cabinet,'Pale upright shelf',.085,2.65,.46,shelfWood,x+side,.71,-.02);
    for(const y of [-.56,.06,.68,1.30,1.92])box(cabinet,'Pottery shelf with rounded edge',1.51,.055,.49,shelfWood,x,y,.005,.008);
    for(let row=0;row<4;row++)for(let col=0;col<2;col++){
      const index=[5,6,4,6,5,6,0,2,4,5,6,4][row*3+col];
      exhibit(galleryPots,index,x+(col-.5)*.72,[-.5325,.0875,.7075,1.3275][row],-3.94,.41,.25*col);
    }
  }
  // Broad jars sit on individual supports beside the small-vessel shelving.
  for(const [x,index,s,y]of [[.80,3,1.35,-.16],[3.0,0,1.2,-.16]]){
    if(y>-.5){box(cabinet,'Individual gray exhibit riser',.84,.425,.65,dark,x,-.3725,.10);}
    exhibit(galleryPots,index,x,y,y>-.5?-3.88:-3.50,s,x*.3);
  }
  // Slim divisions and restrained glazing keep the displays readable.
  for(const x of [-2.13,0,2.13])box(cabinet,'Glass vertical join',.012,3.35,.014,bronze,x,1,.58,.002);
  for(const x of [-3.19,-1.06,1.06,3.19])mesh(cabinet,'Showcase glazing',new T.PlaneGeometry(2.11,3.35),glass,x,1,.58);
  const interpretation=group('Museum interpretation panel');interpretation.userData.wallFixture=true;interpretation.position.set(-5.08,0,-4.04);fixtures.add(interpretation);
  box(interpretation,'Orange information panel',.92,1.65,.035,panel,0,.83,0,.002);
  // A low angled reading lectern echoes the labels beside the real gallery cases.
  const lectern=box(fixtures,'Sloped gallery reading desk',.72,.055,.42,dark,-3.7,-.24,-2.65,.008);lectern.rotation.x=.32;
  box(fixtures,'Reading desk pedestal',.20,.54,.25,dark,-3.7,-.59,-2.65);
  // Closed, planted courtyard rather than trees scattered across an empty plane.
  const yard=group('Museum archaeology courtyard');
  const gravel=material('Weathered gray sandstone',0x797e72,'limestone',1);
  // A high resolution scenic surround uses the full image per quarter turn.
  // A low resolution spherical skybox enlarged individual leaves across the view.
  const woodland=material('Distant woodland surround',0xc9cec2,'woodland',1);
  woodland.side=T.BackSide;
  const surroundGeometry=new T.CylinderGeometry(24,24,12,128,1,true),surroundUV=surroundGeometry.getAttribute('uv');
  for(let i=0;i<surroundUV.count;i++)surroundUV.setXY(i,surroundUV.getX(i)*4,.34+surroundUV.getY(i)*.66);
  mesh(yard,'Continuous woodland beyond the garden',surroundGeometry,woodland,0,5.8,0);
  const outerGround=new T.RingGeometry(7.9,24,96),outerUV=outerGround.getAttribute('uv'),outerPosition=outerGround.getAttribute('position');
  for(let i=0;i<outerUV.count;i++)outerUV.setXY(i,outerPosition.getX(i)*.5,outerPosition.getY(i)*.5);
  mesh(yard,'Ground beyond the planting borders',outerGround,shrubMat,0,-.035,0).rotation.x=-Math.PI/2;
  for(const x of [-4.7,4.7])for(let z=-6;z<=5;z+=.92)box(yard,'Path paving slab',1.55,.055,.88,gravel,x,.018,z,.018);
  for(let x=-3.9;x<=3.9;x+=.91)box(yard,'Rear cross path',.87,.055,1.2,gravel,x,.018,-3.55,.018);
  for(const side of [-1,1]){
    const fence=group('Stone courtyard boundary');yard.add(fence);
    const mortar=material('Recessed stone wall joints',0x4e5147,'earth',1);
    // Keep mortar below the top stones: coplanar top faces caused moving
    // dark patches (depth fighting) when the firing camera moved slightly.
    box(fence,'Continuous rear stone wall core',14,.54,.28,mortar,0,.27,side>0?-5:7,.02);
    box(fence,'Continuous side stone wall core',.28,.54,12,mortar,side*7,.27,1,.02);
    for(let row=0;row<3;row++)for(let j=0;j<25;j++){
      const p=-6.7+j*.55+(row%2)*.26;
      const rock=box(fence,'Bonded fieldstone',.53,.21,.40,gravel,p,.105+row*.215,side>0?-5:7,.055);
      rock.rotation.z=Math.sin(j*2.3+row)*.025;
    }
    for(let j=0;j<21;j++)for(let row=0;row<3;row++){
      const rock=box(fence,'Side fieldstone',.40,.21,.53,gravel,side*7,.105+row*.215,-4.7+j*.55+(row%2)*.26,.055);
      rock.rotation.x=Math.sin(j*2.3+row)*.025;
    }
    box(yard,'Long planted border',2.0,.18,11,shrubMat,side*6,.02,.4,.08);
  }
  box(yard,'Rear planting border',12,.18,1.8,shrubMat,0,.02,-6,.08);
  const clusters=[[-5.8,-4.8,1.1],[5.9,-5.6,1.35],[-6.2,4.3,1.3],[6.2,4.7,1],[-2.6,-6.3,.9],[2.3,-6.5,1.05]];
  for(const [x,z,s]of clusters){
    const tree=group('Tree in planting border');tree.position.set(x,.1,z);tree.scale.setScalar(s);tree.userData.forestSector=true;tree.userData.outward=[x/Math.hypot(x,z),0,z/Math.hypot(x,z)];yard.add(tree);
    const trunk=new T.CatmullRomCurve3([new T.Vector3(0,0,0),new T.Vector3(.08,1.1,.03),new T.Vector3(-.02,2,.05)]);
    mesh(tree,'Curved trunk',new T.TubeGeometry(trunk,10,.075,8,false),darkWood);
    for(let j=0;j<7;j++){
      const a=j*2.4,xx=Math.sin(a)*.6,zz=Math.cos(a)*.6,yy=1.65+(j%3)*.24;
      const branch=new T.LineCurve3(new T.Vector3(0,1,0),new T.Vector3(xx,yy,zz));mesh(tree,'Branch',new T.TubeGeometry(branch,1,.023,5,false),darkWood);
      for(let k=0;k<3;k++){const leaf=mesh(tree,'Leaf canopy',new T.PlaneGeometry(1.6,1.5),leaves,xx,yy+.2,zz);leaf.rotation.set(k*.5,a+k,0);}
    }
  }
  // Overlapping woodland layers close the garden boundary in every orbit view.
  // These are outside the working area, so the kiln and excavation stay legible.
  const treeTemplates=yard.children.filter(o=>o.name==='Tree in planting border');
  const forestSectors=Array.from({length:8},(_,i)=>{
    const sector=group('Woodland sector '+i),a=(i+.5)*Math.PI/4;
    sector.userData.forestSector=true;sector.userData.outward=[Math.cos(a),0,Math.sin(a)];yard.add(sector);return sector;
  });
  for(let band=0;band<1;band++)for(let i=0;i<16;i++){
    const angle=i/16*Math.PI*2,radius=11+Math.sin(i*2.4)*.65;
    const tree=treeTemplates[i%treeTemplates.length].clone();tree.name='Woodland beyond the boundary';
    delete tree.userData.forestSector;
    const sector=forestSectors[Math.floor(angle/(Math.PI/4))%8];
    tree.position.set(Math.cos(angle)*radius,0,Math.sin(angle)*radius);
    tree.scale.setScalar(1.1+(i%4)*.12);tree.rotation.y=i*1.7;sector.add(tree);
    for(let k=0;k<2;k++){
      const shrub=mesh(sector,'Woodland undergrowth',new T.PlaneGeometry(2.8,1.5),leaves,tree.position.x,.65,tree.position.z);
      shrub.rotation.y=angle+k*Math.PI/3;
    }
  }
  // Low planting fills the boundary continuously; the playable centre stays clear.
  for(let i=0;i<48;i++){
    const x=i<24?-6:6,z=-4.4+(i%24)*.43;
    for(let k=0;k<2;k++){const p=mesh(yard,'Border shrub',new T.PlaneGeometry(.85,.75),leaves,x+Math.sin(i*2.4)*.25,.38,z);p.rotation.y=i*1.3+k*1.57;}
  }
  // A low continuous understory closes the rear border without another wall
  // of tall trees. Its silhouette stays beneath the kiln and shelter roofs.
  for(let i=0;i<26;i++)for(let k=0;k<3;k++){
    const p=mesh(yard,'Rear understory',new T.PlaneGeometry(1.15,.95),leaves,-6+i*.48,.48,-6+Math.sin(i*2.4)*.25);
    p.rotation.y=i*.9+k*Math.PI/3;
  }
  const equipment=group('Organised excavation tools');
  for(let i=0;i<12;i++){
    const a=i/12*Math.PI*2,b=(i+1)/12*Math.PI*2,x=Math.cos(a)*2.05,z=Math.sin(a)*1.86;
    box(equipment,'Survey peg',.035,.22,.035,wood,x,.1,z);
    const line=new T.LineCurve3(new T.Vector3(x,.18,z),new T.Vector3(Math.cos(b)*2.05,.18,Math.sin(b)*1.86));mesh(equipment,'Survey cord',new T.TubeGeometry(line,1,.003,4,false),linen);
  }
  place(equipment,tools.find(t=>t[0]==='sherd-tray')[1],2.35,.045,-.8,1.1,.2);
  const br=place(equipment,brush(),2.10,.07,-.55,1.4,.2);br.rotation.x=Math.PI/2;
  place(equipment,tools.find(t=>t[0]==='folded-cloth')[1],2.35,.025,-.30,1.2,.12);
  const kilnyard=group('Kiln working yard');
  box(kilnyard,'Recessed firing bed',3.1,.07,3.8,soil,0,-.03,-.15,.12);
  box(kilnyard,'Pottery loading and cooling slab',1.18,.12,1.12,stone,-1.95,.06,1.65,.035);
  box(kilnyard,'Level ceramic firing support',1.02,.07,1.05,stone,0,.035,-.2,.02);
  const logs=kiln.clone();const loose=[];logs.traverse(o=>{if(/stone/i.test(o.name))loose.push(o);});loose.forEach(o=>o.removeFromParent());logs.position.set(0,.08,-1.5);kilnyard.add(logs);
  // A purposeful fuel rack and preparation bench replace isolated loose stones.
  for(const x of [1.5,2.2])for(const z of [-1.6,-.2])box(kilnyard,'Fuel rack post',.075,.62,.075,darkWood,x,.31,z);
  for(const z of [-1.6,-.2])box(kilnyard,'Fuel rack rail',.8,.08,.06,wood,1.85,.48,z);
  box(kilnyard,'Raised fuel rack base',.8,.06,1.45,darkWood,1.85,.06,-.9);
  box(kilnyard,'Preparation bench',1.4,.09,.7,wood,-2.1,.58,-1.0);
  for(const x of [-2.65,-1.55])for(const z of [-1.22,-.78])box(kilnyard,'Preparation bench leg',.08,.55,.08,darkWood,x,.275,z);
  place(kilnyard,tools.find(t=>t[0]==='water-bowl')[1],-2.4,.63,-1.05,1);
  const kilnClay=material('Ash weathered kiln plaster',0xb3a08a,'plaster',1);
  const newVault=vault.clone();newVault.traverse(o=>{
    if(o.name==='Earthen foundation'){o.material=soil;o.scale.y=.8;}
    if(['Uneven earthen vault','Thick earth facade with open firemouth','Exposed arch edging'].includes(o.name))o.material=kilnClay;
  });
  const rear=new T.Shape();rear.moveTo(-1.2,0);rear.absellipse(0,0,1.2,1.85,Math.PI,0,true,0);rear.lineTo(-1.2,0);
  mesh(newVault.children[1],'Closed kiln rear wall',new T.ExtrudeGeometry(rear,{depth:.13,bevelEnabled:false,curveSegments:32}),kilnClay,0,.24,-1.83);
  // Small tool shelter gives the working yard an architectural destination.
  const shed=group('Kiln preparation shelter');shed.position.set(-3.7,0,-3.6);kilnyard.add(shed);
  for(const x of [-1.3,1.3])for(const z of [-.65,.65])box(shed,'Shelter timber upright',.11,2.25,.11,darkWood,x,1.125,z);
  for(const z of [-.67,.67])box(shed,'Shelter lintel',2.95,.13,.12,darkWood,0,2.20,z);
  for(const side of [-1,1]){const roof=box(shed,'Shelter pitched roof',1.68,.10,1.9,dark,side*.72,2.39,0,.015);roof.rotation.z=-side*.22;}
  for(let i=0;i<8;i++)box(shed,'Shelter partial back slats',.25,1.1,.055,wood,-1.12+i*.32,.75,-.65);
  place(shed,tools.find(t=>t[0]==='tool-tray')[1],0,.6,0,1.3);
  box(shed,'Shelter worktop',2.3,.07,.7,wood,0,.56,0);
  const siru=buildSiruArtifact();
  // Validate authored exhibit spacing before exporting; this is geometry, not a screenshot guess.
  for(let i=0;i<records.length;i++)for(let j=i+1;j<records.length;j++)if(records[i].collection===records[j].collection){
    const a=records[i],b=records[j];if([0,1,2].every(k=>Math.min(a.max[k],b.max[k])-Math.max(a.min[k],b.min[k])>.004))throw Error(`Intersecting ${a.collection} exhibits ${i}/${j}`);
  }
  return {assets:[['studio-shell',studio],['studio-furniture',cabinets],['studio-collection',collection],['craft-bench',bench],['gallery-shell',gallery],['gallery-fixtures',fixtures],['gallery-collection',galleryPots],['courtyard',yard],['field-tools',equipment],['conservation-bench',conservation],['kiln-dressing',kilnyard],['kiln-vault',newVault],['siru',siru]],records};
}
