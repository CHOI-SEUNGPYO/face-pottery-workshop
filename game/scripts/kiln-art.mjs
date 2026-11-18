// A teaching cutaway. Both halves follow the same sections, from clay sunk
// into the yard to the crown. Only the roof rises towards the flue.
export function buildKiln({T,group,mesh,material,lathe}) {
  const kiln=group('Earthen kiln'),near=group('Cutaway shell'),far=group('Permanent half');
  kiln.add(near,far);
  const skin=material('Straw tempered ochre clay',0xe6d3b7,'kiln-clay',1);
  const lining=material('Smoke stained firing chamber',0x9d7762,'grayware',1);
  const section=material('Cut through the packed clay wall',0xbd906c,'earth',1);
  const hearth=material('Ash stained firing floor',0xbfad9c,'kiln-clay',1);
  const char=material('Charred timber',0x494036,'aged-oak',1);
  const lip=material('Smoked clay firemouth',0xad8571,'kiln-clay',1);
  skin.vertexColors=true;
  const front=1.15,rear=-1.68,foot=-.047;
  function profile(t,angle,inner){
    const s=Math.sin(angle),c=Math.cos(angle),z=front+(rear-front)*t;
    const belly=Math.sin(t*Math.PI),width=1.16+.20*belly-.12*t,height=1.69+.23*belly+.16*t;
    const grain=.029*Math.sin(angle*5+.7)*Math.sin(Math.PI*t*2)+.016*Math.sin(angle*11+z*4)*belly;
    const toe=.13*Math.pow(1-s,6);
    return [c*(width+(inner?-.155:grain+toe)),foot+s*(height+(inner?-.17:grain)),z];
  }
  function surface(parent,name,rows,cols,point,mat,shade,plane){
    const positions=[],uv=[],indices=[],colors=[];
    for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
      const u=i/cols,v=j/rows,p=point(u,v);
      positions.push(...p);
      if(plane)uv.push(p[0]*.8,p[plane==='wall'?1:2]*.8);else uv.push(u*2,v*2);
      if(shade){const value=shade(u,v,p);colors.push(value,value*.98,value*.96);}
      if(i<cols&&j<rows){const n=j*(cols+1)+i;indices.push(n,n+1,n+cols+1,n+1,n+cols+2,n+cols+1);}
    }
    const geo=new T.BufferGeometry();
    geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
    if(shade)geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    geo.setIndex(indices);geo.computeVertexNormals();
    return mesh(parent,name,geo,mat);
  }
  const daylight=(_u,_v,[x,y,z])=>.77+.09*Math.tanh(y*3-.4)+.05*Math.sin(3*x+2*z)*Math.cos(4*y-z)+.035*Math.sin(7*y+4*z);
  for(const [half,parent] of [near,far].entries()){
    const angle=u=>(half+u)*Math.PI/2;
    surface(parent,'Hand plastered outer vault',16,24,(u,v)=>profile(1-v,angle(u),false),skin,daylight);
    surface(parent,'Soot lined inner vault',16,24,(u,v)=>profile(v,angle(u),true),lining);
    // Close the crown seam and the end of each thick wall when sliced open.
    for(const [t,name] of [[0,'Front reveal'],[1,'Rear reveal']]){
      surface(parent,name,1,24,(u,v)=>profile(t,angle(u),Boolean(v)),section);
    }
    if(parent===far)surface(parent,'Section at the crown',16,1,(u,v)=>profile(v,Math.PI/2,Boolean(u)),section);
  }
  section.side=T.DoubleSide;
  // At the rear the full end wall meets the buried feet and the flue.
  function archEnd(t){
    const outline=new T.Shape();
    for(let i=0;i<=48;i++){
      const [x,y]=profile(t,i*Math.PI/48,false);
      if(!i)outline.moveTo(x,y);else outline.lineTo(x,y);
    }
    outline.closePath();return outline;
  }
  const end=(shape,depth)=>new T.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:32});
  surface(far,'Rounded earthen heel',14,32,(u,v)=>{
    const edge=profile(1,(1-u)*Math.PI,false),angle=v*Math.PI/2,r=Math.cos(angle);
    return [edge[0]*r,foot+(edge[1]-foot)*r,rear-.42*Math.sin(angle)];
  },skin,daylight,'wall');
  mesh(far,'Smoked interior of the back wall',new T.ShapeGeometry(archEnd(1)),lining,0,0,rear+.012);
  // Build the face as a semicircular band. The mouth is a true open arch down
  // to grade, with a dark recessed throat and no polygon spanning the fire.
  const throat=(angle,z)=>[.445*Math.cos(angle),foot+.67*Math.sin(angle),z];
  surface(near,'Earth around the firemouth',12,40,(u,v)=>{
    const angle=(1-u)*Math.PI,edge=profile(0,angle,false),hole=throat(angle,front+.14);
    return hole.map((value,i)=>value*(1-v)+edge[i]*v+(i===2?.068*Math.sin(v*Math.PI):0));
  },skin,(u,v,p)=>daylight(u,v,p)*(.38+.62*Math.sqrt(v)),'wall');
  surface(near,'Recess into the firebox',4,32,(u,v)=>throat(u*Math.PI,front+.14-.46*v),lining);
  lining.side=T.DoubleSide;
  // A continuous voussoir arch follows the opening instead of a row of boxes.
  for(let i=0;i<11;i++){
    const arch=new T.Shape(),a=i*Math.PI/11+.009,b=(i+1)*Math.PI/11-.009;
    arch.absellipse(0,foot,.565,.78,a,b,false,0);
    arch.absellipse(0,foot,.446,.67,b,a,true,0);arch.closePath();
    mesh(near,'Firemouth voussoir',end(arch,.10+.012*Math.sin(i)),lip,0,0,front+.09);
  }
  const flue=lathe(far,'Hand built flue collar',[[.32,1.65],[.30,1.84],[.23,1.95],[.207,2.17],[.22,2.20],[.215,2.24],[.148,2.23],[.14,2.17],[.14,1.72]],lining,40);
  flue.position.z=-1.30;
  const supportTop=.13;
  // Pack the floor against the vault with a level central seat and sloping
  // haunches. Its exposed edge runs into the soil instead of ending in a plinth.
  const outline=[[0,supportTop],[.72,supportTop],[.85,.113],[1,.038],[1.09,-.035]];
  surface(far,'Packed firing floor',outline.length-1,56,(u,v)=>{
    const angle=u*2*Math.PI,[r,y]=outline[Math.round(v*(outline.length-1))];
    const round=n=>Math.sign(n)*Math.pow(Math.abs(n),.69);
    return [1.19*r*round(Math.cos(angle)),y,-.32+1.43*r*round(Math.sin(angle))];
  },hearth,undefined,'floor');
  kiln.userData.hearth={x:0,y:supportTop,z:-.32};
  kiln.userData.firemouth={z:front+.2,radius:.565,height:.75};
  // Thin coals sit on the ground in front of the raised firing chamber.
  for(let i=0;i<4;i++){
    const log=mesh(far,'Split wood in the firebox',new T.CylinderGeometry(.043,.055,.49+i%2*.06,7),char,(i-1.5)*.105,.044,1.19+i%2*.035);
    log.rotation.x=Math.PI/2;log.rotation.z=.11*Math.sin(i*1.7);
  }
  return kiln;
}
