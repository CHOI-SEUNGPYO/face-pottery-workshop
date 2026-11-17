import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';

const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
let browser;
try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  await mkdir('asset/review',{recursive:true});
  for(const viewport of [{width:1366,height:768},{width:768,height:1024},{width:390,height:696},{width:320,height:568},{width:740,height:360}]){
    if(process.env.TOGI_EXAMPLE_WIDTHS&&!process.env.TOGI_EXAMPLE_WIDTHS.split(',').includes(String(viewport.width)))continue;
    const context=await browser.newContext({viewport,hasTouch:viewport.width<1100,reducedMotion:'reduce',acceptDownloads:true});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    try{
      await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`);await page.locator('#loading').waitFor({state:'detached'});
      const expected=await page.evaluate(async()=>{
        const {freshSave}=await import('/src/model.ts'),{createArtifactExample}=await import('/src/artifact-example.ts');
        const {SaveRepository}=await import('/src/save.ts'),{artworkFile,readArtworkFile}=await import('/src/artwork-file.ts');
        const save=freshSave();save.document=createArtifactExample();save.stage='faces';save.rotation=1.234;
        await new SaveRepository().save(save);
        const json=artworkFile(save);if(artworkFile(readArtworkFile(json))!==json)throw Error('lossy export');
        return json;
      });
      await page.reload();await page.locator('#loading').waitFor({state:'detached'});
      const entry=await page.locator('.welcome-example').boundingBox();
      assert.ok(entry.x>=0&&entry.y>=0&&entry.x+entry.width<=viewport.width&&entry.y+entry.height<=viewport.height,'example entry remains reachable on the welcome screen');
      await page.screenshot({path:`asset/review/example-welcome-${viewport.width}.png`});
      assert.ok(await page.locator('.welcome-example').evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'example entry is not covered');
      const checkExample=async(fromWelcome)=>{
        const geometries=await page.evaluate(()=>window.togi.world.renderer.info.memory.geometries);
        if(!fromWelcome)await page.locator('[data-action="help"]').click();
        await page.locator('[data-action="example-artwork"]').click();
        const canvas=page.locator('.example-viewer canvas');await canvas.waitFor();
        assert.match(await page.locator('.example-caption').textContent(),/게임을 만든 사람.*빚어.*복원품은 아니/s);
        const original=await canvas.evaluate(el=>el.toDataURL()),r=await canvas.boundingBox();
        assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=viewport.width&&r.y+r.height<=viewport.height,'viewer fits the screen');
        const layout=await page.evaluate(()=>{
          const dialog=document.querySelector('#dialog'),root=document.querySelector('#example-viewer-root'),errors=[];
          if(dialog.scrollHeight>dialog.clientHeight+1)errors.push('viewer requires unnecessary scrolling');
          if(dialog.getBoundingClientRect().bottom-root.getBoundingClientRect().bottom>30)errors.push('unnecessary empty space below the viewer');
          for(const selector of ['.modal-close','.example-details button']){
            const e=document.querySelector(selector),r=e.getBoundingClientRect();
            if(r.width<43||r.height<43||r.bottom>innerHeight||!e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)))errors.push('unreachable viewer action');
          }
          return errors;
        });
        assert.deepEqual(layout,[],'viewer uses space and keeps its actions reachable');
        if(viewport.width<1100){
          const touch=await context.newCDPSession(page);
          await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+r.width*.4,y:r.y+r.height*.5,id:1}]});
          for(let i=1;i<=8;i++)await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:r.x+r.width*(.4+i*.025),y:r.y+r.height*.5,id:1}]});
          await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await touch.detach();
        }else{
          await page.mouse.move(r.x+r.width*.4,r.y+r.height*.5);await page.mouse.down();await page.mouse.move(r.x+r.width*.6,r.y+r.height*.5,{steps:8});await page.mouse.up();
        }
        await page.waitForFunction(before=>document.querySelector('.example-viewer canvas').toDataURL()!==before,original);
        const rotated=await canvas.evaluate(el=>el.toDataURL());await canvas.press('ArrowRight');
        await page.waitForFunction(before=>document.querySelector('.example-viewer canvas').toDataURL()!==before,rotated);
        const sideView=await canvas.evaluate(el=>el.toDataURL());
        if(viewport.width<1100){
          const touch=await context.newCDPSession(page);
          await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+r.width*.5,y:r.y+r.height*.35,id:1}]});
          for(let i=1;i<=6;i++)await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:r.x+r.width*.5,y:r.y+r.height*(.35+i*.04),id:1}]});
          await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await touch.detach();
        }else{
          await page.mouse.move(r.x+r.width*.5,r.y+r.height*.35);await page.mouse.down();await page.mouse.move(r.x+r.width*.5,r.y+r.height*.6,{steps:6});await page.mouse.up();
        }
        await page.waitForFunction(before=>document.querySelector('.example-viewer canvas').toDataURL()!==before,sideView);
        const topView=await canvas.evaluate(el=>el.toDataURL());await canvas.press('ArrowDown');
        await page.waitForFunction(before=>document.querySelector('.example-viewer canvas').toDataURL()!==before,topView);
        if(fromWelcome)await page.screenshot({path:`asset/review/user-example-${viewport.width}.png`});
        await page.locator('.example-viewer [data-action="close"]').click();
        assert.equal(await page.locator('.example-viewer').count(),0);
        assert.equal(await page.evaluate(()=>window.togi.world.renderer.info.memory.geometries),geometries,'closing releases the example and case geometry');
      };
      await checkExample(true);
      const exportFile=async()=>{
        await page.locator('[data-action="help"]').click();
        const download=page.waitForEvent('download');await page.locator('[data-action="export-artwork"]').click();
        const file=await download;assert.match(file.suggestedFilename(),/\.togi\.json$/);
        assert.equal(await readFile(await file.path(),'utf8'),expected,'export preserves every coordinate, feature and progress field');
        await page.locator('.modal-close').click();
      };
      await exportFile();await page.locator('[data-action="continue"]').click();
      const activeBefore=await page.evaluate(async()=>{const {artworkFile}=await import('/src/artwork-file.ts');return artworkFile(window.togi.save);});
      await checkExample(false);await exportFile();
      assert.equal(await page.evaluate(async()=>{const {artworkFile}=await import('/src/artwork-file.ts');return artworkFile(window.togi.save);}),activeBefore,'viewing an example never changes the active artwork');
      const after=await page.evaluate(async()=>{const {SaveRepository}=await import('/src/save.ts'),{artworkFile}=await import('/src/artwork-file.ts');return artworkFile(await new SaveRepository().load());});
      assert.equal(after,expected,'export does not write or reset the saved artwork');
      assert.deepEqual(errors,[]);console.log(`PASS: ${viewport.width}px exact export, independent rotating example, resume and original preservation`);
    }finally{await context.close();}
  }
}finally{await browser?.close();await server.close();}
