import * as T from 'three';

export const galleryCases = {
  own: { x: -.78, width: 1.24, depth: 1.20, height: 1.85 },
  reference: { x: .9, width: 1.40, depth: 1.40, height: 1.85 },
};

// Measure around the same local axis the visitor rotates. A box measured at
// one angle misses a projecting lip when it turns towards a different pane.
export function turningEnvelope(root: T.Object3D) {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert();
  const relative = new T.Matrix4(), point = new T.Vector3();
  let radiusSquared = 0, bottom = Infinity, top = -Infinity;
  root.traverseVisible(child => {
    if (!(child instanceof T.Mesh)) return;
    const vertices = child.geometry.getAttribute('position');
    if (!vertices) return;
    relative.multiplyMatrices(inverse, child.matrixWorld);
    for (let i = 0; i < vertices.count; i++) {
      point.fromBufferAttribute(vertices, i).applyMatrix4(relative);
      radiusSquared = Math.max(radiusSquared, point.x * point.x + point.z * point.z);
      bottom = Math.min(bottom, point.y);
      top = Math.max(top, point.y);
    }
  });
  return { radius: Math.sqrt(radiusSquared), bottom, height: top - bottom };
}

export function seatInCase(root: T.Object3D, display: typeof galleryCases.own) {
  const { radius, bottom, height } = turningEnvelope(root);
  if (!Number.isFinite(bottom)) return;
  const clearance = .045;
  const scale = Math.min(1, (Math.min(display.width, display.depth) / 2 - clearance) / radius,
    (display.height - clearance) / height);
  root.scale.setScalar(scale);
  root.position.set(display.x, -bottom * scale, 0);
}
