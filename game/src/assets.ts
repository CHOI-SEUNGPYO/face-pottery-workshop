const files = import.meta.glob(
  [
    "../asset/runtime/characters/*.png",
    "../asset/runtime/characters/*.webp",
    "../asset/runtime/models/*.glb",
    "../asset/runtime/audio/*.wav",
    "../asset/runtime/animations/*.png",
    "../asset/runtime/animations/*.webp",
    "../asset/runtime/materials/*.jpg",
    "../asset/runtime/materials/*.webp",
  ],
  {
    eager: true,
    query: "?url",
    import: "default",
  },
) as Record<string, string>;
export function asset(path: string) {
  const url = files["../asset/runtime/" + path];
  if (!url) throw new Error("Missing asset: " + path);
  return url;
}
const characterNames: Record<string, string> = {
  압이: "api",
  독이: "doki",
  경산이: "gyeongsani",
  소월이: "sowoli",
};
export const characterImage = (name: string) =>
  asset(`characters/${characterNames[name]}${name==='소월이'?'.png':'-volume-v2.webp'}`);
