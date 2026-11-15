"""Copy approved generated sources and encode runtime textures; no visual repainting."""
from pathlib import Path
from shutil import copy2
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
GENERATED = Path(r'C:\Users\cspcs\.codex\generated_images\01a12ee4-184f-7b11-a0a5-ab770fc901f2')
SOURCES = {"grayware":"81275c76-8cc3-4219-920d-6f79afa5e77b","aged-oak":"1ad01b7f-4fdf-4428-8610-2a65b6e18b01","earth":"63b71184-1be5-4509-882b-e6cc9f014ff9","plaster":"4061fd82-0b80-4ea3-b18b-5c39c9d6ee8d","linen":"7a3eec9d-f36b-4ece-ab66-add03d9d18bf"}
source = ROOT / 'asset/source/materials'
runtime = ROOT / 'asset/runtime/materials'
source.mkdir(parents=True, exist_ok=True)
runtime.mkdir(parents=True, exist_ok=True)
SOURCES['garden'] = '7ebb77de-6ce8-4ae9-bd6f-5bb57857f69b'
SOURCES['foliage'] = '8c5fa529-3d77-4948-b515-6e08918bd223'
SOURCES['stamped-clay'] = '0decb0d8-e493-47ba-b73e-2bbacdbcf1b6'
for name, identifier in SOURCES.items():
    original = source / f'{name}-v1.png'
    if not original.exists():
        copy2(GENERATED / f'exec-{identifier}.png', original)
    im = Image.open(original).convert('RGBA' if name == 'foliage' else 'RGB')
    im.thumbnail((1536, 1024) if name == 'garden' else (1024, 1024), Image.Resampling.LANCZOS)
    destination = runtime / f'{name}-v1.{"webp" if name == "foliage" else "jpg"}'
    im.save(destination, quality=88, optimize=True)
    print(name, im.size, destination.stat().st_size)

characters = {'gyeongsani':'87bd0f03-7a35-4de0-886b-b050a466108c','api':'5b286eaf-716b-4dff-902b-95ed5d4bfc3b','doki':'b50a9941-2e77-49e5-a2cb-89de7daeadce'}
character_source = ROOT / 'asset/source/characters'
character_source.mkdir(parents=True, exist_ok=True)
for name, identifier in characters.items():
    original = character_source / f'{name}-volume-v2.png'
    if not original.exists():
        copy2(GENERATED / f'exec-{identifier}.png', original)
    im = Image.open(original).convert('RGBA')
    im.thumbnail((768, 1024), Image.Resampling.LANCZOS)
    im.save(ROOT / 'asset/runtime/characters' / f'{name}-volume-v2.webp', quality=90)

backs = character_source / 'party-back-volume-v2.png'
if not backs.exists():
    copy2(GENERATED / 'exec-23c7f2b0-11f3-4185-81ea-c367b79c18c6.png', backs)
im = Image.open(backs).convert('RGBA')
im.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
im.save(ROOT / 'asset/runtime/animations/party-back-volume-v2.webp', quality=90)
