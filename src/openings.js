import {area,unwrap} from './model.js';
import {strokeContour} from './contour.js';

export function closedStroke(points){
  if(points.length<4)return false;
  const p=unwrap(points),xs=p.map(q=>q[0]),ys=p.map(q=>q[1]);
  const w=Math.max(...xs)-Math.min(...xs),h=Math.max(...ys)-Math.min(...ys);
  return area(p)>.00015&&Math.hypot((p[0][0]-p.at(-1)[0])*3,p[0][1]-p.at(-1)[1])<Math.max(.012,Math.hypot(w*3,h)*.18);
}

export function openingLoop(mark){
  if(!['hole','ear'].includes(mark.tool)&&!(mark.tool==='carve'&&closedStroke(mark.points)))return null;
  const points=unwrap(mark.points);if(!points.length)return null;
  if(points.length<3){const [u,v]=points[0],w=mark.tool==='ear'?.024:.012,h=mark.tool==='ear'?.05:.03;return Array.from({length:32},(_,i)=>[u+Math.cos(i/32*Math.PI*2)*w,v+Math.sin(i/32*Math.PI*2)*h]);}
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;
  const scale=Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys))/.9;
  if(!scale)return null;
  const loop=strokeContour(points.map(([u,v])=>[(u-cx)/scale,(v-cy)/scale]));
  return loop.length>=3?loop.map(([x,y])=>[x*scale+cx,y*scale+cy]):null;
}

export function raisedFootprint(loop){
  const xs=loop.map(p=>p[0]),ys=loop.map(p=>p[1]),w=Math.max(...xs)-Math.min(...xs),h=Math.max(...ys)-Math.min(...ys);
  const cx=(Math.max(...xs)+Math.min(...xs))/2,cy=(Math.max(...ys)+Math.min(...ys))/2;
  // ponytail: a scaled contour is enough for oval ear openings; very concave artwork can fold this skirt.
  return loop.map(([u,v])=>[cx+(u-cx)*(1+.035/Math.max(w,.001)),cy+(v-cy)*(1+.07/Math.max(h,.001))]);
}

export function insideLoop(u,v,loop){
  let winding=0;
  for(let i=0;i<loop.length;i++){
    const a=loop[i],b=loop[(i+1)%loop.length],cross=(b[0]-a[0])*(v-a[1])-(u-a[0])*(b[1]-a[1]);
    if(a[1]<=v&&b[1]>v&&cross>0)winding++;
    if(a[1]>v&&b[1]<=v&&cross<0)winding--;
  }
  return winding!==0;
}
export const insideOpening=(u,v,loops)=>loops.some(loop=>[-1,0,1].some(shift=>insideLoop(u+shift,v,loop)));
