export const ROWS = 40, COLS = 80;
export const SURFACE_ROWS = 120;
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
// New edits store the visible radii themselves. Legacy offsets are read once as
// a continuous radius curve, never blurred and then added back to a fixed cap.
function profileRadius(model,row,col){
  if(model.profile)return model.profile[row];
  if(row===ROWS)return 0;
  const sample=r=>r>ROWS?-sample(2*ROWS-r):r===ROWS?0:Math.max(.18,baseRadius(Math.max(0,r)/ROWS)+model.offsets[Math.max(0,r)*COLS+(col+COLS)%COLS]);
  let radius=0;
  for(let d=-7;d<=7;d++)radius+=sample(row+d)*(8-Math.abs(d))/64;
  return Math.max(0,radius);
}
export function shapedRadius(model,row,col){
  row=clamp(row,0,ROWS);
  // Round the closing end of the same meridian. Its width comes from the
  // edited neck, never the original vessel. Squared radius gives a horizontal
  // tangent at the pole instead of the old straight cone.
  const start=ROWS-3;
  if(row>start){
    const radius=profileRadius(model,start,col),previous=profileRadius(model,start-1,col);
    if(!radius)return 0;
    const slope=clamp(6*(radius-previous)/radius,-1,0),t=(row-start)/3;
    return radius*Math.sqrt(Math.max(0,(1-t)*(1+(1+slope)*t)));
  }
  const low=Math.floor(row),a=profileRadius(model,low,col),b=profileRadius(model,Math.min(ROWS,low+1),col);
  const previous=profileRadius(model,Math.max(0,low-1),col),next=profileRadius(model,Math.min(ROWS,low+2),col),t=row-low;
  const tangent=(x,y)=>x*y>0?2*x*y/(x+y):0;
  const m0=tangent(a-previous,b-a),m1=tangent(b-a,next-b);
  // Monotone Hermite interpolation rounds ring joins without inventing a
  // larger collar or overshooting the child's control radii.
  return clamp((2*t**3-3*t*t+1)*a+(t**3-2*t*t+t)*m0+(-2*t**3+3*t*t)*b+(t**3-t*t)*m1,Math.min(a,b),Math.max(a,b));
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
export function profileY(model,v){
  if(!model.profileLevels)return (v*2-1)*model.height;
  const row=clamp(v,0,1)*ROWS,low=Math.floor(row),a=model.profileLevels[low],b=model.profileLevels[Math.min(ROWS,low+1)];
  const previous=model.profileLevels[Math.max(0,low-1)],next=model.profileLevels[Math.min(ROWS,low+2)],t=row-low;
  const tangent=(x,y)=>x*y>0?2*x*y/(x+y):0;
  const m0=low?tangent(a-previous,b-a):b-a,m1=low<ROWS-1?tangent(b-a,next-b):b-a;
  return (2*t**3-3*t*t+1)*a+(t**3-2*t*t+t)*m0+(-2*t**3+3*t*t)*b+(t**3-t*t)*m1;
}
export function sampledProfile(model){
  return model.profile??Array.from({length:ROWS+1},(_,row)=>Array.from({length:COLS},(_,col)=>shapedRadius(model,row,col)).reduce((sum,x)=>sum+x,0)/COLS);
}
export function reshapeProfile(model,before,v,outward,upward){
  const radii=sampledProfile(before);
  const levels=Array.from({length:ROWS+1},(_,row)=>profileY(before,row/ROWS)),bottom=levels[0],top=levels[ROWS],held=profileY(before,v);
  const reach=.24,contact=t=>{const q=(profileY(before,t)-held)/reach;return Math.abs(q)>=1?0:(1-q*q)**3;};
  model.height=before.height;
  if(before.profileLevels)model.profileLevels=before.profileLevels.slice();else delete model.profileLevels;
  let influence=levels.map((_,row)=>contact(row/ROWS));
  if(upward){
    // Advect both coordinates through the same moving fingertip field. Moving
    // heights broadly but widths narrowly created a shelf on diagonal drags.
    const upper=top-held<.42,lower=held-bottom<.06;
    const gap=Math.min(.08,(held-bottom)/2,(top-held)/2);
    const target=upper?clamp(held+upward,Math.min(held,bottom+.22),held+1.45-top):lower?clamp(held+upward,held-1.45-bottom,Math.max(held,top-.22)):clamp(held+upward,bottom+gap,top-gap);
    const delta=target-held;
    if(delta){
      const margin=Math.max(.004,Math.min(reach,lower?reach:Math.min(held,target)-bottom,upper?reach:top-Math.max(held,target)));
      const steps=Math.ceil(Math.abs(delta)/(margin/8)),step=delta/steps;
      const force=(y,hand)=>{
        if(y>=hand&&upper||y<=hand&&lower)return 1;
        const span=y<hand?Math.min(reach,hand-bottom):Math.min(reach,top-hand),q=(y-hand)/Math.max(span,.000001);
        return Math.abs(q)<1?(1-q*q)**3:0;
      };
      model.profileLevels=levels.map(y=>{
        for(let i=0;i<steps;i++){
          const hand=held+i*step,k1=force(y,hand),k2=force(y+step*k1/2,hand+step/2),k3=force(y+step*k2/2,hand+step/2),k4=force(y+step*k3,hand+step);
          y+=step*(k1+2*k2+2*k3+k4)/6;
        }
        return y;
      });
      influence=levels.map((y,i)=>clamp((model.profileLevels[i]-y)/delta,0,1));
      model.height=(model.profileLevels[ROWS]-model.profileLevels[0])/2;
    }
  }
  model.profile=[];const contactWeights=[];
  for(let row=0;row<=ROWS;row++){
    const weight=influence[row],radius=radii[row];
    const next=row===ROWS?0:clamp(radius+outward*weight,.18*Math.min(1,(ROWS-row)/3),1.5);
    model.profile.push(next);contactWeights.push(weight);
  }
  if(upward){
    const touchY=profileY(model,v),touchRadius=shapedRadius(before,v*ROWS,0)+outward;
    for(let row=1;row<ROWS;row++){
      const a=(row-1)/ROWS,b=(row+1)/ROWS;
      const compression=clamp(1-(profileY(model,b)-profileY(model,a))/(profileY(before,b)-profileY(before,a)),0,1);
      const distance=Math.hypot(profileY(model,row/ROWS)-touchY,model.profile[row]-touchRadius)/reach;
      // Fair a crease formed directly under the hand, not every compressed
      // ring along the stroke. Distant lower fullness must retain its width.
      const local=distance<1?(1-distance*distance)**3:0;
      contactWeights[row]=Math.max(contactWeights[row],compression*local);
    }
  }
  // Relax creases only in the touched patch. A zero-motion re-grab must leave
  // the saved profile intact, and untouched rows are never faired globally.
  const pressure=Math.min(1,Math.hypot(outward,upward)/.12),heldRow=Math.min(ROWS-3,Math.round(v*ROWS));
  const editedLevels=model.profile.map((_,row)=>profileY(model,row/ROWS));
  const atHeight=(radii,y)=>{
    if(y<=editedLevels[0])return radii[0];if(y>=editedLevels[ROWS])return radii[ROWS];
    let lo=0,hi=ROWS;while(hi-lo>1){const mid=(hi+lo)>>1;if(editedLevels[mid]<=y)lo=mid;else hi=mid;}
    return radii[lo]+(radii[hi]-radii[lo])*(y-editedLevels[lo])/(editedLevels[hi]-editedLevels[lo]);
  };
  for(let pass=0;pass<8&&pressure;pass++){
    const previous=model.profile.slice();
    for(let row=1;row<ROWS;row++){
      if(row===heldRow)continue;
      const blend=.7*pressure*Math.sqrt(contactWeights[row]);
      if(!blend)continue;
      // Use millimetres of clay, not ring indices: after stretching, adjacent
      // material rings may be very far apart or stacked into a tiny crease.
      let total=0,weight=0;
      for(let sample=-4;sample<=4;sample++){
        const w=(1-(sample/5)**2)**3;total+=atHeight(previous,editedLevels[row]+sample*.03)*w;weight+=w;
      }
      model.profile[row]=clamp(previous[row]+(total/weight-previous[row])*blend,.18*Math.min(1,(ROWS-row)/3),1.5);
    }
  }
  for(let row=0;row<=ROWS;row++){
    const offset=model.profile[row]-baseRadius(row/ROWS);
    model.offsets.fill(offset,row*COLS,(row+1)*COLS);
  }
}
export function area(points){return Math.abs(points.reduce((s,p,i)=>{const q=points[(i+1)%points.length];return s+p[0]*q[1]-q[0]*p[1];},0))/2;}
export function unwrap(points){if(!points.length)return [];const out=[points[0].slice()];for(let i=1;i<points.length;i++){let [u,v]=points[i];while(u-out[i-1][0]>.5)u-=1;while(u-out[i-1][0]<-.5)u+=1;out.push([u,v]);}return out;}
export function pointSegmentDistance(p,a,b){const x=b[0]-a[0],y=b[1]-a[1];const t=clamp(((p[0]-a[0])*x+(p[1]-a[1])*y)/(x*x+y*y||1),0,1);return Math.hypot(p[0]-a[0]-t*x,p[1]-a[1]-t*y);}
export function eraseAt(model,u,v){model.marks=model.marks.filter(m=>!m.points.some((p,i)=>[-1,0,1].some(k=>pointSegmentDistance([u+k,v],p,m.points[Math.min(i+1,m.points.length-1)])<.035)));}
export function validateModel(value){
  if(!value||value.version!==1||!Array.isArray(value.offsets)||value.offsets.length!==(ROWS+1)*COLS||!value.offsets.every(n=>Number.isFinite(n)&&n>=-.9&&n<=1.5))return null;
  if(!Number.isFinite(value.height)||value.height<.109999||value.height>1.450001||!Number.isInteger(value.stage)||value.stage<1||value.stage>9)return null;
  if(value.profileLevels!==undefined&&(!Array.isArray(value.profileLevels)||value.profileLevels.length!==ROWS+1||!value.profileLevels.every((y,i)=>Number.isFinite(y)&&y>=-1.450001&&y<=1.450001&&(!i||y>value.profileLevels[i-1]))||Math.abs(value.profileLevels[ROWS]-value.profileLevels[0]-2*value.height)>1e-6))return null;
  if(value.profile!==undefined&&(!Array.isArray(value.profile)||value.profile.length!==ROWS+1||!value.profile.every(n=>Number.isFinite(n)&&n>=0&&n<=1.5)||value.profile[ROWS]!==0))return null;
  const validPoints=(p,limit,range)=>Array.isArray(p)&&p.length<=limit&&p.every(a=>Array.isArray(a)&&a.length===2&&a.every(n=>Number.isFinite(n)&&Math.abs(n)<=range));
  if(!validPoints(value.crown,600,1)||!Array.isArray(value.marks)||value.marks.length>300||!value.marks.every(m=>['carve','press','hole','ear'].includes(m.tool)&&validPoints(m.points,1000,3)))return null;
  if(!validPoints(value.brush,6000,1)||!Number.isFinite(value.dug)||value.dug<0||value.dug>100)return null;
  return {...value,fired:!!value.fired,assembled:!!value.assembled};
}
export function createHistory(limit=24){const entries=[];return {get length(){return entries.length;},push(model){entries.push(structuredClone(model));if(entries.length>limit)entries.shift();},pop(){return entries.pop();},clear(){entries.length=0;}};}

// Restore only the edited stage's fields; a body undo must keep later faces and openings.
export function createWorkshopHistory(limit=24){
  const fields={1:['height','offsets','profile','profileLevels'],2:['crown'],3:['marks']};
  const histories={1:createHistory(limit),2:createHistory(limit),3:createHistory(limit)};
  return {
    count:stage=>histories[stage]?.length||0,
    push(stage,model){if(fields[stage])histories[stage].push(Object.fromEntries(fields[stage].map(key=>[key,model[key]])));},
    pop(stage,model){const edit=histories[stage]?.pop();if(!edit)return;const restored={...model,...edit};if(restored.profile===undefined)delete restored.profile;if(restored.profileLevels===undefined)delete restored.profileLevels;invalidateProcess(restored);return restored;},
    clear(){Object.values(histories).forEach(history=>history.clear());}
  };
}
