import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { once } from "node:events";
import test from "node:test";

test(
  "prototype serves its build and assets without exposing source or accepting writes",
  { timeout: 15000 },
  async () => {
    const server = spawn(process.execPath, ["server.mjs"], {
      env: { ...process.env, PORT: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    try {
      const ready = once(server.stdout, "data").then(([text]) => String(text));
      const failed = once(server, "exit").then(() => {
        throw new Error("Server exited before listening");
      });
      const url = (await Promise.race([ready, failed])).match(
        /http:\/\/127\.0\.0\.1:\d+/,
      )?.[0];
      assert.ok(url);
      const home = await fetch(url);
      assert.equal(home.status, 200);
      assert.match(await home.text(), /작은 흙 공방/);
      assert.equal((await fetch(url, { method: "HEAD" })).status, 200);
      assert.equal((await fetch(url, { method: "POST" })).status, 405);
      for (const path of [
        "/package.json",
        "/game/main.ts",
        "/.git/config",
        "/..%5cpackage.json",
        "/%ZZ",
      ])
        assert.equal((await fetch(url + path)).status, 404, path);
      const files = await readdir("dist/assets");
      assert.ok(files.some((name) => name.endsWith(".glb")));
      for (const file of files) {
        const response = await fetch(
          `${url}/assets/${encodeURIComponent(file)}`,
        );
        assert.equal(response.status, 200, file);
        assert.deepEqual(
          Buffer.from(await response.arrayBuffer()),
          await readFile("dist/assets/" + file),
          file,
        );
      }
    } finally {
      server.kill();
    }
  },
);
