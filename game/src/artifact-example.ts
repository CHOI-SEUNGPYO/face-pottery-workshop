import {createSoftDocument,applyForm,formRadius} from './form';
import {addSurfaceFeature,refineFeature} from './features';
import type {UV} from './model';

export const EXAMPLE_LABEL='AI가 게임 도구로 만든 재현 예시';
/** The same form, opening and refinement operations available to the player.
 * Authored from the supplied three-face photos; not a scan or measured replica.
 * Deliberately keeps the game's clay and its editable seven-point profile.
 */
export function createArtifactExample(){
  const d=createSoftDocument();
  d.mouth.neckHeight=.035;
  applyForm(d,{height:1.58,width:1.17,radii:[.38,.357,.362,.472,.46,.35,.10]});
  const opening=(id:string,u:number,v:number,w:number,h:number,tilt=0,raised=false)=>{
    const radius=formRadius(d.form!,v);
    const points:UV[]=Array.from({length:48},(_,i)=>{
      const a=i*Math.PI/24,x=Math.cos(a)*w;
      // Slightly pointed, unequal ends distinguish the leaf eyes from the noses.
      const y=Math.sin(a)*h*(id.includes('eye')?.82+.18*Math.cos(a):1);
      return [u+x/(2*Math.PI*radius),v+(y+tilt*x)/d.form!.height];
    });
    const feature={id,kind:raised?'raised-hole' as const:'hole' as const,points,width:.004};
    const issue=addSurfaceFeature(d,feature);
    if(issue)throw new Error(`Example opening ${id}: ${issue}`);
    const added=d.features.find(f=>f.id===id);
    if(added){const issue=refineFeature(d,added);if(issue)throw new Error(`Example refinement ${id}: ${issue}`);}
  };
  for(let face=0;face<3;face++){
    const u=face/3;
    opening(`example-${face}-eye-left`,u-.056,.782,.101,.024,-.09);
    opening(`example-${face}-eye-right`,u+.056,.790-face*.006,.106,face===1?.017:.025,.16);
    opening(`example-${face}-nose-left`,u-.025,.697,.024,.031);
    opening(`example-${face}-nose-right`,u+.025,.691,.026,.028);
    opening(`example-${face}-mouth`,u,.600-face*.006,.132,face===1?.012:.032,face===2?-.03:.05);
    opening(`example-${face}-side`,u+1/6,.746,.063,.078,-.05,true);
  }
  d.revision='ai-game-example-1';
  return d;
}
