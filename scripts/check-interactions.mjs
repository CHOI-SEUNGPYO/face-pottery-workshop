import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

// Use an ephemeral port and fresh browser contexts, never the player's saves.
const server = spawn(process.execPath, ["server.mjs"], {
  env: { ...process.env, PORT: "0" }, windowsHide: true,
  stdio: ["ignore", "pipe", "pipe"],
});
let browser;
try {
  const output = await Promise.race([
    once(server.stdout, "data").then(([chunk]) => String(chunk)),
    once(server, "exit").then(() => { throw new Error("Test server did not start"); }),
  ]);
  const url = output.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
  assert.ok(url);
  browser = await chromium.launch({ channel: "msedge", headless: true });
  for (const viewport of [{ width: 1366, height: 900 }, { width: 844, height: 390 }]) {
    const page = await browser.newPage({ viewport, reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    try {
      await page.goto(url);
      await page.waitForSelector("#loading", { state: "detached" });
      await page.locator('[data-action="new"]').click();
      await page.locator('[data-action="next"]').click();
      await page.locator('[data-action="next"]').click();
      await page.locator('.view-controls summary').click();
      await page.locator('[data-action="view-front"]').click();
      const choose=async tool=>{await page.locator('.drawing-actions summary').click();await page.locator(`button[data-tool="${tool}"]`).click();};
      assert.equal(await page.locator('[data-action="coach-demo"], [data-action="demo"], .tool-example').count(), 0);
      await page.locator('[data-action="help"]').click();
      assert.equal(await page.locator('[data-action="demo"]').count(), 0, "help has no demonstration entry");
      await page.locator('[data-action="close"]').click();
      const area = await page.locator(".work-area").boundingBox();
      const x = area.x + area.width / 2, y = area.y + area.height / 2;
      const saved = () => page.evaluate(() => new Promise((resolve, reject) => {
        const request = indexedDB.open("togi-workshop-v2", 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const get = db.transaction("state").objectStore("state").get("current");
          get.onsuccess = () => { resolve(get.result.document.features); db.close(); };
          get.onerror = () => { reject(get.error); db.close(); };
        };
      }));
      const draw = async points => {
        await page.mouse.move(x + points[0][0], y + points[0][1]);
        await page.mouse.down();
        for (const [a, b] of points.slice(1))
          await page.mouse.move(x + a, y + b, { steps: 10 });
        await page.mouse.up();
      };
      // One-click holes remain available; drawing keeps deliberate corners.
      for (const tool of ["carve", "pierce"]) {
        await choose(tool);
        const kind = tool === "carve" ? "hole" : "raised-hole";
        await page.mouse.click(x, y);
        assert.equal((await saved()).length, 1);
        assert.equal((await saved())[0].kind, kind);
        await page.locator('[data-action="undo"]').click();
        assert.equal((await saved()).length, 0);
        await draw([[-22,-17],[3,-24],[26,-8],[6,3],[18,20],[-20,10],[-22,-17]]);
        const shape = await saved();
        assert.equal(shape.length, 1);
        assert.equal(shape[0].kind, kind);
        await page.locator('[data-action="undo"]').click();
        assert.equal((await saved()).length, 0);
        await page.locator('[data-action="redo"]').click();
        assert.deepEqual(await saved(), shape);
        await page.locator('[data-action="undo"]').click();
      }
      await choose('carve');
      await draw([[20,-20],[-20,-20],[-20,20],[20,20]]);
      assert.equal((await saved()).length, 0, "open arcs stay open");
      await draw([[0,0],[0,-400],[30,0],[0,0]]);
      assert.equal((await saved()).length, 0, "off-surface outlines do not cut");
      assert.equal(await page.locator("#opening-placement").count(), 0);
      assert.equal(await page.locator("#opening-outline").isVisible(), false);
      assert.equal(await page.locator("#opening-outline path").first().getAttribute("d"), null);
      const radius = viewport.height > 600 ? 100 : 42;
      await draw(Array.from({ length: 81 }, (_, i) => [
        radius * Math.cos(i * Math.PI / 40), radius * Math.sin(i * Math.PI / 40),
      ]));
      const result = await saved();
      assert.equal(result.length, 1, "large curved contour succeeds after a failed drawing");
      await page.reload();
      await page.waitForSelector("#loading", { state: "detached" });
      await page.locator('[data-action="continue"]').click();
      assert.deepEqual(await saved(), result);
      if(viewport.width===844){await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('#orientation-guide').isVisible(),true);await page.setViewportSize(viewport);assert.equal(await page.locator('#orientation-guide').isVisible(),false);assert.deepEqual(await saved(),result);}
      assert.deepEqual(errors, []);
    } catch (error) {
      await mkdir("asset/review", { recursive: true });
      await page.screenshot({ path: `asset/review/interaction-${viewport.width}-failure.png` });
      throw error;
    } finally {
      await page.close();
    }
  }
  console.log("PASS: desktop/mobile click holes, freehand, large cuts, no relocation, undo/redo and saved artwork.");
} finally {
  await browser?.close();
  if (server.exitCode === null) {
    const stopped = once(server, "exit");
    server.kill();
    await stopped;
  }
}
