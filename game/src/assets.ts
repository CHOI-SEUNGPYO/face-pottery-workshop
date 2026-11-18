const files = import.meta.glob(
  [
    // Keep originals in the project, but ship only the models used by the game.
    "../asset/runtime/characters/*-volume-v2.webp",
    "../asset/runtime/models/{craft-bench,studio-shell,studio-furniture,studio-collection,gallery-shell,gallery-fixtures,gallery-collection,field-tools,conservation-bench,kiln-dressing,kiln-vault,courtyard}-v3.glb",
    "../asset/runtime/models/craft-tools-v2.glb",
    "../asset/runtime/models/siru-v4.glb",
    "../asset/runtime/models/display-stand.glb",
    "../asset/runtime/audio/*.wav",
    "../asset/runtime/animations/{party-travel,face-pot}.png",
    "../asset/runtime/materials/{grayware,aged-oak,earth,plaster,linen,limestone,kiln-clay,meadow}-v1.jpg",
    "../asset/runtime/materials/{garden,woodland}-v2.jpg",
    "../asset/runtime/materials/{kiln-valley,kiln-yard,thatch}-v1.jpg",
    "../asset/runtime/materials/foliage-v1.webp",
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
};
export const characterImage = (name: string) =>
  asset(`characters/${characterNames[name]}-volume-v2.webp`);
