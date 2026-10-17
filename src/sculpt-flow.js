// Kelvinlet translation kernel (de Goes/James 2017), averaged around a ring.
// Translation kernel adapted from Facebook's BSD sculpting sample; see
// vendor/KELVINLETS-LICENSE.txt. The ring and ground reflection are game code.
const angles=Array.from({length:20},(_,i)=>[Math.cos(i*Math.PI/10),Math.sin(i*Math.PI/10)]);
const kelvinScales=[[1,1],[1.5,-12/7],[2,5/7]];
const EPS=.45;
const bendLimit=r=>Math.max(4,1/Math.max(.12,r*.35+.04));
function lift(y,hand,bottom,top,carry){
  const lower=y<hand,span=Math.max(.02,Math.min(carry?1:.65,lower?hand-bottom:top-hand));
  if(!lower&&carry)return [1,0];
  const t=Math.max(0,Math.min(1,lower?1+(y-hand)/span:1-(y-hand)/span));
  return [t*t*t*(10-15*t+6*t*t),30*t*t*(1-t)*(1-t)/span*(lower?1:-1)];
}
function cap(y,hand,top){
  const span=Math.max(.08,top-hand),t=Math.max(0,Math.min(1,(y-hand)/span));
  return [t*t*t*(10-15*t+6*t*t),30*t*t*(1-t)*(1-t)/span];
}
function geometry(r,y){
  const slope=r.slice(1).map((v,i)=>Math.abs(v*v-r[i]*r[i])/(y[i+1]-y[i])),angle=r.slice(1).map((v,i)=>Math.atan2(v-r[i],y[i+1]-y[i]));
  const bend=angle.slice(1).map((v,i)=>Math.abs(v-angle[i])*2/(Math.hypot(r[i+1]-r[i],y[i+1]-y[i])+Math.hypot(r[i+2]-r[i+1],y[i+2]-y[i+1])));
  return {slope,bend};
}
function velocity(r,y,cr,cy,bottom,fr,fy,epsilon=EPS){
  let vr=0,vy=0;
  for(const [c,s] of angles)for(let image=0;image<2;image++){
    const x=r-cr*c,z=-cr*s,h=y-(image?2*bottom-cy:cy),fx=fr*c,fz=fr*s,fv=image?-fy:fy;
    const dot=x*fx+z*fz+h*fv,d=x*x+z*z+h*h;
    // Cancel the two leading far-field terms while retaining div(u)=0.
    for(const [scale,sign] of kelvinScales){
      const eps=epsilon*scale;
      const re=Math.sqrt(d+eps*eps),b=.5/re**3,a=.5/re+eps*eps*b;
      vr+=sign*(a*fx+b*x*dot);vy+=sign*(a*fv+b*h*dot);
    }
  }
  return [vr/angles.length,vy/angles.length];
}
function grab(radii,levels,heldR,heldY,outward,upward){
  const n=radii.length,bottom=levels[0],top=levels[n-1],distance=Math.hypot(outward,upward),count=Math.max(1,Math.ceil(Math.min(3,distance)/.035));
  const scale=distance>3?3/distance:1;outward*=scale;upward*=scale;
  let r=radii.slice(),y=levels.slice();
  const original=geometry(r,y),slope=Math.max(...original.slope),bend=Math.max(...original.bend);
  const maxSlope=(slope>3.5?slope*1.2:Math.max(3,slope))*1.00001,legacyBend=original.bend.some((v,i)=>v>bendLimit(r[i+1])*1.04)?bend*1.2:0;
  const contactR=Math.max(.24,heldR),contactY=Math.max(bottom+.12,Math.min(top-.12,heldY));
  // Re-gripping an already tight bend shares pressure over a wider patch.
  // Keep this radius fixed for the whole gesture, so event frequency or a
  // single large pointer move cannot switch the shape underneath the hand.
  const tight=original.bend.reduce((v,k,i)=>Math.hypot(r[i+1]-heldR,y[i+1]-heldY)<.3?Math.max(v,k/bendLimit(r[i+1])):v,0);
  const brush=EPS+(legacyBend?0:.2*Math.max(0,Math.min(1,(tight-.7)/.3))),field=(...args)=>velocity(...args,heldR<.05?.9:brush);
  for(let step=0;step<count;step++){
    const t=(step+.5)/count,cr=Math.max(.12,contactR+outward*t),cy=contactY+upward*t;
    const gripR=heldR<.05?0:Math.max(.05,heldR+outward*t),gripY=Math.max(bottom+.12,heldY+upward*t),rx=heldR<.05?cr:gripR,hy=heldR<.05?cy:gripY;
    const radial=field(rx,hy,cr,cy,bottom,1,0),vertical=field(rx,hy,cr,cy,bottom,0,1),coupling=-field(gripR,gripY,cr,cy,bottom,1,0)[1]/field(gripR,gripY,cr,cy,bottom,0,1)[1];
    const fr=outward/(radial[0]+vertical[0]*coupling)/count,fk=fr*coupling,fy=upward/count;
    const pole=top+upward*t,carry=top-heldY<.42,fc=upward&&carry&&top-heldY>.08?-field(0,pole,cr,cy,bottom,fr,fk)[1]:0;
    const integrate=fraction=>{
      const nextR=[],nextY=[];
      for(let i=0;i<n;i++){
      const at=(x,h)=>{
        const radial=fr?field(x,h,cr,cy,bottom,fr*fraction,fk*fraction):[0,0],w=lift(h,gripY,bottom,top,carry),c=fc?cap(h,gripY,pole):[0,0];
        // div(u)=0: uY=w(Y), uR=-R*w'(Y)/2. Carry the upper clay with
        // the grip instead of leaving its closed top behind or pushing it up.
        return [radial[0]-.5*x*(w[1]*fy+c[1]*fc)*fraction,radial[1]+(w[0]*fy+c[0]*fc)*fraction];
      },k1=at(r[i],y[i]),k2=at(r[i]+k1[0]/2,y[i]+k1[1]/2),k3=at(r[i]+k2[0]/2,y[i]+k2[1]/2),k4=at(r[i]+k3[0],y[i]+k3[1]);
      nextR[i]=i===n-1?0:r[i]+(k1[0]+2*k2[0]+2*k3[0]+k4[0])/6;
      nextY[i]=i===0?bottom:y[i]+(k1[1]+2*k2[1]+2*k3[1]+k4[1])/6;
      // A tiny far-field tail must not block editing the head just because
      // an unrelated lower section has already reached its numeric bound.
      if(i<n-1&&Math.hypot(radii[i]-heldR,levels[i]-heldY)>.9)nextR[i]=Math.max(Math.min(.16,radii[i]),Math.min(1.5,nextR[i]));
      }return {radii:nextR,levels:nextY};
    };
    // Resistance is applied during the drag, never by reshaping on release.
    const valid=({radii:a,levels:b})=>{
      if(a.some((v,i)=>!Number.isFinite(v)||v<0||v>1.5||i<n-3&&v<Math.min(.16,radii[i]))||b.some((h,i)=>!Number.isFinite(h)||h>1.45||h<bottom||i&&h-b[i-1]<Math.min(.003,(levels[i]-levels[i-1])*.25)))return false;
      const shape=geometry(a,b);
      const quiet=i=>Math.hypot(radii[i]-heldR,levels[i]-heldY)>.65&&Math.hypot(a[i]-radii[i],b[i]-levels[i])<.003;
      return shape.slope.every((v,i)=>v<=maxSlope||v<=3.06&&quiet(i)&&quiet(i+1))&&shape.bend.every((v,i)=>v<=Math.max(bendLimit(a[i+1]),original.bend[i],legacyBend)*1.00001||v<=bendLimit(a[i+1])*1.02&&quiet(i)&&quiet(i+1)&&quiet(i+2));
    };
    let next=integrate(1);
    if(!valid(next)){
      let lo=0,hi=1;next={radii:r,levels:y};
      for(let i=0;i<10;i++){const f=(lo+hi)/2,candidate=integrate(f);if(valid(candidate)){lo=f;next=candidate;}else hi=f;}
      return next;
    }
    r=next.radii;y=next.levels;
  }
  return {radii:r,levels:y};
}
export function sculptFlow(radii,levels,heldR,heldY,outward,upward){
  const bottom=levels[0],top=levels.at(-1),palm=upward<0?Math.max(0,1-(top-heldY)/.16)**2:0;
  const result=outward||upward*(1-palm)?grab(radii,levels,heldR,heldY,outward,upward*(1-palm)):{radii:radii.slice(),levels:levels.slice()};
  if(palm){
    // A palm on the closed top compresses a supported lump, rather than
    // drilling a point into its axis. An incompressible affine squeeze has
    // determinant one and never invents a separate cap or compensation ring.
    const minimum=Math.max(.22/(top-bottom),(Math.max(...result.radii)/1.5)**2),s=Math.max(minimum,1+upward*palm/Math.max(.16,heldY-bottom));
    result.radii=result.radii.map(r=>r/Math.sqrt(s));result.levels=result.levels.map(y=>bottom+(y-bottom)*s);
  }
  return result;
}
