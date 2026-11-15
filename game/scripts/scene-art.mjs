// V3 scene composition: architectural boundaries, permanent supports and
// individual exhibit clearances are authored separately from removable walls.
export function buildScenes(c){
  const {T,group,mesh,box,lathe,ring,place,material,pottery,tools,wood,darkWood,plaster,linen,bronze,lamp,clay,darkClay,vault,kiln,brush}=c;
  const stone=material('Honed warm limestone',0xe7e4dd,'limestone',.9);
  const dark=material('Museum bronze charcoal',0x414742,null,.7,.1);
  const wallMat=material('Warm museum plaster',0xddd5c6,'plaster',.92);
  const panel=material('Museum terracotta exhibition panel',0xb55725,'plaster',.91);
  const navy=material('Deep blue museum walls',0x183d52,'plaster',.91);
  const oakFloor=material('Warm museum parquet',0xbeaa89,'aged-oak',.62);
  const soil=material('Courtyard compacted earth',0xaaa99a,'earth',1);
  const leaves=material('Natural leaf clusters',0x839a65,'foliage',.95);leaves.side=T.DoubleSide;leaves.alphaTest=.5;
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
  function parquet(g,base,width,depth,z=0){
    box(g,'Parquet subfloor',width,.08,depth,darkWood,0,base-.045,z,0);
    for(let row=0;row<Math.ceil(depth/.24);row++){
      const zz=z-depth/2+(row+.5)*.24;
      for(let i=0;i<Math.ceil(width/1.1)+1;i++){
        const start=-width/2+i*1.1-(row%3)*.33,end=Math.min(width/2,start+1.096),lo=Math.max(-width/2,start);
        if(end<=lo)continue;
        box(g,'Staggered parquet board',end-lo,.025,.236,oakFloor,(end+lo)/2,base-.0125,zz,.003);
      }
    }
  }
  const studio=group('Studio shell');parquet(studio,-1.12,10,10,.8);
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
    box(cabinet,'Inset cabinet back',1.82,3.15,.07,darkWood,0,.485,-.15);
    for(const sx of [-.94,.94])box(cabinet,'Cabinet side',.09,3.2,.50,wood,sx,.48,.06);
    for(const y of [-1.08,-.65,.20,1.05,2.12])box(cabinet,'Recessed shelf',1.94,.07,.53,wood,0,y,.07);
    for(const row of [0,1,2])for(const i of [0,1])exhibit(collection,(row*2+i+(x>0?3:0))%pottery.length,x+(i-.5)*.86,[-.61,.24,1.09][row],-3.23,.65,i*.2);
    for(const y of [.16,1.01,2.08])box(cabinet,'Under shelf light',1.7,.012,.018,lamp,0,y,.23);
  }
  const bench=group('Finite oak studio worktable');
  box(bench,'Thick single oak top',3.85,.13,2.05,wood,0,-.067,0,.04);
  for(const x of [-1.65,1.65])for(const z of [-.75,.75])box(bench,'Table leg',.14,.99,.14,darkWood,x,-.625,z);
  for(const z of [-.84,.84])box(bench,'Apron',3.5,.18,.08,darkWood,0,-.24,z);
  for(const x of [-1.66,1.66])box(bench,'Side apron',.08,.18,1.7,darkWood,x,-.24,0);
  box(bench,'Lower shelf',3.25,.055,1.5,darkWood,0,-.82,0);
  const conservation=group('Conservation worktable');
  box(conservation,'Padded working surface',2.6,.08,1.6,linen,0,.68,0,.03);
  box(conservation,'Worktable edge',2.65,.07,1.65,wood,0,.61,0,.03);
  for(const x of [-1.12,1.12])for(const z of [-.62,.62])box(conservation,'Conservation table leg',.085,.58,.085,dark,x,.29,z);

  const gallery=group('Museum gallery shell');parquet(gallery,-.86,12,12,.6);
  for(const [name,x,z,a,w]of [['back',0,-4.4,0,12],['left',-6,.6,Math.PI/2,10],['right',6,.6,-Math.PI/2,10],['entrance',0,5.6,Math.PI,12]]){
    const face=wall(gallery,`Gallery ${name} wall`,x,z,a,w,-.86,4.3,navy);
    for(let sx=-w/2+1;sx<w/2;sx+=2){
      box(face,'Recessed wall panel seam',.012,4.1,.012,dark,sx,1.2,.012,0);
      const lampBody=mesh(face,'Gallery track spotlight',new T.CylinderGeometry(.07,.07,.18,16),dark,sx,3.15,.25);lampBody.rotation.x=.5;
      mesh(face,'Spotlight warm lens',new T.CircleGeometry(.055,16),lamp,sx,3.06,.30).rotation.x=-Math.PI/2+.5;
    }
  }
  const fixtures=group('Permanent gallery fixtures'),galleryPots=group('Gallery ceramics');
  for(const x of [-.78,.9]){
    const stand=lathe(fixtures,'Permanent artwork plinth',[[.001,-.86],[.64,-.86],[.69,-.81],[.69,-.04],[.67,0],[.001,0]],dark);stand.position.x=x;
    ring(fixtures,'Plinth top bronze inlay',.675,-.018,.006,bronze).position.x=x;
    ring(fixtures,'Plinth base moulding',.68,-.77,.015,dark).position.x=x;
  }
  for(const x of [-3,0,3]){
    const cabinet=group('Wall display case');cabinet.userData.wallFixture=true;cabinet.position.set(x,0,-3.92);fixtures.add(cabinet);
    box(cabinet,'Display backing',2.15,2.8,.10,panel,0,.7,-.22);
    for(const sx of [-1.13,1.13])box(cabinet,'Exhibit frame',.09,2.88,.48,dark,sx,.7,0);
    for(const y of [-.74,2.14])box(cabinet,'Exhibit frame',2.35,.085,.48,dark,0,y,0);
    box(cabinet,'Exhibit platform',2.18,.5,.5,dark,0,-.46,0);
    box(cabinet,'Illuminated shelf',2.08,.035,.48,stone,0,-.19,.01);
    box(cabinet,'Case overhead lamp',2,.025,.08,lamp,0,2.08,.11);
    for(const i of [0,1])exhibit(galleryPots,(i+(x+3)*2)%pottery.length,x+(i-.5)*.93,-.17,-3.91,.83,i*.28);
  }
  // Closed, planted courtyard rather than trees scattered across an empty plane.
  const yard=group('Museum archaeology courtyard');
  const gravel=material('Weathered gray sandstone',0x797e72,'limestone',1);
  // A high resolution scenic surround uses the full image per quarter turn.
  // A low resolution spherical skybox enlarged individual leaves across the view.
  const woodland=material('Distant woodland surround',0xd8ded4,'woodland',1);
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
    box(fence,'Continuous rear stone wall core',14,.64,.28,mortar,0,.32,side>0?-5:7,.02);
    box(fence,'Continuous side stone wall core',.28,.64,12,mortar,side*7,.32,1,.02);
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
  for(let band=0;band<2;band++)for(let i=0;i<24+band*8;i++){
    const angle=i/(24+band*8)*Math.PI*2+band*.17,radius=9+band*4+Math.sin(i*2.4)*.65;
    const tree=treeTemplates[i%treeTemplates.length].clone();tree.name='Woodland beyond the boundary';
    delete tree.userData.forestSector;
    const sector=forestSectors[Math.floor(angle/(Math.PI/4))%8];
    tree.position.set(Math.cos(angle)*radius,0,Math.sin(angle)*radius);
    tree.scale.setScalar(1.45+(i%4)*.19+band*.25);tree.rotation.y=i*1.7;sector.add(tree);
    for(let k=0;k<3;k++){
      const shrub=mesh(sector,'Woodland undergrowth',new T.PlaneGeometry(2.8,1.5),leaves,tree.position.x,.65,tree.position.z);
      shrub.rotation.y=angle+k*Math.PI/3;
    }
  }
  // Low planting fills the boundary continuously; the playable centre stays clear.
  for(let i=0;i<48;i++){
    const x=i<24?-6:6,z=-4.4+(i%24)*.43;
    for(let k=0;k<2;k++){const p=mesh(yard,'Border shrub',new T.PlaneGeometry(.85,.75),leaves,x+Math.sin(i*2.4)*.25,.38,z);p.rotation.y=i*1.3+k*1.57;}
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
  const logs=kiln.clone();const loose=[];logs.traverse(o=>{if(/stone/i.test(o.name))loose.push(o);});loose.forEach(o=>o.removeFromParent());logs.position.set(0,.08,-1.5);kilnyard.add(logs);
  // A purposeful fuel rack and preparation bench replace isolated loose stones.
  for(const x of [1.5,2.2])for(const z of [-1.6,-.2])box(kilnyard,'Fuel rack post',.075,.62,.075,darkWood,x,.31,z);
  for(const z of [-1.6,-.2])box(kilnyard,'Fuel rack rail',.8,.08,.06,wood,1.85,.48,z);
  box(kilnyard,'Raised fuel rack base',.8,.06,1.45,darkWood,1.85,.06,-.9);
  box(kilnyard,'Preparation bench',1.4,.09,.7,wood,-2.1,.58,-1.0);
  for(const x of [-2.65,-1.55])for(const z of [-1.22,-.78])box(kilnyard,'Preparation bench leg',.08,.55,.08,darkWood,x,.275,z);
  place(kilnyard,tools.find(t=>t[0]==='water-bowl')[1],-2.4,.63,-1.05,1);
  const kilnClay=material('Ash weathered kiln plaster',0x9a826b,'plaster',1);
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
  const siru=group('Light weathered steamer support');
  const siruMat=material('Siru ash gray clay',0xbac7cc,'siru-clay',.92);
  lathe(siru,'Hollow flared steamer body',[[.46,0],[.48,.035],[.45,.075],[.39,.14],[.34,.36],[.27,.62],[.25,.70],[.225,.70],[.245,.61],[.315,.35],[.365,.13],[.425,.045],[.43,0]],siruMat,64);
  ring(siru,'Steamer foot rim',.465,.025,.009,siruMat);ring(siru,'Steamer mouth rim',.239,.695,.011,siruMat);
  for(const side of [-1,1]){
    const curve=new T.CatmullRomCurve3([new T.Vector3(side*.36,.28,0),new T.Vector3(side*.49,.31,0),new T.Vector3(side*.61,.23,0)]);
    mesh(siru,'Downward ceramic lug',new T.TubeGeometry(curve,14,.025,10,false),siruMat);
  }
  siru.userData.supportHeight=.70;
  // Validate authored exhibit spacing before exporting; this is geometry, not a screenshot guess.
  for(let i=0;i<records.length;i++)for(let j=i+1;j<records.length;j++)if(records[i].collection===records[j].collection){
    const a=records[i],b=records[j];if([0,1,2].every(k=>Math.min(a.max[k],b.max[k])-Math.max(a.min[k],b.min[k])>.004))throw Error(`Intersecting ${a.collection} exhibits ${i}/${j}`);
  }
  return {assets:[['studio-shell',studio],['studio-furniture',cabinets],['studio-collection',collection],['craft-bench',bench],['gallery-shell',gallery],['gallery-fixtures',fixtures],['gallery-collection',galleryPots],['courtyard',yard],['field-tools',equipment],['conservation-bench',conservation],['kiln-dressing',kilnyard],['kiln-vault',newVault],['siru',siru]],records};
}
