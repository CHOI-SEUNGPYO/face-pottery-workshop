import { Group, Vector3 } from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";

/** Pixel-width lines remain readable on bright clay at every view and zoom. */
export class StrokePreview extends Group {
  private geometry = new LineGeometry();
  private lines = [
    new Line2(
      this.geometry,
      new LineMaterial({
        color: 0xfff6df,
        linewidth: 7,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    ),
    new Line2(
      this.geometry,
      new LineMaterial({
        color: 0x663a28,
        linewidth: 3.5,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    ),
  ];
  constructor() {
    super();
    this.visible = false;
    this.lines.forEach((line, i) => {
      line.renderOrder = 9 + i;
      this.add(line);
    });
  }
  setPoints(points: Vector3[]) {
    this.visible = points.length > 1;
    if (!this.visible) return;
    this.geometry.dispose();
    this.geometry = new LineGeometry().setPositions(
      points.flatMap((p) => p.toArray()),
    );
    for (const line of this.lines) line.geometry = this.geometry;
  }
}
