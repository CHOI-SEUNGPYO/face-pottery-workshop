export const stages=['welcome','body','mouth','faces','inspect','firing','excavation','assembly','compare','ending'];
export const safeFile=name=>typeof name==='string'&&/^[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp|glb)$/.test(name);
export const safeLink=url=>typeof url==='string'&&(url===''||/^https?:\/\//.test(url));
export function validCatalog(c){
  const text=(v,n)=>typeof v==='string'&&v.length<=n;
  return !!(c&&c.version===1&&text(c.title,120)&&Array.isArray(c.photos)&&c.photos.length>0&&c.photos.length<=40&&
    new Set(c.photos.map(p=>p.id)).size===c.photos.length&&c.photos.every(p=>text(p.id,80)&&safeFile(p.file)&&!p.file.endsWith('.glb')&&text(p.alt,300)&&text(p.caption,500)&&text(p.credit,1000)&&safeLink(p.source))&&
    c.stages&&stages.every(s=>{const p=c.stages[s];return p&&text(p.title,100)&&text(p.summary,140)&&c.photos.some(photo=>photo.id===p.photo)&&Array.isArray(p.blocks)&&p.blocks.length>0&&p.blocks.length<=30&&p.blocks.every(b=>['fact','interpretation','imagination'].includes(b.kind)&&text(b.text,4000));})&&
    Array.isArray(c.exhibits)&&c.exhibits.length<=12&&c.exhibits.every(e=>text(e.id,80)&&text(e.name,120)&&safeFile(e.file)&&e.file.endsWith('.glb')&&stages.includes(e.stage)&&Number.isFinite(e.height)&&e.height>.02&&e.height<3&&Array.isArray(e.position)&&e.position.length===3&&e.position.every(v=>Number.isFinite(v)&&Math.abs(v)<10)&&Number.isFinite(e.rotation)));
}
