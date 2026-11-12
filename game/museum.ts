import {validCatalog} from '../content/schema.mjs';
import type {SceneId} from './model';
import type {StoryBlock} from './content';
export interface MuseumPhoto {id:string;file:string;alt:string;caption:string;credit:string;source:string}
export interface MuseumCatalog {
  version:number;title:string;photos:MuseumPhoto[];
  stages:Record<SceneId,{title:string;summary:string;photo:string;blocks:StoryBlock[]}>;
  exhibits:{id:string;name:string;file:string;height:number;position:[number,number,number];rotation:number;stage:SceneId}[];
}
export let museum:MuseumCatalog;
export const museumAsset=(file:string)=>import.meta.env.DEV?`/asset/runtime/museum/${file}`:`${import.meta.env.BASE_URL}museum/assets/${file}`;
export const escapeHTML=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function photoFor(stage:SceneId){return museum.photos.find(p=>p.id===museum.stages[stage].photo)!;}
export const factLabels={fact:'확인된 내용',interpretation:'연구자의 해석',imagination:'게임 속 상상'};
export async function loadMuseum(){
  const url=import.meta.env.DEV?'/content/museum.json':`${import.meta.env.BASE_URL}museum/catalog.json`;
  const response=await fetch(url);
  if(!response.ok)throw Error('유물 자료를 불러오지 못했어요.');
  const value:unknown=await response.json();
  if(!validCatalog(value))throw Error('유물 자료 형식을 확인해 주세요.');
  museum=value as MuseumCatalog;
}
export function storyCard(stage:SceneId){
  const entry=museum.stages[stage],photo=photoFor(stage),e=escapeHTML;
  return `<aside class="story-dock" aria-label="유물 이야기"><button class="story-teaser" data-action="story"><img src="${museumAsset(photo.file)}" alt="${e(photo.alt)}"><span><small>유물 이야기 · ${factLabels[entry.blocks[0].kind]}</small><strong>${e(entry.title)}</strong><span>${e(entry.summary)}</span><em>사진과 이야기 보기 ↗</em></span></button></aside>`;
}
