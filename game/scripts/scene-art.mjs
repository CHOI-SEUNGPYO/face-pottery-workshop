// V3 scene composition: architectural boundaries, permanent supports and
// individual exhibit clearances are authored separately from removable walls.
import {buildSiruArtifact} from './siru-artifact.mjs';
import {buildKiln} from './kiln-art.mjs';
import {addSowolHorizon,buildKilnLandscape} from './kiln-landscape.mjs';
export function buildScenes(c){
  const {T,group,mesh,box,lathe,ring,place,material,pottery,tools,wood,darkWood,plaster,linen,bronze,lamp,clay,darkClay,brush}=c;
  const stone=material('Honed warm limestone',0xe7e4dd,'limestone',.9);
  const dark=material('Museum bronze charcoal',0x414742,null,.7,.1);
  const wallMat=material('Warm museum plaster',0xddd5c6,'plaster',.92);
  const panel=material('Muted clay interpretation panel',0xb18e69,null,.95);
  const navy=material('Museum deep teal case backing',0x334e50,null,.95);
  const museumWall=material('Warm gray museum wall',0xa49d8f,null,.98);
  const shelfWood=material('Pale exhibit shelving',0xc9c2ae,'limestone',.9);
  const glass=material('Clear exhibit glazing',0xc0dedf,null,.16);
  glass.transparent=true;glass.opacity=.045;glass.depthWrite=false;glass.side=T.DoubleSide;
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
  // Slim outer lights leave a clear view behind the pot. The garden sits
  // beyond the sill, so its hills move differently from the frame on orbit.
  for(const x of [-1.36,1.36]){
    box(back,'Side light stile',.036,1.8,.07,darkWood,x,1.4,.015);
    for(const y of [.98,1.82])box(back,'Side light rail',.42,.028,.065,darkWood,Math.sign(x)*1.57,y,.015);
  }
  box(back,'Window ledge',3.84,.065,.38,wood,0,.425,.13,.014);
  const garden=material('Painted persimmon courtyard',0xffffff,'garden',1);
  mesh(back,'Garden beyond the window',new T.PlaneGeometry(5.85,2.44),garden,0,1.37,-.82);
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
  const plinth=material('Patinated exhibit pedestal',0x48534e,null,.89);
  for(const x of [-.78,.9]){
    box(fixtures,'Patinated showcase plinth',1.36,.78,1.30,plinth,x,-.45,0,.015);
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
  const yard=group('Sowol-ri surveyed knoll');
  addSowolHorizon(c,yard,22);
  const meadow=material('Grass beyond the excavation limit',0x9e9b8d,'meadow',1);
  const apron=new T.RingGeometry(7.6,22.3,96,12);
  const field=apron.attributes.position,fieldUV=apron.attributes.uv;
  for(let i=0;i<field.count;i++){
    const x=field.getX(i),z=-field.getY(i),r=Math.hypot(x,z);
    const beyond=T.MathUtils.smoothstep(r,7.6,17);
    field.setZ(i,-.05+beyond*(-.96+.51*z/r+.19*Math.sin(x*.48)*Math.cos(z*.31)));
    fieldUV.setXY(i,x*.32,z*.32);
  }
  apron.computeVertexNormals();
  mesh(yard,'Field margin below the survey terrace',apron,meadow).rotation.x=-Math.PI/2;
  const equipment=group('Organised excavation tools');
  // A photographic scale and open field book mark the recording edge of
  // the trench. Keep all equipment outside the playable soil ellipse.
  const scaleInk=material('Field scale charcoal',0x313b36,null,.96);
  const scaleBone=material('Field scale ivory',0xf2e4c7,null,.96);
  const measure=group('Field recording scale');equipment.add(measure);
  measure.position.set(-1.34,0,-1.33);measure.rotation.y=-.30;
  box(measure,'Measuring bar backing',.78,.027,.081,scaleInk,0,.014,0,0);
  for(let i=0;i<8;i+=2)box(measure,'Alternating scale divisions',.094,.004,.073,scaleBone,-.34+i*.097,.029,0,0);
  const fieldBook=group('Open field notebook');equipment.add(fieldBook);
  fieldBook.position.set(-1.96,0,.58);fieldBook.rotation.y=.34;
  const cover=material('Canvas field notebook cover',0x545f50,'linen',1);
  box(fieldBook,'Linen cover',.42,.017,.30,cover,0,.011,0,.006);
  for(const sign of [-1,1]){
    const leaf=box(fieldBook,'Notebook pages',.193,.020,.276,scaleBone,sign*.099,.030,0,.003);leaf.rotation.z=-sign*.031;
  }
  for(let i=0;i<5;i++)box(fieldBook,'Pencilled notebook lines',.085+.01*(i%3),.001,.003,scaleInk,.085,.043,-.078+i*.032,0);
  // Two recording baselines mark a survey square without fencing in the find.
  const pins=[[-2.70,1.72],[-2.70,-1.82],[1.55,-1.82],[3.50,-1.82]];
  for(const [x,z] of pins)box(equipment,'Survey grid stake',.026,.16,.03,wood,x,.068,z,0);
  for(let i=1;i<pins.length;i++){
    const [ax,az]=pins[i-1],[bx,bz]=pins[i];
    const cord=new T.LineCurve3(new T.Vector3(ax,.084,az),new T.Vector3(bx,.084,bz));
    mesh(equipment,'Recording baseline',new T.TubeGeometry(cord,1,.004,5,false),linen);
  }
  place(equipment,tools.find(t=>t[0]==='sherd-tray')[1],2.35,.045,-.8,1.1,.2);
  const br=place(equipment,brush(),2.10,.07,-.55,1.4,.2);br.rotation.x=Math.PI/2;
  place(equipment,tools.find(t=>t[0]==='folded-cloth')[1],2.35,.025,-.30,1.2,.12);
  const kilnyard=group('Kiln working yard');
  // A purposeful fuel rack and preparation bench replace isolated loose stones.
  for(const x of [1.5,2.2])for(const z of [-1.6,-.2])box(kilnyard,'Fuel rack post',.075,.62,.075,darkWood,x,.31,z);
  for(const z of [-1.6,-.2])box(kilnyard,'Fuel rack rail',.8,.08,.06,wood,1.85,.48,z);
  box(kilnyard,'Raised fuel rack base',.8,.06,1.45,darkWood,1.85,.06,-.9);
  for(let row=0;row<3;row++)for(let i=0;i<4-row;i++){
    const log=mesh(kilnyard,'Seasoned split timber',new T.CylinderGeometry(.083,.076,1.23-i*.045,7),darkWood,1.85+(i-(3-row)/2)*.156,.165+row*.132,-.92+.036*Math.sin(i+row));
    log.rotation.x=Math.PI/2;log.rotation.y=(i+row)*.61;
  }
  box(kilnyard,'Preparation bench',1.4,.09,.7,wood,-2.1,.58,-1.0);
  for(const x of [-2.65,-1.55])for(const z of [-1.22,-.78])box(kilnyard,'Preparation bench leg',.08,.55,.08,darkWood,x,.275,z);
  const bowl=place(kilnyard,tools.find(t=>t[0]==='water-bowl')[1],-2.4,0,-1.05,1);
  bowl.position.y+=.625-new T.Box3().setFromObject(bowl).min.y;
  const newVault=buildKiln(c);
  buildKilnLandscape(c,kilnyard);
  const siru=buildSiruArtifact();
  // Validate authored exhibit spacing before exporting; this is geometry, not a screenshot guess.
  for(let i=0;i<records.length;i++)for(let j=i+1;j<records.length;j++)if(records[i].collection===records[j].collection){
    const a=records[i],b=records[j];if([0,1,2].every(k=>Math.min(a.max[k],b.max[k])-Math.max(a.min[k],b.min[k])>.004))throw Error(`Intersecting ${a.collection} exhibits ${i}/${j}`);
  }
  return {assets:[['studio-shell',studio],['studio-furniture',cabinets],['studio-collection',collection],['craft-bench',bench],['gallery-shell',gallery],['gallery-fixtures',fixtures],['gallery-collection',galleryPots],['courtyard',yard],['field-tools',equipment],['conservation-bench',conservation],['kiln-dressing',kilnyard],['kiln-vault',newVault],['siru',siru]],records};
}
