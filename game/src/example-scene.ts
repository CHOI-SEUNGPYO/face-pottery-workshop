import * as T from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {photoScene} from './photo-scene';

export interface ExampleView {
  readonly canvas:HTMLCanvasElement;
  rotation:number;
  elevation:number;
  render():void;
  dispose():void;
}

/** Direct, on-demand WebGL preview. The game canvas stays asleep behind it. */
export function exampleScene(artwork:T.Object3D,stone:T.Texture):ExampleView {
  const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate=false;
  // A render-target environment belongs to its GPU context; make this one once.
  const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment();
  const environment=pmrem.fromScene(room,.05);room.dispose();pmrem.dispose();
  const portrait=photoScene(artwork,environment.texture,new T.Vector3(0,.24,1),stone);
  portrait.scene.updateMatrixWorld(true);
  portrait.scene.traverse(o=>{o.matrixAutoUpdate=false;});
  portrait.own.matrixAutoUpdate=true;portrait.camera.matrixAutoUpdate=true;
  let pixels=0,shadowRotation=NaN,disposed=false;
  return {
    canvas:renderer.domElement,
    get rotation(){return portrait.own.rotation.y;},
    set rotation(value:number){portrait.own.rotation.y=value;},
    get elevation(){return portrait.elevation;},
    set elevation(value:number){portrait.elevation=value;},
    render(){
      if(disposed)return;
      const rect=renderer.domElement.getBoundingClientRect();
      const next=Math.min(960,Math.max(320,Math.round(rect.width*Math.min(devicePixelRatio,1.5))));
      if(next!==pixels){pixels=next;renderer.setSize(pixels,pixels,false);}
      portrait.frame(rect.width,rect.height);
      // Looking from above does not move the object or its shadow.
      renderer.shadowMap.needsUpdate=shadowRotation!==portrait.own.rotation.y;
      shadowRotation=portrait.own.rotation.y;
      renderer.render(portrait.scene,portrait.camera);
    },
    dispose(){
      if(disposed)return;disposed=true;
      portrait.dispose();environment.dispose();renderer.dispose();renderer.forceContextLoss();
    },
  };
}
