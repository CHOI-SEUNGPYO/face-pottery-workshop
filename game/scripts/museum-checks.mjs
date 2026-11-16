import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

async function imagesLoaded(page,selector){
 await page.locator(selector).evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
 assert.ok(await page.locator(selector).evaluateAll(images=>images.length>0&&images.every(image=>image.naturalWidth>0&&image.naturalHeight>0)));
}
async function review(page,name){
 if(process.env.TOGI_MUSEUM_REVIEW!=='1')return;
 await mkdir('asset/review',{recursive:true});await page.screenshot({path:`asset/review/museum-${name}.png`});
}
async function dialogBounds(page,controls=[]){
 const problems=await page.evaluate(selectors=>{
  const errors=[];
  for(const selector of ['#dialog','.modal-close',...selectors]){
   const el=document.querySelector(selector),r=el.getBoundingClientRect();
   if(!r.width||r.x<0||r.y<0||r.right>innerWidth+1||r.bottom>innerHeight+1)errors.push(`${selector} clipped`);
   const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
   if(selector!== '#dialog'&&!el.contains(hit))errors.push(`${selector} obstructed`);
  }
  const content=document.querySelector('.museum-album,.museum-ending,.museum-credits');
  if(content.scrollWidth>content.clientWidth+1)errors.push('content overflows horizontally');
  return errors;
 },controls);
 assert.deepEqual(problems,[],`${page.viewportSize().width} museum dialog layout`);
}
export async function checkMuseumWelcome(page,viewports=[{width:1366,height:768},{width:320,height:568},{width:740,height:360},{width:768,height:1024}]){
 for(const viewport of viewports){
  await page.setViewportSize(viewport);
  await imagesLoaded(page,'.welcome-copy .partner-marks img');
  await review(page,`welcome-${viewport.width}`);
  await page.locator('#hud [data-action="collection"]').click();
  await imagesLoaded(page,'.album-image img');
  assert.match(await page.locator('.artifact-label').textContent(),/투각인면문옹형토기/);
  assert.equal(await page.locator('.album-photo-list button').count(),4);
  assert.ok(await page.locator('[data-action="album-previous"]').isDisabled());
  await page.keyboard.press('ArrowRight');
  assert.match(await page.locator('.album-image img').getAttribute('src'),/face-reference.jpg$/);
  await page.locator('[data-action="album-group-siru"]').click();
  await imagesLoaded(page,'.album-image img');
  assert.match(await page.locator('.album-figure figcaption').textContent(),/文化財|문화재청/);
  assert.equal(await page.locator('.album-photo-list button').count(),1);
  assert.ok(await page.locator('[data-action="album-next"]').isDisabled());
  await dialogBounds(page,['.album-tabs','.album-controls',...['face','siru','background'].map(c=>`[data-action="album-group-${c}"]`)]);
  if(viewport.width===320||viewport.width===1366)await review(page,`siru-${viewport.width}`);
  await page.locator('[data-action="album-group-background"]').click();
  assert.equal(await page.locator('.album-photo-list button').count(),8);
  await page.locator('[data-action="album-photo-7"]').click();
  await imagesLoaded(page,'.album-image img');
  assert.match(await page.locator('.album-image img').getAttribute('src'),/background-10.jpg$/);
  assert.ok(await page.locator('[data-action="album-next"]').isDisabled());
  await page.locator('[data-action="album-previous"]').click();
  assert.match(await page.locator('.album-image img').getAttribute('src'),/background-9.jpg$/);
  await page.locator('[data-action="album-back"]').click();
  assert.equal(await page.locator('#dialog').evaluate(d=>d.open),false);
  await page.locator('[data-action="credits"]').click();
  await imagesLoaded(page,'.museum-credits .partner-marks img');
  await dialogBounds(page);
  assert.match(await page.locator('.museum-credits').textContent(),/AI를 활용한 디지털 뮤지엄 큐레이팅 과정/);
  assert.doesNotMatch(await page.locator('.museum-credits').textContent(),/100%|Higgsfield/);
  if(viewport.width===1366)await review(page,'credits');
  await page.locator('.modal-close').click();
 }
 await page.setViewportSize({width:1366,height:768});
}

export async function checkMuseumEnding(page){
 assert.ok(await page.locator('.museum-ending').isVisible(),'museum outro opens without requiring a photo');
 await imagesLoaded(page,'.museum-ending img');
 assert.match(await page.locator('.artifact-label').textContent(),/透刻人面文甕形土器/);
 await page.locator('.artifact-label summary').click();
 assert.match(await page.locator('.artifact-label details').textContent(),/5세기.*6세기/);
 assert.ok(await page.locator('.artifact-label .research-sources a').count()>=2);
 await page.locator('.artifact-label summary').click();
 await dialogBounds(page);
 assert.match(await page.locator('.ending-partners').textContent(),/영남대학교 인문사회디지털융합인재양성사업단/);
 assert.equal(await page.locator('.ending-photos button').count(),3);
 await review(page,`ending-${page.viewportSize().width}`);
 await page.locator('[data-action="collection-face"]').click();
 await imagesLoaded(page,'.album-image img');
 await page.locator('[data-action="album-back"]').click();
 assert.ok(await page.locator('.museum-ending').isVisible(),'album returns to the outro');
 await page.locator('.ending-actions [data-action="close"]').click();
 assert.equal(await page.locator('#dialog').evaluate(d=>d.open),false);
}
