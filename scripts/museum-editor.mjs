import {createServer} from 'node:http';
import {readFile,writeFile,rename,mkdir,copyFile,cp,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {validCatalog,safeFile} from '../content/schema.mjs';
const root=process.env.TOGI_EDITOR_ROOT?resolve(process.env.TOGI_EDITOR_ROOT):fileURLToPath(new URL('../',import.meta.url)),token=randomUUID();
const catalog=resolve(root,'content/museum.json'),assets=resolve(root,'asset/runtime/museum');
let writing=false;
async function body(req,limit){const parts=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>limit)throw Error('파일이 너무 커요. 사진은 8MB, 모델은 20MB까지 사용할 수 있어요.');parts.push(chunk);}return Buffer.concat(parts);}
async function atomic(file,data){const temp=file+'.tmp';await writeFile(temp,data);await rename(temp,file);}
const server=createServer(async(req,res)=>{
 const send=(status,data,type='application/json; charset=utf-8')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);};
 try{
  const url=new URL(req.url,'http://127.0.0.1'),path=url.pathname;
  if(req.method==='GET'){
   if(path==='/'){send(200,(await readFile(resolve(root,'scripts/museum-editor.html'),'utf8')).replace('__TOKEN__',token),'text/html; charset=utf-8');return;}
   if(path==='/editor.js'){send(200,await readFile(resolve(root,'scripts/museum-editor.js')),'text/javascript');return;}
   if(path==='/api/catalog'){send(200,await readFile(catalog));return;}
   const file=decodeURIComponent(path.slice('/media/'.length));
   if(path.startsWith('/media/')&&safeFile(file)){send(200,await readFile(resolve(assets,file)),({'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.glb':'model/gltf-binary'})[extname(file)]);return;}
   send(404,'{}');return;
  }
  if(req.method!=='POST'||req.headers['x-editor-token']!==token){send(403,JSON.stringify({error:'편집 화면을 다시 열어 주세요.'}));return;}
  if(writing){send(409,JSON.stringify({error:'저장이 끝난 뒤 다시 시도해 주세요.'}));return;}
  writing=true;
  try{
   if(path==='/api/upload'){
    const ext=extname(url.searchParams.get('name')??'').toLowerCase();
    if(!['.png','.jpg','.jpeg','.webp','.glb'].includes(ext))throw Error('PNG, JPG, WebP, GLB 파일을 선택해 주세요.');
    const bytes=await body(req,ext==='.glb'?20*1024*1024:8*1024*1024);
    const signature=ext==='.png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):
      ['.jpg','.jpeg'].includes(ext)?bytes[0]===255&&bytes[1]===216:
      ext==='.webp'?bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP':bytes.toString('ascii',0,4)==='glTF';
    if(!signature)throw Error('확장자와 파일 내용이 일치하지 않아요.');
    const file=randomUUID()+ext;await mkdir(assets,{recursive:true});await writeFile(resolve(assets,file),bytes);
    send(200,JSON.stringify({file}));return;
   }
   if(path==='/api/catalog'){
    const value=JSON.parse((await body(req,512*1024)).toString('utf8'));
    if(!validCatalog(value))throw Error('필수 내용·요약 길이(140자)·사진 연결·모델 설정을 확인해 주세요.');
    for(const item of [...value.photos,...value.exhibits])if(!(await stat(resolve(assets,item.file))).isFile())throw Error('연결된 자료 파일이 없어요.');
    const text=JSON.stringify(value,null,2)+'\n';
    await copyFile(catalog,resolve(root,'content/museum.previous.json'));
    await atomic(catalog,text);
    await mkdir(resolve(root,'dist/museum'),{recursive:true});
    await cp(assets,resolve(root,'dist/museum/assets'),{recursive:true});
    await atomic(resolve(root,'dist/museum/catalog.json'),text);
    send(200,JSON.stringify({saved:true}));return;
   }
   if(path==='/api/restore'){
    const previous=await readFile(resolve(root,'content/museum.previous.json'),'utf8');
    if(!validCatalog(JSON.parse(previous)))throw Error('복구 자료를 읽지 못했어요.');
    await atomic(catalog,previous);await atomic(resolve(root,'dist/museum/catalog.json'),previous);
    send(200,previous);return;
   }
   send(404,'{}');
  }finally{writing=false;}
 }catch(error){send(400,JSON.stringify({error:error.message??'저장하지 못했어요.'}));}
}).listen(Number(process.env.EDITOR_PORT??4175),'127.0.0.1',()=>console.log(`유물 편집: http://127.0.0.1:${server.address().port}`));
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'편집 주소가 이미 열려 있어요. http://127.0.0.1:4175/ 를 열어 주세요.':error.message);process.exitCode=1;});
