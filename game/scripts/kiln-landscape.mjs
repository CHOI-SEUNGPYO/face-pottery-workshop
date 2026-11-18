// Use the same low hills and floodplain for both Sowol-ri scenes, at a
// distance that keeps the meadow continuous as the visitor orbits.
export function addSowolHorizon({T,mesh,material},scene,radius){
  const height=radius*.86;
  const backdrop=new T.CylinderGeometry(radius,radius,height,96,1,true);
  const uv=backdrop.attributes.uv;
  for(let i=0;i<uv.count;i++)uv.setX(i,uv.getX(i)*2);
  const paint=material('Cheongtongcheon plain and low hills',0xffffff,'sowol-plain',1);
  paint.side=T.BackSide;
  mesh(scene,'View from the Sowol-ri knoll',backdrop,paint,0,.11*radius,0).rotation.y=2.78;
}
// Static scenery for the firing stage. The working floor and everything that
// grows out of it share one height function, including the banks behind it.
export function buildKilnLandscape({T,group,material,mesh,box,lathe,darkWood,wood},yard){
  const tau=Math.PI*2;
  let seed=43815;
  function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
  function grade(x,z){
    const r=Math.hypot(x,z),a=Math.atan2(z,x);
    const bank=T.MathUtils.smoothstep(r,4.4,9.2);
    return -.003+bank*(-.35+.64*Math.sin(a+.3)+.24*Math.cos(2*a-.5)+.09*Math.sin(.9*x+.6*z));
  }
  function geometry(vertices,indices,uv,colors){
    const geo=new T.BufferGeometry();
    geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
    if(uv)geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
    if(colors)geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    geo.setIndex(indices);geo.computeVertexNormals();return geo;
  }
  const radius=14,steps=96,rings=24,positions=[0,grade(0,0),0],uv=[.5,.5],indices=[];
  for(let row=1;row<=rings;row++)for(let i=0;i<steps;i++){
    const a=i*tau/steps,r=radius*row/rings,x=Math.cos(a)*r,z=Math.sin(a)*r;
    positions.push(x,grade(x,z),z);uv.push(.5+x/(2*radius),.5-z/(2*radius));
    const here=1+(row-1)*steps+i,next=1+(row-1)*steps+(i+1)%steps;
    if(row===1)indices.push(0,next,here);
    else indices.push(here-steps,next,here,here-steps,next-steps,next);
  }
  mesh(yard,'Beaten clay yard and meadow banks',geometry(positions,indices,uv),material('Painted working earth',0xffffff,'kiln-yard',1));
  addSowolHorizon({T,mesh,material},yard,13.8);

  function beam(parent,name,start,end,r,mat,top=r){
    const from=new T.Vector3(...start),to=new T.Vector3(...end),delta=to.clone().sub(from);
    const post=mesh(parent,name,new T.CylinderGeometry(top,r,delta.length(),8),mat);
    post.position.copy(from).lerp(to,.5);post.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());
    return post;
  }
  const shelter=group('Potters drying shelter'),sx=-4.20,sz=-.8;
  shelter.position.set(sx,0,sz);shelter.rotation.y=.17;
  const distance=Math.hypot(sx,sz);
  shelter.userData={forestSector:true,outward:[sx/distance,0,sz/distance],hideAtDot:.76};yard.add(shelter);
  for(const x of [-1.27,1.27])for(const z of [-.65,.65]){
    const foot=shelter.localToWorld(new T.Vector3(x,0,z));
    beam(shelter,'Round timber post',[x,grade(foot.x,foot.z)-.045,z],[x*.98,1.65,z*.98],.07,darkWood,.058);
    beam(shelter,'Diagonal brace',[x,1.12,z],[x-Math.sign(x)*.46,1.59,z],.036,wood);
  }
  for(const z of [-.65,.65])beam(shelter,'Eave purlin',[-1.53,1.62,z],[1.53,1.62,z],.075,darkWood);
  for(const x of [-1.27,1.27])beam(shelter,'Cross tie',[x,1.59,-.78],[x,1.59,.78],.055,darkWood);
  const straw=material('Weathered bundled rice straw',0xe4dac6,'thatch',1);
  straw.side=T.DoubleSide;
  const roofVertices=[],roofUV=[],roofIndices=[];
  const roofSides=[
    [[-1.71,1.51,1.02],[1.71,1.51,1.02],[-.89,2.29,0],[.89,2.29,0]],
    [[1.71,1.51,-1.02],[-1.71,1.51,-1.02],[.89,2.29,0],[-.89,2.29,0]],
    [[1.71,1.51,1.02],[1.71,1.51,-1.02],[.89,2.29,0],[.89,2.29,0]],
    [[-1.71,1.51,-1.02],[-1.71,1.51,1.02],[-.89,2.29,0],[-.89,2.29,0]]
  ];
  for(const [left,right,peakL,peakR] of roofSides){
    const start=roofVertices.length/3;
    for(let row=0;row<5;row++)for(let col=0;col<=12;col++){
      const t=Math.max(0,(row-1)/3),u=col/12;
      const p=left.map((v,k)=>(v*(1-u)+right[k]*u)*(1-t)+(peakL[k]*(1-u)+peakR[k]*u)*t);
      p[1]+=.055*Math.sin(Math.PI*t)-(.105+.025*Math.sin(u*8))*(row===0?1:0)+.045*Math.cos(u*tau)*(1-t);
      roofVertices.push(...p);roofUV.push(u*(1-.42*t)*2.1,t);
      const v=start+row*13+col;
      if(row&&col)roofIndices.push(v-14,v-13,v,v-14,v,v-1);
    }
  }
  mesh(shelter,'Hipped roof with thick thatch eaves',geometry(roofVertices,roofIndices,roofUV),straw);
  const cord=material('Straw ridge binding',0xa89067,null,1);
  beam(shelter,'Bound straw ridge',[-.92,2.30,0],[.92,2.30,0],.073,cord);
  for(const x of [-.73,-.24,.24,.73])for(const dir of [-1,1]){
    beam(shelter,'Roof lashing',[x,2.332,0],[x*1.11,2.012,dir*.49],.011,cord);
    beam(shelter,'Roof lashing',[x*1.11,2.012,dir*.49],[x*1.24,1.535,dir*1.02],.011,cord);
  }
  for(const x of [-1.14,1.14])for(const z of [-.42,.18])beam(shelter,'Drying shelf leg',[x,-.045,z],[x,.60,z],.043,darkWood);
  for(let i=0;i<4;i++)box(shelter,'Drying shelf slat',2.57,.065,.15,wood,0,.61,i*.162-.39);
  const biscuit=material('Drying earthenware',0xbc8969,null,.98);
  for(const [x,size] of [[-.81,.85],[-.06,1.12],[.73,.78]]){
    const bowl=lathe(shelter,'Unfired bowl on the drying shelf',[[.001,0],[.13,0],[.15,.03],[.24,.15],[.26,.195],[.25,.209],[.234,.196],[.202,.137],[.105,.035],[.001,.032]],biscuit,32);
    bowl.scale.setScalar(size);bowl.position.set(x,.643,-.10);
  }

  // Each stone has a low brow, broad shoulder and a smaller uneven crown.
  // Generate the coping and its two courses in a single coloured mesh.
  const rockVertices=[],rockUV=[],rockIndices=[],rockColors=[];
  function stone(x,y,z,length,h,heading){
    const start=rockVertices.length/3,w=.27+random()*.10;
    const tones=new T.Color().setHSL(.105+random()*.09,.07+random()*.12,.34+random()*.15,T.SRGBColorSpace);
    for(const [row,scale] of [[0,.83],[.24,1],[.79,.98],[1,.72]])for(let i=0;i<8;i++){
      const a=tau*(i+.5)/8,ex=Math.cos(a)*length*.56*scale,ez=Math.sin(a)*w*scale;
      const vx=x+Math.cos(heading)*ex-Math.sin(heading)*ez,vz=z+Math.sin(heading)*ex+Math.cos(heading)*ez,vy=y+h*(row+.09*random());
      rockVertices.push(vx,vy,vz);rockColors.push(...tones.clone().multiplyScalar(.74+.26*row).toArray());rockUV.push(vx*1.2+vz*.46,vy+vz*.84);
      const id=rockVertices.length/3-1,next=start+Math.floor((id-start)/8)*8+(i+1)%8;
      if(row)rockIndices.push(id-8,id,next,next-8,id-8,next);
    }
    for(let i=1;i<7;i++)rockIndices.push(start+24,start+25+i,start+24+i);
  }
  for(const [ax,az,bx,bz,bend] of [[-6.4,1.3,-5.35,-4.3,-.55],[4.2,-4.9,5.45,-3.45,-.32],[5.45,-3.45,6.2,.65,-.35]]){
    const dx=bx-ax,dz=bz-az,length=Math.hypot(dx,dz);
    for(let row=0;row<3;row++){
      for(let pos=0;pos<length-.07;){
        const len=Math.min(length-pos,(row===0?.67:.61)*(.80+.55*random())*(pos===0&&row%2?.60:1));
        const t=(pos+len*.5)/length,curve=Math.sin(Math.PI*t)*bend+row*.04;
        const x=ax+t*dx-dz/length*curve,z=az+t*dz+dx/length*curve;
        stone(x,grade(x,z)-.07+row*.169,z,len+.05,row===2?.15:.21,Math.atan2(dz,dx)+.13*Math.cos(t*Math.PI));
        pos+=len;
      }
    }
  }
  const granite=material('Weathered fieldstone',0xffffff,'limestone',1);granite.vertexColors=true;
  mesh(yard,'Dry laid terrace walls',geometry(rockVertices,rockIndices,rockUV,rockColors),granite);

  const blades=[],faces=[],tints=[];
  function blade(x,y,z,a,h,w,lean,colors){
    const start=blades.length/3,dx=Math.cos(a),dz=Math.sin(a);
    for(const [t,width] of [[0,w],[.57,w*.69],[1,.001]])for(const sign of [-1,1]){
      blades.push(x+dx*lean*t*t+dz*width*sign,y+h*t,z+dz*lean*t*t-dx*width*sign);
      tints.push(...colors[Number(t>0)].toArray());
    }
    faces.push(start,start+1,start+3,start,start+3,start+2,start+2,start+3,start+5,start+2,start+5,start+4);
  }
  const foliage=[new T.Color(0x75794e),new T.Color(0xb4ab73)],seeds=[new T.Color(0xad946d),new T.Color(0xe7d6a8)];
  for(let patch=0;patch<32;patch++){
    const a=random()*tau,r=5.1+random()*5.85;
    for(let tuft=0;tuft<4;tuft++){
      const x=Math.cos(a)*r+(random()-.5)*1.1,z=Math.sin(a)*r+(random()-.5)*.9,y=grade(x,z)-.025,scale=.64+random()*.62;
      for(let i=0;i<9;i++)blade(x,y,z,i*2.4+random(),(.2+random()*.42)*scale,.015,.12+random()*.25,foliage);
      for(let i=0;i<2;i++){
        const direction=random()*tau,h=(.47+random()*.28)*scale,lean=.11;
        blade(x,y,z,direction,h,.007,lean,foliage);
        blade(x+lean*Math.cos(direction),y+h-.02,z+lean*Math.sin(direction),direction,.14*scale,.023,.075,seeds);
      }
    }
  }
  const grass=material('Sunlit grass and seed heads',0xffffff,null,1);grass.vertexColors=true;grass.side=T.DoubleSide;
  mesh(yard,'Silvergrass on the terrace margins',geometry(blades,faces,null,tints),grass);
}
