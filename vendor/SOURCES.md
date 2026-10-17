# Three.js body generator

- Repository: https://github.com/mrdoob/three.js
- Pinned version: r180 (the existing `three.core.js` / `three.module.js` bundle)
- Used class: https://github.com/mrdoob/three.js/blob/r180/src/geometries/LatheGeometry.js
- License: MIT, reproduced in `THREE-LICENSE.txt`.
- Integration: `src/body.js` calls the bundled `THREE.LatheGeometry` with the current continuous radius profile. Its vertex/index grid is reordered to retain the game's opening-wall interpolation; local press marks, inner-wall thickness, crown opening and bottom closure are applied by the game.
- No second copy, library upgrade or remote runtime dependency was introduced.

## Other candidates reviewed, not copied

- https://github.com/NonLaHu/clayPotThreeDemo
- https://github.com/Suhaid11/Clay-Home

Their published descriptions use radial profiles / rotating rings for pottery. Neither repository exposed a recognized license in its repository metadata when reviewed on 2026-10-16. No code from these projects is included.

## Opening skirt triangulation

- Uses the already bundled `THREE.ShapeUtils.triangulateShape`, including the bundle's Earcut 3.0.1 implementation (https://github.com/mapbox/earcut/tree/v3.0.1).
- The exact drawn opening is kept as a polygon hole; its rounded enclosing footprint is triangulated instead of pairing two scaled contours. No additional runtime dependency or second library copy is introduced.
- Earcut license: ISC, reproduced in `EARCUT-LICENSE.txt`.


## Sculpt translation field (v0.3.9)

- Paper: https://graphics.pixar.com/library/Kelvinlets/paper.pdf (de Goes / James 2017, equations 6 and multiscale construction).
- Translation kernel reference: https://github.com/fbsamples/sculpting-and-simulations-sample/blob/master/code/kelvinlets.h, reviewed blob `4b8be589517e2857f136011721022001d4c8f8a8`.
- The translation coefficients were adapted to JavaScript from this BSD implementation. Copyright and full license are included in `KELVINLETS-LICENSE.txt`. No libigl code or new runtime package was copied.
- Game adaptations in `src/sculpt-flow.js`: 20-point ring quadrature to retain circular sections; reflected sources at the supported base; three-scale weights that cancel two far-field terms; a smooth divergence-free lift field that carries the upper clay; supported affine top compression; RK4 integration and geometric resistance during the gesture.
- The constants are interaction parameters, not measured wet-clay properties. Tiny far-field numeric-bound corrections and sampled profile interpolation mean finite numerical volume error is possible. Gravity, water content and hollow-wall failure are not simulated.
