// Isotropic grain in object coordinates: stretching a ring cannot stretch this
// into UV wood grain. Existing UV maps are reserved for the child's marks.
const grain=`
float clayHash(vec3 p) {
  p=fract(p*0.1031);p+=dot(p,p.yzx+33.33);
  return fract((p.x+p.y)*p.z);
}
float clayNoise(vec3 p) {
  vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(mix(clayHash(i),clayHash(i+vec3(1,0,0)),f.x),
                 mix(clayHash(i+vec3(0,1,0)),clayHash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(clayHash(i+vec3(0,0,1)),clayHash(i+vec3(1,0,1)),f.x),
                 mix(clayHash(i+vec3(0,1,1)),clayHash(i+vec3(1,1,1)),f.x),f.y),f.z);
}`;
export function claySurface(material,mouthUniforms=null){
  material.onBeforeCompile=shader=>{
    if(mouthUniforms)Object.assign(shader.uniforms,mouthUniforms);
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 potteryPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\npotteryPosition=position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 potteryPosition;\n'+(mouthUniforms?'uniform sampler2D mouthMask; uniform float mouthRadius; uniform float mouthBottom;\n':'')+grain);
    if(mouthUniforms)shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','#include <alphatest_fragment>\nif(potteryPosition.y>mouthBottom && texture2D(mouthMask,vec2(potteryPosition.x,potteryPosition.z)/(2.0*mouthRadius)+0.5).g<0.5) discard;');
    if(material.isMeshStandardMaterial){
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        float clayCloud=clayNoise(potteryPosition*5.0);
        float clayFine=clayNoise(potteryPosition*85.0);
        diffuseColor.rgb*=0.94+0.10*clayCloud+0.035*(clayFine-0.5);`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        float clayHeight=clayNoise(potteryPosition*26.0)*0.0015+clayFine*0.0007;
        normal=perturbNormalArb(-vViewPosition,normal,vec2(dFdx(clayHeight),dFdy(clayHeight)),faceDirection);`);
    }
  };
  material.customProgramCacheKey=()=>`clay-grain-v1-${!!mouthUniforms}`;
}
