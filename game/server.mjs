import { createServer } from "node:http";
import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("./dist/", import.meta.url));
const port = Number(process.env.PORT || 4174);
await stat(resolve(root, "index.html")).catch(() => {
  throw new Error("실행본이 없어요. npm ci 후 npm run build를 실행해 주세요.");
});
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".glb": "model/gltf-binary",
  ".wav": "audio/wav",
  ".json": "application/json; charset=utf-8",
};
const server = createServer(async (req, res) => {
  try {
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405);
      return res.end();
    }
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    const file = resolve(
      root,
      "." + (pathname === "/" ? "/index.html" : pathname),
    );
    const relative = file.slice(root.length);
    if (
      !file.startsWith(root) ||
      relative.split(/[\\/]/).some((p) => p.startsWith("."))
    ) {
      res.writeHead(404);
      return res.end("Not found");
    }
    const info=await stat(file);
    if(!info.isFile()){res.writeHead(404);return res.end('Not found');}
    const etag=`W/"${info.size.toString(16)}-${info.mtimeMs.toString(16)}"`;
    const headers={
      "Content-Type": types[extname(file)] || "application/octet-stream",
      // Only Vite's content-hashed files can be kept without revalidation.
      // The catalogue, photos and HTML remain immediately editable.
      "Cache-Control": /^\/assets\/[^/]+-[\w-]{8}\.[\w]+$/.test(pathname)
        ? 'public, max-age=31536000, immutable' : 'no-cache',
      "ETag": etag,
      "Last-Modified": info.mtime.toUTCString(),
      "X-Content-Type-Options": "nosniff",
    };
    const requested=req.headers['if-none-match'];
    const unmodified=requested!==undefined
      ? requested.split(',').some(tag=>tag.trim()==='*'||tag.trim().replace(/^W\//,'')===etag.replace(/^W\//,''))
      : !!req.headers['if-modified-since']&&Math.floor(info.mtimeMs/1000)<=Date.parse(req.headers['if-modified-since'])/1000;
    if(unmodified){res.writeHead(304,headers);return res.end();}
    res.writeHead(200,{...headers,'Content-Length':info.size});
    if(req.method==='HEAD')return res.end();
    await pipeline(createReadStream(file),res);
  } catch {
    if(res.headersSent){res.destroy();return;}
    res.writeHead(404);
    res.end("Not found");
  }
}).listen(port, "127.0.0.1", () =>
  console.log(`내 얼굴토기: http://127.0.0.1:${server.address().port}`),
);
server.on("error", (error) => {
  console.error(
    error.code === "EADDRINUSE"
      ? `${port}번 주소가 이미 사용 중이에요.`
      : error.message,
  );
  process.exitCode = 1;
});
