export const systemMotion=matchMedia('(prefers-reduced-motion: reduce)');
let choice:boolean|undefined;
try{
  const saved=localStorage.getItem('togi-reduced');
  if(saved==='true'||saved==='false')choice=saved==='true';
}catch{/* A blocked preference store must not prevent the game from starting. */}

export function getReducedMotion(){return choice??systemMotion.matches;}

export function syncReducedMotion(){
  const reduced=getReducedMotion();
  document.documentElement.dataset.motion=reduced?'reduced':'full';
  document.body.classList.toggle('reduced-motion',reduced);
  return reduced;
}

export function setReducedMotion(reduced:boolean){
  choice=reduced;
  try{localStorage.setItem('togi-reduced',String(reduced));}catch{/* Keep this session's explicit choice. */}
  return syncReducedMotion();
}
