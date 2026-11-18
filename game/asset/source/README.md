# 게임 아트 원본 · 2026-11-15

사용자가 제공한 박물관 영상과 `삽화_재현판` 사진을 참고해 만든 게임용 자료다. 유물 모델은 사진 기반의 형태 해석이며 실측·스캔·정밀 복원 자료가 아니다. 정원 배경은 생성 이미지이며 실제 박물관을 촬영한 사진이 아니다.

## 원본과 실행 파일

- `materials/`: 토기·참나무·흙·회벽·천·석재 등의 재질과 정원·들판 배경의 PNG 원본. 이전 버전도 함께 보관한다.
- `characters/`: 원래 경산이·독이·압이의 색, 선, 얼굴과 비율을 참고해 입체감과 명암을 더한 PNG 3개. 원본 캐릭터 파일은 그대로 보관한다. 새 파일은 한 자세의 이미지이며, 새 3D 리깅이나 동작 애니메이션이 아니다.
- `characters/party-back-volume-v2.png`: 이전 가마 장면용 세 캐릭터 뒷모습 원본. 현재는 안내 캐릭터를 장면별로 분리했으며, 세 명이 함께 운반하는 이동용 아틀라스는 유지한다.
- `model-manifest.json`: GLB 28개의 파일 크기와 면 수. 토기 8개·도구 10개·이를 배치한 공간 및 주변 요소 10개다. 공간 파일에는 같은 소품이 재사용되므로 서로 다른 28종의 유물을 만들었다는 의미는 아니다.
- `../../scripts/build-art-assets.mjs`, `../../scripts/scene-art.mjs`: UV, 속이 빈 토기 몸체, 구멍 있는 받침, 도구, 가구, 가마, 식생의 편집 가능한 제작 코드. `game/`에서 `npm run build:art`로 GLB를 다시 만든다.
- `../../scripts/siru-artifact.mjs`, `../../scripts/siru-artifact-material.mjs`: 공식 발굴 보도자료의 단독·결합 사진을 참고한 시루 v4. 바닥이 제거된 속 빈 몸체, 깨진 가장자리, 넓은 소뿔 모양 손잡이와 회갈색 찍힘 재질을 만든다. 원본 스캔이나 실측 모델은 아니다. `ceramic-glb.mjs`는 얼굴토기·시루의 자체 색상·요철 이미지를 GLB에 함께 넣는 공통 도구다.
- `scene-layout-v3.json`: 분리된 벽·가구·전시대·작업대·야외 주변·시루 등 새 GLB 13개와 선반 유물의 바닥 접촉·간격 기록. 이전 v2 파일은 보존한다.
- `../../scripts/prepare-art-textures.py`: 이 폴더의 원본에서 게임용 JPG·WebP를 인코딩한다. Python과 Pillow가 필요하다. 게임 실행·일반 빌드에는 Python이 필요 없다.
- 실행 파일은 `asset/runtime/materials/`, `asset/runtime/characters/`, `asset/runtime/models/`에 있다. 브라우저는 사전 제작한 GLB를 읽으며 공간 모델을 실행 중에 다시 만들지 않는다.

## 화면에 적용한 방식

공방의 선반 토기·나무 가구·창밖 정원·천·도구, 박물관의 전시물과 벽·바닥, 발굴장의 흙·측량 줄·유물 정리 도구, 가마의 흙벽·아궁이·장작·주변 나무를 에셋으로 구성했다. 참고 토기의 무늬에는 제공된 표면 사진을 사용했다. 사용자 작품은 기존 편집 가능한 조형을 유지한다.

고정된 소품은 같은 재질끼리 묶어 그린다. 가마 단면과 뒤쪽에서 토기를 볼 때 열리는 실내 벽은 따로 묶었다. 이는 캐릭터/토기 애니메이션의 고도화나 실제 기기의 성능 검증을 대신하지 않는다.

## 이미지 제작 지시 요약

OpenAI 이미지 생성 도구로 제작했다. 아래는 재제작에 사용할 지시 요약이다. 생성 결과가 동일하게 재현된다는 뜻은 아니다.

| 파일 | 제작 지시 |
| --- | --- |
| grayware-v1 | Tileable square gray earthenware albedo, matte granular fired clay, subtle impressed marks, neutral diffuse light, no object silhouette, no painted shading. |
| aged-oak-v1 | Seamless warm aged oak surface, long vertical natural fibers, soft wear, no plank seams or hardware, flat material scan lighting. |
| earth-v1 | Seamless compacted brown earth with sparse small stones and natural fine grains, diffuse daylight, no large objects or directional shadows. |
| plaster-v1 | Seamless warm ivory lime plaster, subtle trowel texture, neutral flat light, no architecture. |
| linen-v1 | Seamless unbleached flax linen weave, small natural fiber irregularity, flat material sample, no folds or cast shadows. |
| garden-v1 | Photographic Korean museum courtyard beyond a workshop window, stone boundary wall, lush layered trees and grasses, natural daylight, no people, text or signage. |
| garden-v2 | 공방 창밖을 위해 새로 그린 가을 마당. 감나무 아래 낮은 돌담, 연한 산등성이와 밝은 하늘을 과슈 질감으로 표현한 AI 생성 배경이다. |
| woodland-v2 | 야외 장면의 원경. 가을 들판과 여러 겹의 낮은 산이 이어지는 AI 생성 파노라마다. |
| meadow-v1 | 들판 앞 언덕에 이어지는 낮은 풀밭. 원경의 색을 참고해 만든 AI 생성 바닥 재질이다. |
| kiln-clay-v1 | 가마 표면에 쓰는 흙의 색과 질감. 모래 알갱이와 짧은 짚 섬유, 손으로 흙을 문질러 바른 자국을 표현한 AI 생성 재질이다. |
| kiln-valley-v1 | 가마 너머로 보이는 들과 개울, 겹겹이 이어지는 산등성이를 그린 AI 생성 배경화. |
| sowol-plain-v1 | 청통천 일대의 넓은 들을 내려다보는 낮은 구릉이라는 2019년 조사 발표를 바탕으로 그린 AI 생성 원경. 물길의 경로와 식생은 체험용 해석이다. [문화재청 조사 발표](https://www.kculture.or.kr/brd/board/399/L/menu/498?bbIdx=11513&brdType=R&recordCnt=10&searchField=&searchText=&thisPage=25) |
| sowol-loam-v1 | 소월리 조사 전경과 구덩이 사진의 황갈색 흙, 회갈색 침전물, 얕은 긁힘을 참고한 AI 생성 지표 재질. 현장 실측 토층도는 아니다. |
| kiln-yard-v1 | 흙길과 잿빛 작업 마당이 풀밭으로 이어지는 지면용 AI 생성 원화. |
| thatch-v1 | 건조막 지붕의 볏짚 이엉을 표현한 AI 생성 재질. 건조막과 축대, 풀은 `kiln-landscape.mjs`에서 입체로 제작한다. |
| foliage-v1 | Realistic green leafy branch cluster with many individually defined leaves and fine twigs, transparent background, suitable for crossed foliage cards. |
| stamped-clay-v1 | Use the supplied pottery surface detail as reference: dense diagonal small oval impressions on dark charcoal gray fired clay, tileable material swatch, no eyes, openings or pot silhouette. |
| limestone-v1 | Seamless warm gray limestone, fine matte grain, subtle mineral variation, diffuse lighting, no scene or shadows. |
| siru-clay-v1 | Weathered pale gray fired ceramic based on the steamer reference, fine impressed texture, natural discoloration, flat lighting. |
| woodland-v1 | Wide Korean museum garden panorama, layered woodland and gravel clearing, soft daylight, no people, text or buildings. Generated scenery, not a photograph of the actual museum. |
| 경산이·독이·압이 volume-v2 | Edit each supplied original character using the museum-video frame for depth and lighting: preserve exact colors, facial features, outline, proportions and pose; rounded puffy cutout volume, soft bevel and subtle surface shading, transparent background, no new accessories. |
| party-back-volume-v2 | Use the existing atlas rear silhouettes and the new individual character renders. Exactly three mascots from behind, yellow Gyeongsani left, coral Doki middle, turquoise Api right, same proportions and thick outlines, rounded puffy depth, feet aligned, no faces, no objects, no glow, transparent background. |

재질의 실행 크기는 대부분 1024×1024, 정원은 1536×1024다. 캐릭터는 최대 768×1024 WebP다. 형식 변환과 크기 조절 외의 수작업 재도색은 하지 않았다.
