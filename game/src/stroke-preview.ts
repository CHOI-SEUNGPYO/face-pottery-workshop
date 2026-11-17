import { DynamicDrawUsage, Group, Vector3, type InterleavedBufferAttribute } from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import {MAX_STROKE_POINTS} from './stroke';

/** Preview follows the chosen physical width on the pottery surface. */
export class StrokePreview extends Group {
  private geometry = new LineGeometry().setPositions(new Float32Array(MAX_STROKE_POINTS*3));
  private buffer = (this.geometry.getAttribute('instanceStart') as InterleavedBufferAttribute).data;
  private lines = [
    new Line2(
      this.geometry,
      new LineMaterial({
        color: 0xfff6df,
        linewidth: .0098,
        worldUnits: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    ),
    new Line2(
      this.geometry,
      new LineMaterial({
        color: 0x663a28,
        linewidth: .007,
        worldUnits: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    ),
  ];
  constructor() {
    super();
    this.visible = false;
    this.buffer.setUsage(DynamicDrawUsage);
    this.geometry.instanceCount=0;
    this.lines.forEach((line, i) => {
      line.renderOrder = 9 + i;
      this.add(line);
    });
  }
  setPoints(points: Vector3[], width = .007) {
    const count=Math.min(points.length,MAX_STROKE_POINTS);
    this.geometry.instanceCount=Math.max(0,count-1);
    this.visible = count > 1;
    if (!this.visible) return;
    this.lines[0].material.linewidth=width*1.4;
    this.lines[1].material.linewidth=width;
    const data=this.buffer.array,box=this.geometry.boundingBox!;
    box.makeEmpty();
    for(let i=0;i<count;i++){
      box.expandByPoint(points[i]);
      if(i===count-1)break;
      const a=points[i],b=points[i+1],k=i*6;
      data[k]=a.x;data[k+1]=a.y;data[k+2]=a.z;
      data[k+3]=b.x;data[k+4]=b.y;data[k+5]=b.z;
    }
    // Shorter strokes draw only their active segments; old buffer tails stay hidden.
    box.getBoundingSphere(this.geometry.boundingSphere!);
    this.buffer.clearUpdateRanges();this.buffer.addUpdateRange(0,(count-1)*6);
    this.buffer.needsUpdate=true;
  }
}
