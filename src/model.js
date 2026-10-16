export const ROWS = 40, COLS = 80;
export const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
export const wrapDistance = (a,b) => Math.min(Math.abs(a-b),1-Math.abs(a-b));
export function freshModel(){return {version:1,stage:1,height:1.18,offsets:Array((ROWS+1)*COLS).fill(0),marks:[],crown:[],fired:false,dug:0,brush:[],assembled:false};}
export function advanceIssue(stage,model){
  if(stage===2&&model.crown.length<3)return '정수리에 내 구멍을 하나 만들어 볼까요?';
  if(stage===5&&!model.fired)return '과정 보기 버튼으로 토기를 먼저 구워 보세요.';
  if(stage===6&&model.dug<65)return '흙을 조금 더 걷어 내면 토기와 시루가 보여요.';
  if(stage===7&&!model.assembled)return '토기를 시루 위로 옮겨 보세요.';
  return '';
}
export function invalidateProcess(model){model.fired=false;model.dug=0;model.brush=[];model.assembled=false;}
export function baseRadius(t){
  if(t>=.9)return .55*Math.sqrt(Math.max(0,(1-t)/.1));
  const points=[[0,.54],[.12,.51],[.3,.6],[.52,.83],[.65,.88],[.78,.8],[.9,.55],[1,.275]];
  for(let i=1;i<points.length;i++)if(t<=points[i][0]){
    const [a,x]=points[i-1],[b,y]=points[i],prev=points[Math.max(0,i-2)],next=points[Math.min(points.length-1,i+1)];
    const f=(t-a)/(b-a),m0=(y-prev[1])/(b-prev[0])*(b-a),m1=(next[1]-x)/(next[0]-a)*(b-a);
    return (2*f**3-3*f*f+1)*x+(f**3-2*f*f+f)*m0+(-2*f**3+3*f*f)*y+(f**3-f*f)*m1;
  }return .48;
}
export function deform(model,u,v,amount,radius=.15){for(let row=2;row<ROWS-2;row++){const dy=row/ROWS-v;for(let col=0;col<COLS;col++){const dx=wrapDistance(col/COLS,u)*1.6;const d=(dx*dx+dy*dy)/(radius*radius);if(d<4){const i=row*COLS+col;model.offsets[i]=clamp(model.offsets[i]+amount*Math.exp(-d*2),-.38,.5);}}}}
// Carry nearby shaping into the ends instead of leaving a fixed rim and foot.
export function shapedRadius(model,row,col){
  const centre=clamp(row,5,34);let offset=0;
  for(let d=-7;d<=7;d++)offset+=model.offsets[clamp(centre+d,0,ROWS)*COLS+(col+COLS)%COLS]*(8-Math.abs(d))/64;
  const taper=row>34?baseRadius(row/ROWS)/baseRadius(.85):1;
  return Math.max(.18*taper,baseRadius(row/ROWS)+offset*taper);
}
export function sculptProfile(model,u,v,amount){
  for(let row=2;row<32;row++){
    const vertical=Math.exp(-2*((row/ROWS-clamp(v,.1,.65))/.22)**2),edge=Math.min(1,(32-row)/3,row/3);
    for(let col=0;col<COLS;col++){
      const weight=Math.exp(-2*(wrapDistance(col/COLS,u)/.23)**2)*vertical*edge,i=row*COLS+col;
      model.offsets[i]=clamp(model.offsets[i]+amount*weight,-.38,.5);
    }
  }
}
export function reshapeProfile(model,before,v,outward,upward){
  const radii=Array.from({length:ROWS+1},(_,row)=>baseRadius(row/ROWS)+before.offsets.slice(row*COLS,(row+1)*COLS).reduce((sum,x)=>sum+x,0)/COLS);
  const shift=clamp(upward/(2*before.height),-.1,.1);
  for(let row=0;row<=ROWS;row++){
    const t=row/ROWS,weight=Math.exp(-2*((t-v)/.24)**2),source=clamp(t-shift*weight,0,1)*ROWS;
    const low=Math.floor(source),radius=radii[low]+(radii[Math.min(ROWS,low+1)]-radii[low])*(source-low);
    const offset=clamp(radius+outward*weight-baseRadius(t),-.38,.5);
    model.offsets.fill(offset,row*COLS,(row+1)*COLS);
  }
}
export function area(points){return Math.abs(points.reduce((s,p,i)=>{const q=points[(i+1)%points.length];return s+p[0]*q[1]-q[0]*p[1];},0))/2;}
export function unwrap(points){if(!points.length)return [];const out=[points[0].slice()];for(let i=1;i<points.length;i++){let [u,v]=points[i];while(u-out[i-1][0]>.5)u-=1;while(u-out[i-1][0]<-.5)u+=1;out.push([u,v]);}return out;}
export function pointSegmentDistance(p,a,b){const x=b[0]-a[0],y=b[1]-a[1];const t=clamp(((p[0]-a[0])*x+(p[1]-a[1])*y)/(x*x+y*y||1),0,1);return Math.hypot(p[0]-a[0]-t*x,p[1]-a[1]-t*y);}
export function eraseAt(model,u,v){model.marks=model.marks.filter(m=>!m.points.some((p,i)=>[-1,0,1].some(k=>pointSegmentDistance([u+k,v],p,m.points[Math.min(i+1,m.points.length-1)])<.035)));}
export function validateModel(value){
  if(!value||value.version!==1||!Array.isArray(value.offsets)||value.offsets.length!==(ROWS+1)*COLS||!value.offsets.every(n=>Number.isFinite(n)&&n>=-.38&&n<=.5))return null;
  if(!Number.isFinite(value.height)||value.height<.65||value.height>1.45||!Number.isInteger(value.stage)||value.stage<1||value.stage>9)return null;
  const validPoints=(p,limit,range)=>Array.isArray(p)&&p.length<=limit&&p.every(a=>Array.isArray(a)&&a.length===2&&a.every(n=>Number.isFinite(n)&&Math.abs(n)<=range));
  if(!validPoints(value.crown,600,1)||!Array.isArray(value.marks)||value.marks.length>300||!value.marks.every(m=>['carve','press','hole','ear'].includes(m.tool)&&validPoints(m.points,1000,3)))return null;
  if(!validPoints(value.brush,6000,1)||!Number.isFinite(value.dug)||value.dug<0||value.dug>100)return null;
  return {...value,fired:!!value.fired,assembled:!!value.assembled};
}
export function createHistory(limit=24){const entries=[];return {get length(){return entries.length;},push(model){entries.push(structuredClone(model));if(entries.length>limit)entries.shift();},pop(){return entries.pop();},clear(){entries.length=0;}};}

// Restore only the edited stage's fields; a body undo must keep later faces and openings.
export function createWorkshopHistory(limit=24){
  const fields={1:['height','offsets'],2:['crown'],3:['marks']};
  const histories={1:createHistory(limit),2:createHistory(limit),3:createHistory(limit)};
  return {
    count:stage=>histories[stage]?.length||0,
    push(stage,model){if(fields[stage])histories[stage].push(Object.fromEntries(fields[stage].map(key=>[key,model[key]])));},
    pop(stage,model){const edit=histories[stage]?.pop();if(!edit)return;const restored={...model,...edit};invalidateProcess(restored);return restored;},
    clear(){Object.values(histories).forEach(history=>history.clear());}
  };
}
