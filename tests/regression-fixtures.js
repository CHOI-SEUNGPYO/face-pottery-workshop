import {freshModel,ROWS,COLS,baseRadius} from '../src/model.js';
export function flaredFixture(){
 const m=freshModel(),points=[[0,.5,-1.18],[4,.5,-.85],[5,1.5,-.8],[6,.45,-.79],[14,.18,-.15],[29,1.5,.8],[30,1,.81],[37,.25,1.1],[40,0,1.18]];
 m.profile=[];m.profileLevels=[];
 for(let i=0;i<=ROWS;i++){
  const j=points.findIndex(p=>p[0]>=i);if(!j){m.profile.push(points[0][1]);m.profileLevels.push(points[0][2]);continue;}
  const [a,b]=[points[j-1],points[j]],t=(i-a[0])/(b[0]-a[0]);m.profile.push(a[1]+(b[1]-a[1])*t);m.profileLevels.push(a[2]+(b[2]-a[2])*t);
 }
 for(let i=0;i<=ROWS;i++)m.offsets.fill(m.profile[i]-baseRadius(i/ROWS),i*COLS,(i+1)*COLS);
 return m;
}
export function concaveEar(u=0,v=.18){return {tool:'ear',points:[[u-.035,v-.025],[u+.035,v-.025],[u+.035,v],[u,v],[u,v+.04],[u-.035,v+.04],[u-.035,v-.025]]};}
