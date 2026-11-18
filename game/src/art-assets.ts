import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {asset} from './assets';

export type Surface = 'grayware'|'aged-oak'|'earth'|'plaster'|'linen'|'garden'|'foliage'|'limestone'|'woodland'|'kiln-clay'|'meadow'|'kiln-valley'|'kiln-yard'|'thatch';
export const artModels = ['craft-bench','craft-tools','studio-shell','studio-furniture','studio-collection','gallery-shell','gallery-fixtures','gallery-collection','field-tools','conservation-bench','kiln-dressing','kiln-vault','courtyard','siru'] as const;
export type ArtModel = typeof artModels[number];
export type ArtGroup = 'studio'|'kiln'|'outdoor'|'gallery';
export const artGroups:Record<ArtGroup,{models:ArtModel[];surfaces:Surface[]}>= {
  studio:{models:['craft-bench','craft-tools','studio-shell','studio-furniture','studio-collection'],surfaces:['grayware','aged-oak','plaster','linen','garden','limestone','earth']},
  kiln:{models:['kiln-dressing','kiln-vault'],surfaces:['grayware','aged-oak','earth','limestone','kiln-clay','kiln-valley','kiln-yard','thatch']},
  outdoor:{models:['field-tools','conservation-bench','courtyard','siru'],surfaces:['grayware','aged-oak','earth','plaster','linen','limestone','foliage','woodland','meadow']},
  gallery:{models:['gallery-shell','gallery-fixtures','gallery-collection'],surfaces:['grayware','aged-oak','limestone','earth']},
};
export class ArtAssets {
  textures = new Map<Surface,T.Texture>();
  models = new Map<ArtModel,T.Group>();
  private textureJobs=new Map<Surface,Promise<void>>();
  private modelJobs=new Map<ArtModel,Promise<void>>();
  async load(renderer:T.WebGLRenderer,group:ArtGroup){
    const textures = new T.TextureLoader(),models = new GLTFLoader();
    const {surfaces,models:names}=artGroups[group];
    const textureReady=Promise.all(surfaces.map(name=>{
      if(this.textureJobs.has(name))return this.textureJobs.get(name)!;
      const job=(async()=>{
        const version=name==='garden'||name==='woodland'?'v2':'v1';
        const texture=await textures.loadAsync(asset(`materials/${name}-${version}.${name==='foliage'?'webp':'jpg'}`));
        texture.colorSpace=T.SRGBColorSpace;
        texture.wrapS=texture.wrapT=T.RepeatWrapping;
        if(name==='woodland'||name==='kiln-valley'){texture.wrapS=T.MirroredRepeatWrapping;texture.wrapT=T.ClampToEdgeWrapping;}
        texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
        this.textures.set(name,texture);
      })().catch(error=>{this.textureJobs.delete(name);throw error;});
      this.textureJobs.set(name,job);return job;
    }));
    await Promise.all([textureReady,...names.map(name=>{
      if(this.modelJobs.has(name))return this.modelJobs.get(name)!;
      const job=(async()=>{
        const version=name==='siru'?'v4':name==='craft-tools'?'v2':'v3';
        const {scene}=await models.loadAsync(asset(`models/${name}-${version}.glb`));
        await textureReady;
        scene.traverse(o=>{
          if(!(o instanceof T.Mesh))return;
          o.castShadow=o.receiveShadow=true;
          for(const material of Array.isArray(o.material)?o.material:[o.material]){
            if(!(material instanceof T.MeshStandardMaterial))continue;
            const surface=material.userData.surface as Surface|undefined;
            if(surface){material.map=this.textures.get(surface)!;if(!['foliage','garden'].includes(surface)){material.bumpMap=material.map;material.bumpScale=['limestone','linen'].includes(surface)?.001:.002;}material.needsUpdate=true;}
            if(surface==='woodland'||surface==='garden'||surface==='kiln-valley'){
              o.material=new T.MeshBasicMaterial({map:material.map,color:material.color,side:surface==='garden'?T.FrontSide:T.BackSide,toneMapped:false,fog:true});
              o.castShadow=o.receiveShadow=false;
            }
          }
        });
        this.models.set(name,scene);
      })().catch(error=>{this.modelJobs.delete(name);throw error;});
      this.modelJobs.set(name,job);return job;
    })]);
  }
  model(name:ArtModel){return this.models.get(name)!;}
  texture(name:Surface){return this.textures.get(name)!;}
}
