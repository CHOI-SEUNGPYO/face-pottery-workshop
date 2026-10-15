import {area,pointSegmentDistance} from './model.js';

// Fill with nonzero winding: both an outlined star and a crossed star keep their centre.
// The small raster is only used once, on release, to resolve crossings before triangulation.
export function strokeContour(points){
  if(points.length<3)return [];
  const size=192,filled=new Uint8Array(size*size);
  for(let row=0;row<size;row++){
    const y=(row+.5)/size*2-1,crossings=[];
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length];
      if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y))crossings.push([a[0]+(y-a[1])/(b[1]-a[1])*(b[0]-a[0]),b[1]>a[1]?1:-1]);
    }
    crossings.sort((a,b)=>a[0]-b[0]);let winding=0,index=0;
    for(let col=0;col<size;col++){
      const x=(col+.5)/size*2-1;
      while(index<crossings.length&&crossings[index][0]<=x)winding+=crossings[index++][1];
      if(winding)filled[row*size+col]=1;
    }
  }
  const edges=new Map(),key=(x,y)=>y*(size+1)+x;
  const add=(x,y,xx,yy,dir)=>{const from=key(x,y);if(!edges.has(from))edges.set(from,[]);edges.get(from).push({to:key(xx,yy),dir});};
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(filled[y*size+x]){
    if(y===0||!filled[(y-1)*size+x])add(x,y,x+1,y,0);
    if(x===size-1||!filled[y*size+x+1])add(x+1,y,x+1,y+1,1);
    if(y===size-1||!filled[(y+1)*size+x])add(x+1,y+1,x,y+1,2);
    if(x===0||!filled[y*size+x-1])add(x,y+1,x,y,3);
  }
  let largest=[];
  while(edges.size){
    const start=edges.keys().next().value;let cursor=start,dir=0;const loop=[];
    do{
      loop.push([cursor%(size+1)/size*2-1,Math.floor(cursor/(size+1))/size*2-1]);
      const options=edges.get(cursor);if(!options)break;
      options.sort((a,b)=>[1,0,3,2].indexOf((a.dir-dir+4)%4)-[1,0,3,2].indexOf((b.dir-dir+4)%4));
      const next=options.shift();if(!options.length)edges.delete(cursor);cursor=next.to;dir=next.dir;
    }while(cursor!==start);
    if(area(loop)>area(largest))largest=loop;
  }
  if(area(largest)<.008)return [];
  const simplify=line=>{
    let far=0,index=0;
    for(let i=1;i<line.length-1;i++){const d=pointSegmentDistance(line[i],line[0],line.at(-1));if(d>far){far=d;index=i;}}
    return far>.009?[...simplify(line.slice(0,index+1)).slice(0,-1),...simplify(line.slice(index))]:[line[0],line.at(-1)];
  };
  const middle=Math.floor(largest.length/2);
  return [...simplify(largest.slice(0,middle+1)).slice(0,-1),...simplify([...largest.slice(middle),largest[0]]).slice(0,-1)];
}
