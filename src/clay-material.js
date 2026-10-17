// ponytail: axisymmetric game proxy, not measured clay or a hollow-wall FEM.
// Work in
// cross-sectional area: stretching thins clay, compression spreads it, and
// neighbouring sections share material instead of making razor-thin shelves.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function clayVolume(radii,levels){
  return areaVolume(radii.map(r=>r*r),levels);
}
function areaVolume(a,y){
  const d=a.slice(1).map((v,i)=>(v-a[i])/(y[i+1]-y[i])),t=d.map((v,i)=>i&&v*d[i-1]>0?2*v*d[i-1]/(v+d[i-1]):i?0:v);t.push(d.at(-1));
  return d.reduce((sum,_,i)=>{const h=y[i+1]-y[i];return sum+h*((a[i]+a[i+1])/2+h*(t[i]-t[i+1])/12);},0);
}
export function redistributeClay(beforeR,beforeY,radii,levels,pressure,contactY){
  const n=radii.length,old=beforeR.map(r=>r*r);let wanted=radii.map(r=>r*r);
  const changed=old.map((a,i)=>Math.abs(a-wanted[i])>1e-10||Math.abs(levels[i]-beforeY[i])>1e-10);
  if(!changed.some(Boolean))return radii;
  const shrink=Math.max(0,beforeY[n-1]-beforeY[0]-levels[n-1]+levels[0]),reach=.28+Math.min(.72,shrink*1.6);
  const free=changed.map((_,i)=>changed.some((yes,j)=>yes&&Math.abs(beforeY[i]-beforeY[j])<reach));free[0]=free[0]&&(changed[0]||shrink>0);free[n-1]=false;
  // Existing saved creases relax gradually under the hand, never on loading.
  const edges=levels.slice(1).map((y,i)=>2.1*(y-levels[i])+Math.max(0,Math.abs(old[i+1]-old[i])-2.1*(beforeY[i+1]-beforeY[i]))*(free[i]||free[i+1]?1-pressure:1));
  const distance=[0];for(const edge of edges)distance.push(distance.at(-1)+edge);
  const load=old.map((_,i)=>old.slice(i).reduce((s,a,j)=>s+a*((beforeY[i+j+1]??beforeY[i+j])-(beforeY[i+j-1]??beforeY[i+j]))/2,0));
  const lower=old.map((a,i)=>free[i]?Math.min(a+Math.max(0,Math.max(.18**2,load[i]/6)-a)*pressure,Math.max(.18**2,load[i]/6),2.1*(levels[n-1]-levels[i])):a),upper=old.map((a,i)=>free[i]?2.25:a);
  const mobility=old.map((_,i)=>free[i]?Math.min(1,Math.min(...beforeY.map((y,j)=>free[j]?Infinity:Math.abs(y-beforeY[i])))/.2)**2*(1-.94*Math.exp(-4*((levels[i]-contactY)/.2)**2)):0);
  // Smooth in physical distance, not ring numbers. Compressed material rings
  // must not become a stack of hard collars. The volume solve below returns
  // any displaced material to the same local patch.
  const smooth=()=>{
    const last=wanted;
    wanted=last.map((a,i)=>{
      if(!free[i])return a;let sum=0,weight=0;
      for(let j=0;j<n;j++){
        const q=(levels[i]-levels[j])/.16;if(Math.abs(q)>=1)continue;
        const w=(1-q*q)**3*((levels[j+1]??levels[j])-(levels[j-1]??levels[j]))/2;
        sum+=last[j]*w;weight+=w;
      }
      return a+(sum/weight-a)*.45*mobility[i]*pressure;
    });
  };
  for(let pass=0;pass<2;pass++)smooth();
  for(let i=0;i<n;i++)for(let j=0;j<n;j++)if(!free[j]){
    const d=Math.abs(distance[i]-distance[j]);lower[i]=Math.max(lower[i],old[j]-d);upper[i]=Math.min(upper[i],old[j]+d);
  }
  if(lower.some((a,i)=>a>upper[i]+1e-9))return null;
  const oldBend=old.map((a,i)=>{
    if(!i||i===n-1)return 0;const l=beforeY[i]-beforeY[i-1],r=beforeY[i+1]-beforeY[i];
    return Math.max(0,Math.abs(a-(old[i-1]*r+old[i+1]*l)/(l+r))-20*l*r)*(1-pressure);
  });
  const project=shift=>{
    const a=wanted.map((v,i)=>clamp(v+shift*mobility[i],lower[i],upper[i]));
    for(let pass=0;pass<18;pass++){
      for(let i=1;i<n-1;i++)if(free[i]){
        // Resist abrupt folds as well as steep shelves; a local bend can
        // remain, but its neighbours carry some of the deformation.
        const left=levels[i]-levels[i-1],right=levels[i+1]-levels[i],mean=(a[i-1]*right+a[i+1]*left)/(left+right),bend=20*left*right+oldBend[i];
        a[i]=clamp(a[i],Math.max(lower[i],mean-bend),Math.min(upper[i],mean+bend));
      }
      for(let i=1;i<n;i++)a[i]=Math.min(a[i],a[i-1]+edges[i-1]);
      for(let i=n-2;i>=0;i--)a[i]=Math.min(a[i],a[i+1]+edges[i]);
    }
    return a;
  };
  const volume=a=>areaVolume(a,levels);
  const target=clayVolume(beforeR,beforeY),low=volume(project(-5)),high=volume(project(5));
  if(target<low-1e-7||target>high+1e-7)return null;
  let result;
  for(let pass=0;pass<4;pass++){
    let lo=-5,hi=5;
    for(let i=0;i<32;i++){const mid=(lo+hi)/2;if(volume(project(mid))<target)lo=mid;else hi=mid;}
    result=project((lo+hi)/2);wanted=result;smooth();
  }
  return result.map((a,i)=>free[i]?Math.sqrt(Math.max(0,a)):beforeR[i]);
}
