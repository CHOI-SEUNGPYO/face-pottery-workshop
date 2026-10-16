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
