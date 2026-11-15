import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {asset} from './assets';

export type Surface = 'grayware'|'aged-oak'|'earth'|'plaster'|'linen'|'garden'|'foliage'|'stamped-clay';
export const artModels = ['craft-bench','craft-tools','studio-room','studio-collection','gallery-room','gallery-collection','excavation-kit','kiln-dressing','kiln-vault','garden-grove'] as const;
export type ArtModel = typeof artModels[number];
export class ArtAssets {
  textures = new Map<Surface,T.Texture>();
  models = new Map<ArtModel,T.Group>();
  async load(renderer:T.WebGLRenderer){
    const textures = new T.TextureLoader(),models = new GLTFLoader();
    await Promise.all((['grayware','aged-oak','earth','plaster','linen','garden','foliage','stamped-clay'] as Surface[]).map(async name=>{
      const texture=await textures.loadAsync(asset(`materials/${name}-v1.${name==='foliage'?'webp':'jpg'}`));
      texture.colorSpace=T.SRGBColorSpace;
      texture.wrapS=texture.wrapT=T.RepeatWrapping;
      texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
      this.textures.set(name,texture);
    }));
    await Promise.all(artModels.map(async name=>{
      const {scene}=await models.loadAsync(asset(`models/${name}-v2.glb`));
      scene.traverse(o=>{
        if(!(o instanceof T.Mesh))return;
        o.castShadow=o.receiveShadow=true;
        for(const material of Array.isArray(o.material)?o.material:[o.material]){
          if(!(material instanceof T.MeshStandardMaterial))continue;
          const surface=material.userData.surface as Surface|undefined;
          if(surface){material.map=this.textures.get(surface)!;if(surface!=='foliage'){material.bumpMap=material.map;material.bumpScale=surface==='grayware'?.002:surface==='linen'?.001:.004;}material.needsUpdate=true;}
        }
      });
      this.models.set(name,scene);
    }));
  }
  model(name:ArtModel){return this.models.get(name)!;}
  texture(name:Surface){return this.textures.get(name)!;}
  garden(){
    const texture=this.texture('garden');
    const plane=new T.Mesh(new T.PlaneGeometry(6.3,4.2),new T.MeshBasicMaterial({map:texture,color:0xdde5d0}));
    plane.name='Distant courtyard beyond the studio window';plane.position.set(0,1.6,-3.05);
    return plane;
  }
}
