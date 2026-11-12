import {
  COLS,
  ROWS,
  clamp,
  freshDocument,
  alignedInterior,
  type PotteryDocument,
  type SoftForm,
} from "./model";

export const formHeights = [0, 0.12, 0.3, 0.5, 0.7, 0.88, 1];
export const forms = {
  round: {
    label: "동글동글",
    height: 1.18,
    width: 1,
    radii: [0.19, 0.24, 0.34, 0.37, 0.33, 0.22, 0.12],
  },
  tall: {
    label: "길쭉하게",
    height: 1.5,
    width: 1,
    radii: [0.19, 0.21, 0.25, 0.27, 0.26, 0.2, 0.12],
  },
  wide: {
    label: "넉넉하게",
    height: 0.8,
    width: 1,
    radii: [0.23, 0.3, 0.4, 0.45, 0.44, 0.36, 0.28],
  },
} satisfies Record<string, SoftForm & { label: string }>;
export type FormId = keyof typeof forms;

/** Monotone cubic interpolation: C1 continuity, no overshoot between knots. */
export function formRadius(form: SoftForm, v: number) {
  const ys = form.radii,
    xs = formHeights;
  const slope = (a: number, b: number) =>
    a * b > 0 ? (2 * a * b) / (a + b) : 0;
  const i = Math.min(
    xs.length - 2,
    Math.max(0, xs.findIndex((x) => x >= v) - 1),
  );
  const span = xs[i + 1] - xs[i],
    t = clamp((v - xs[i]) / span, 0, 1);
  const d = (ys[i + 1] - ys[i]) / span;
  const m0 = i === 0 ? 0 : slope((ys[i] - ys[i - 1]) / (xs[i] - xs[i - 1]), d);
  const m1 =
    i === xs.length - 2
      ? 0
      : slope(d, (ys[i + 2] - ys[i + 1]) / (xs[i + 2] - xs[i + 1]));
  return (
    form.width *
    ((2 * t ** 3 - 3 * t * t + 1) * ys[i] +
      (t ** 3 - 2 * t * t + t) * m0 * span +
      (-2 * t ** 3 + 3 * t * t) * ys[i + 1] +
      (t ** 3 - t * t) * m1 * span)
  );
}

export function applyForm(doc: PotteryDocument, value: SoftForm) {
  const form: SoftForm = {
    height: clamp(value.height, 0.65, 1.65),
    width: clamp(value.width, 0.65, 1.4),
    radii: value.radii.map((r) => clamp(r, 0.1, 0.5)),
  };
  const shoulder = 1 - doc.mouth.neckHeight / form.height;
  for (let j = 0; j <= ROWS; j++) {
    const v = j / ROWS,
      r = formRadius(form, Math.min(1, v / shoulder));
    for (let i = 0; i < COLS; i++) {
      const a = (i / COLS) * Math.PI * 2,
        k = (j * COLS + i) * 3;
      doc.outerXYZ.set([r * Math.sin(a), v * form.height, r * Math.cos(a)], k);
    }
  }
  doc.innerXYZ = alignedInterior(doc);
  doc.form = form;
  doc.mouth.center = [0, form.height, 0];
  doc.mouth.rotation = [0, 0, 0, 1];
  doc.mouth.innerRadius = form.radii[6] * form.width - 0.035;
}

/** Only called after an explicit edit, never during load or display. */
export function readForm(doc: PotteryDocument): SoftForm {
  if (doc.form) return structuredClone(doc.form);
  let height = 0;
  for (let k = 1; k < doc.outerXYZ.length; k += 3)
    height = Math.max(height, doc.outerXYZ[k]);
  return {
    height: clamp(height, 0.65, 1.65),
    width: 1,
    radii: formHeights.map((v) => {
      let sum = 0,
        count = 0;
      const row = Math.round(v * ROWS);
      for (let j = Math.max(0, row - 3); j <= Math.min(ROWS, row + 3); j++)
        for (let i = 0; i < COLS; i++) {
          const k = (j * COLS + i) * 3;
          sum += Math.hypot(doc.outerXYZ[k], doc.outerXYZ[k + 2]);
          count++;
        }
      return clamp(sum / count, 0.1, 0.5);
    }),
  };
}
export function createSoftDocument() {
  const doc = freshDocument();
  doc.mouth.opened = true;
  applyForm(doc, forms.round);
  return doc;
}

/** Work from the gesture's starting curve so dense pointer events do not accumulate dents. */
export function shapeForm(
  start: SoftForm,
  v: number,
  amount: number,
): SoftForm {
  return {
    ...start,
    radii: start.radii.map((r, i) =>
      clamp(
        r +
          (amount / start.width) *
            Math.exp(-0.5 * ((formHeights[i] - v) / 0.24) ** 2),
        0.1,
        0.5,
      ),
    ),
  };
}
export function smoothForm(doc: PotteryDocument) {
  const form = readForm(doc),
    original = form.radii;
  form.radii = original.map((r, i) =>
    i === 0 || i === 6 ? r : (original[i - 1] + r * 4 + original[i + 1]) / 6,
  );
  applyForm(doc, form);
}
export function adjustMouth(
  doc: PotteryDocument,
  radius: number,
  height: number,
) {
  const form = readForm(doc);
  form.radii[6] = clamp((radius + 0.035) / form.width, 0.1, 0.5);
  doc.mouth.neckHeight = clamp(height, 0.02, 0.06);
  applyForm(doc, form);
}
