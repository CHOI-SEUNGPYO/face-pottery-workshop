import {area,unwrap,profileY,shapedRadius,ROWS,SURFACE_ROWS,freshModel} from './model.js';
import {strokeContour} from './contour.js';

export function closedStroke(points){
  if(points.length<4)return false;
  const p=unwrap(points),xs=p.map(q=>q[0]),ys=p.map(q=>q[1]);
  const w=Math.max(...xs)-Math.min(...xs),h=Math.max(...ys)-Math.min(...ys);
  // A child need not land on the first pixel. Keep the drawn boundary and
  // bridge a small closing gap, including small eyes and UV-seam crossings.
  return area(p)>.000015&&Math.hypot((p[0][0]-p.at(-1)[0])*3,p[0][1]-p.at(-1)[1])<Math.hypot(w*3,h)*.35;
}

export function openingLoop(mark,model){
  if(!['hole','ear'].includes(mark.tool)&&!(mark.tool==='carve'&&closedStroke(mark.points)))return null;
  const points=unwrap(mark.points);if(!points.length)return null;
  if(points.length<3){
    const frame=openingFrame(points,model),[x,y]=frame.toPlane(points[0]),w=mark.tool==='ear'?.10:.055,h=mark.tool==='ear'?.10:.065;
    return Array.from({length:32},(_,i)=>frame.fromPlane([x+Math.cos(i/32*Math.PI*2)*w,y+Math.sin(i/32*Math.PI*2)*h]));
  }
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;
  const scale=Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys))/.9;
  if(!scale)return null;
  const loop=strokeContour(points.map(([u,v])=>[(u-cx)/scale,(v-cy)/scale]));
  return loop.length>=3?loop.map(([x,y])=>[x*scale+cx,y*scale+cy]):null;
}

export function openingFrame(loop,model=freshModel()){
  const us=loop.map(p=>p[0]),vs=loop.map(p=>p[1]),centre=(Math.min(...us)+Math.max(...us))/2;
  const circumference=2*Math.PI*Math.max(.12,shapedRadius(model,(Math.min(...vs)+Math.max(...vs))/2*ROWS,0));
  // Measure distance along the actual meridian, not its height. A folded
  // shoulder can have a long surface span in almost no vertical space.
  const arc=[0];let previous=[shapedRadius(model,0,0),profileY(model,0)];
  for(let i=1;i<=SURFACE_ROWS;i++){const p=[shapedRadius(model,i/SURFACE_ROWS*ROWS,0),profileY(model,i/SURFACE_ROWS)];arc.push(arc.at(-1)+Math.hypot(p[0]-previous[0],p[1]-previous[1]));previous=p;}
  const toPlane=([u,v])=>{const row=Math.max(0,Math.min(SURFACE_ROWS,v*SURFACE_ROWS)),i=Math.min(SURFACE_ROWS-1,Math.floor(row));return [(u-centre)*circumference,arc[i]+(arc[i+1]-arc[i])*(row-i)];};
  const fromPlane=([x,y])=>{
    let lo=0,hi=SURFACE_ROWS;while(hi-lo>1){const mid=(hi+lo)>>1;if(arc[mid]<y)lo=mid;else hi=mid;}
    const v=(lo+(y-arc[lo])/Math.max(1e-12,arc[hi]-arc[lo]))/SURFACE_ROWS;
    return [x/circumference+centre,Math.max(.00001,Math.min(.99999,v))];
  };
  const sampleLoop=points=>{
    const result=[];
    const edge=(a,b,depth=0)=>{
      const mid=a.map((v,i)=>(v+b[i])/2),p=toPlane(a),q=toPlane(b),m=toPlane(mid),error=Math.hypot(m[0]-(p[0]+q[0])/2,m[1]-(p[1]+q[1])/2);
      if(depth<12&&(Math.hypot(p[0]-q[0],p[1]-q[1])>.025||error>.0005)){edge(a,mid,depth+1);edge(mid,b,depth+1);}else result.push(a);
    };
    for(let i=0;i<points.length;i++)edge(points[i],points[(i+1)%points.length]);return result;
  };
  return {toPlane,fromPlane,sampleLoop};
}
export function raisedFootprint(loop,model){
  const {toPlane,fromPlane,sampleLoop}=openingFrame(loop,model);
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const hull=points=>{
    points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const half=ps=>{const h=[];for(const p of ps){while(h.length>1&&cross(h.at(-2),h.at(-1),p)<=0)h.pop();h.push(p);}return h.slice(0,-1);};
    return [...half(points),...half(points.slice().reverse())];
  };
  // A small rounded clay lobe encloses the child's exact opening. A convex
  // footprint and a triangulated hole cannot fold like paired scaled contours.
  const outline=hull(sampleLoop(loop).map(toPlane)),expanded=[];
  for(const p of outline)for(let i=0;i<12;i++){const a=i/12*Math.PI*2;expanded.push([p[0]+Math.cos(a)*.055,p[1]+Math.sin(a)*.055]);}
  return hull(expanded).map(fromPlane);
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
