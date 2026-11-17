import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';

const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
let browser;
try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  await mkdir('asset/review',{recursive:true});
  for(const viewport of [{width:1366,height:768},{width:390,height:696}]){
    const context=await browser.newContext({viewport,hasTouch:viewport.width<600,reducedMotion:'reduce',acceptDownloads:true});
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
      const exportFile=async()=>{
        await page.locator('[data-action="help"]').click();
        const download=page.waitForEvent('download');await page.locator('[data-action="export-artwork"]').click();
        const file=await download;assert.match(file.suggestedFilename(),/\.togi\.json$/);
        assert.equal(await readFile(await file.path(),'utf8'),expected,'export preserves every coordinate, feature and progress field');
        await page.locator('.modal-close').click();
      };
      await exportFile();await page.locator('[data-action="continue"]').click();await exportFile();
      const after=await page.evaluate(async()=>{const {SaveRepository}=await import('/src/save.ts'),{artworkFile}=await import('/src/artwork-file.ts');return artworkFile(await new SaveRepository().load());});
      assert.equal(after,expected,'export does not write or reset the saved artwork');
      assert.deepEqual(errors,[]);console.log(`PASS: ${viewport.width}px exact artwork export, resume and original preservation`);
    }finally{await context.close();}
  }
}finally{await browser?.close();await server.close();}
