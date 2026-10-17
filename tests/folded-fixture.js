import {freshModel,ROWS,COLS,baseRadius} from '../src/model.js';

export function foldedModel(){
  const model=freshModel(),rings=[[0,.88],[.025,.68],[.075,.3],[.125,.23],[.2,.45],[.3,.55],[.45,.58],[.6,.65],[.75,.57],[.85,.4],[.925,.26],[1,0]];
  model.profile=Array.from({length:ROWS+1},(_,row)=>{
    const t=row/ROWS,i=rings.findIndex(p=>p[0]>=t);
    if(i<=0)return rings[0][1];
    const [a,x]=rings[i-1],[b,y]=rings[i];return x+(y-x)*(t-a)/(b-a);
  });
  model.profile.forEach((r,row)=>model.offsets.fill(r-baseRadius(row/ROWS),row*COLS,(row+1)*COLS));return model;
}

export function tallNeckModel(){
  const model=freshModel();
  const rings=[[0,1.03],[.08,1.02],[.16,.95],[.25,1.06],[.34,.86],[.42,.95],[.51,.82],[.6,.18],[.925,.18],[1,0]];
  model.profile=Array.from({length:ROWS+1},(_,row)=>{const t=row/ROWS,i=rings.findIndex(p=>p[0]>=t);if(i<=0)return rings[0][1];const [a,x]=rings[i-1],[b,y]=rings[i];return x+(y-x)*(t-a)/(b-a);});
  model.profile.forEach((r,row)=>model.offsets.fill(r-baseRadius(row/ROWS),row*COLS,(row+1)*COLS));return model;
}
