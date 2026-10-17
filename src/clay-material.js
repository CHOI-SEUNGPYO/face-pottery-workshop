// Diagnostic volume of the continuous squared-radius meridian.
export function clayVolume(radii,levels){
  return areaVolume(radii.map(r=>r*r),levels);
}
function areaVolume(a,y){
  const d=a.slice(1).map((v,i)=>(v-a[i])/(y[i+1]-y[i])),t=d.map((v,i)=>i&&v*d[i-1]>0?2*v*d[i-1]/(v+d[i-1]):i?0:v);t.push(d.at(-1));
  return d.reduce((sum,_,i)=>{const h=y[i+1]-y[i];return sum+h*((a[i]+a[i+1])/2+h*(t[i]-t[i+1])/12);},0);
}
