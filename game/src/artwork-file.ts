import {COUNT,validateSave,type GameSave} from './model';

/** A portable copy only: exporting never writes to the player's repository. */
export function artworkFile(save:GameSave):string {
  if(!validateSave(save))throw new Error('invalid-artwork');
  return JSON.stringify({format:'togi-artwork',version:1,save},(_key,value)=>
    value instanceof Float64Array||value instanceof Uint8Array?Array.from(value):value);
}

export function readArtworkFile(text:string):GameSave {
  const file=JSON.parse(text);
  if(file?.format!=='togi-artwork'||file.version!==1||!file.save?.document)throw new Error('invalid-artwork-file');
  const save=file.save;
  for(const key of ['outerXYZ','innerXYZ']){
    if(!Array.isArray(save.document[key])||save.document[key].length!==COUNT*3||save.document[key].some((n:unknown)=>typeof n!=='number'||!Number.isFinite(n)))throw new Error('invalid-artwork-coordinates');
    save.document[key]=new Float64Array(save.document[key]);
  }
  if(!Array.isArray(save.excavationMask)||save.excavationMask.some((n:unknown)=>!Number.isInteger(n)||Number(n)<0||Number(n)>255))throw new Error('invalid-artwork-mask');
  save.excavationMask=new Uint8Array(save.excavationMask);
  if(!validateSave(save))throw new Error('invalid-artwork');
  return save;
}

export function downloadArtwork(save:GameSave){
  const url=URL.createObjectURL(new Blob([artworkFile(save)],{type:'application/json'}));
  const link=document.createElement('a');
  link.href=url;link.download=`내-얼굴모양토기-${new Date().toISOString().slice(0,10)}.togi.json`;
  link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
