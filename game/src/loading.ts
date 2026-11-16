import {asset} from './assets';
import './loading-motion.css';

// The first loader is in index.html so its characters download before the game.
// Reuse the same fallback for all screen sizes and slow scene transfers.
export function initTravel(){
  document.querySelector('#travel')!.prepend(document.querySelector('.loading-friends')!.cloneNode(true));
}
let ready:Promise<boolean>|undefined;
export function prepareTravelArt(){
  return ready??=(async()=>{
    const travel=document.querySelector<HTMLElement>('#travel')!;
    const party=new Image(),vessel=travel.querySelector<HTMLImageElement>('.travel-vessel')!;
    party.src=asset('animations/party-travel.png');
    vessel.src=asset('animations/face-pot.png');
    await Promise.all([party.decode(),vessel.decode()]);
    travel.querySelector<HTMLElement>('.travel-party')!.style.backgroundImage=`url("${party.src}")`;
    travel.classList.add('art-ready');
    return true;
  })().catch(()=>{ready=undefined;return false;});
}

export async function playTravel(reduced:boolean){
  await prepareTravelArt();
  // Start the reading interval only when the complete illustration is ready.
  // A slow/hidden frame cannot consume the entire travel scene.
  await new Promise<void>(resolve=>{
    let elapsed=0,last=performance.now();
    const tick=(now:number)=>{
      if(!document.hidden)elapsed+=Math.min(200,now-last);
      last=now;
      if(elapsed>=(reduced?3000:3600))resolve();else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
