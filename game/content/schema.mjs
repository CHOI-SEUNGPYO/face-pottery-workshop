export const stages=['welcome','body','mouth','faces','inspect','firing','excavation','assembly','compare','ending'];
export const safeFile=name=>typeof name==='string'&&/^[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp|glb)$/.test(name);
export const safeLink=url=>typeof url==='string'&&(url===''||/^https?:\/\//.test(url));
export function validCatalog(c){
  const text=(v,n)=>typeof v==='string'&&v.length<=n;
  const sources=v=>Array.isArray(v)&&v.length<=12&&v.every(id=>c.sources?.some(s=>s.id===id));
  return !!(c&&c.version===1&&text(c.title,120)&&Array.isArray(c.photos)&&c.photos.length>0&&c.photos.length<=40&&
    (c.sources===undefined||(Array.isArray(c.sources)&&c.sources.length<=30&&new Set(c.sources.map(s=>s?.id)).size===c.sources.length&&c.sources.every(s=>s&&text(s.id,80)&&text(s.title,200)&&safeLink(s.url)&&s.url!=='')))&&
    (c.artifact===undefined||(c.artifact&&text(c.artifact.name,100)&&text(c.artifact.academicName,100)&&text(c.artifact.hanja,100)&&text(c.artifact.meaning,400)&&text(c.artifact.note,1200)&&sources(c.artifact.sources)&&Array.isArray(c.artifact.fields)&&c.artifact.fields.length<=8&&c.artifact.fields.every(f=>f&&text(f.label,60)&&text(f.value,240))))&&
    new Set(c.photos.map(p=>p.id)).size===c.photos.length&&c.photos.every(p=>text(p.id,80)&&safeFile(p.file)&&!p.file.endsWith('.glb')&&text(p.alt,300)&&text(p.caption,500)&&text(p.credit,1000)&&safeLink(p.source)&&(p.title===undefined||text(p.title,100))&&(p.category===undefined||['face','siru','background','other'].includes(p.category)))&&
    c.stages&&stages.every(s=>{const p=c.stages[s];return p&&text(p.title,100)&&text(p.summary,140)&&c.photos.some(photo=>photo.id===p.photo)&&Array.isArray(p.blocks)&&p.blocks.length>0&&p.blocks.length<=30&&p.blocks.every(b=>['fact','interpretation','imagination'].includes(b.kind)&&text(b.text,4000)&&(b.heading===undefined||text(b.heading,100))&&(b.sources===undefined||sources(b.sources))&&(b.question===undefined||text(b.question,300))&&(b.photo===undefined||c.photos.some(photo=>photo.id===b.photo)));})&&
    Array.isArray(c.exhibits)&&c.exhibits.length<=12&&c.exhibits.every(e=>text(e.id,80)&&text(e.name,120)&&safeFile(e.file)&&e.file.endsWith('.glb')&&stages.includes(e.stage)&&Number.isFinite(e.height)&&e.height>.02&&e.height<3&&Array.isArray(e.position)&&e.position.length===3&&e.position.every(v=>Number.isFinite(v)&&Math.abs(v)<10)&&Number.isFinite(e.rotation)));
}
