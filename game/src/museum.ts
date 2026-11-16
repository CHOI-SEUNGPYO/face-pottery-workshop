import {validCatalog} from '../content/schema.mjs';
import {icon} from './icons';
import type {SceneId} from './model';
import type {StoryBlock} from './content';
export type PhotoCategory='face'|'siru'|'background'|'other';
export interface MuseumPhoto {id:string;file:string;alt:string;caption:string;credit:string;source:string;title?:string;category?:PhotoCategory}
export interface MuseumCatalog {
  version:number;title:string;photos:MuseumPhoto[];
  sources?:{id:string;title:string;url:string}[];
  artifact?:{name:string;academicName:string;hanja:string;meaning:string;fields:{label:string;value:string}[];note:string;sources:string[]};
  stages:Record<SceneId,{title:string;summary:string;photo:string;blocks:StoryBlock[]}>;
  exhibits:{id:string;name:string;file:string;height:number;position:[number,number,number];rotation:number;stage:SceneId}[];
}
export let museum:MuseumCatalog;
export const museumAsset=(file:string)=>import.meta.env.DEV?`/asset/runtime/museum/${file}`:`${import.meta.env.BASE_URL}museum/assets/${file}`;
export const escapeHTML=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function photoFor(stage:SceneId){return museum.photos.find(p=>p.id===museum.stages[stage].photo)!;}
export const factLabels={fact:'확인된 내용',interpretation:'연구자의 해석',imagination:'게임 속 상상'};
export function sourceLinks(ids:string[]=[]) {
  const sources=(museum.sources??[]).filter(source=>ids.includes(source.id));
  return sources.length?`<div class="research-sources" aria-label="설명 근거"><small>설명 근거</small>${sources.map(s=>`<a href="${escapeHTML(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(s.title)} ↗</a>`).join('')}</div>`:'';
}
export function artifactLabel(){
  const a=museum.artifact;if(!a)return '';
  return `<section class="artifact-label" aria-label="실제 유물 정보"><small>실제 유물 · ${escapeHTML(a.name)}</small><h3>${escapeHTML(a.academicName)}</h3><p class="artifact-hanja">${escapeHTML(a.hanja)}</p><p>${escapeHTML(a.meaning)}</p><dl>${a.fields.map(f=>`<dt>${escapeHTML(f.label)}</dt><dd>${escapeHTML(f.value)}</dd>`).join('')}</dl><details><summary>명칭과 시대를 읽는 방법</summary><p>${escapeHTML(a.note)}</p>${sourceLinks(a.sources)}</details></section>`;
}
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
  const subject=stage==='excavation'?'발굴':'유물';
  return `<aside class="story-dock" aria-label="${subject} 이야기"><button class="story-teaser" data-action="story" aria-label="${subject} 사진과 이야기: ${e(entry.title)}" title="${subject} 사진과 이야기"><span class="story-compact-icon" aria-hidden="true">${icon('story')}</span><span class="story-mobile-label" aria-hidden="true">${subject}<br>이야기</span><img src="${museumAsset(photo.file)}" alt="${e(photo.alt)}"><span class="story-teaser-copy"><small>${subject} 이야기 · ${factLabels[entry.blocks[0].kind]}</small><strong>${e(entry.title)}</strong><span>${e(entry.summary)}</span><em>사진과 이야기 보기 ↗</em></span></button></aside>`;
}
