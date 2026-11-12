const paths: Record<string, string> = {
  shape:
    "M8 12V7a2 2 0 0 1 4 0v4-6a2 2 0 0 1 4 0v7-4a2 2 0 0 1 4 0v7c0 5-3 8-7 8-3 0-5-2-7-5l-3-5a2 2 0 0 1 3-2l2 3",
  rotate: "M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5m-4 8a8 8 0 0 0 14 3l3-3m0 5v-5h-5",
  mouth: "M6 6c0-4 12-4 12 0s-12 4-12 0m0 0v4c-5 4-5 11 6 11s11-7 6-11V6",
  carve: "m4 20 3-7L18 2l4 4L11 17l-7 3m3-7 4 4",
  pierce: "M4 12a8 8 0 1 0 16 0 8 8 0 1 0-16 0m5 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0",
  erase: "m3 14 10-11 8 8-10 11H8l-5-5v-3m5-5 8 8M10 22h12",
  refine: "M3 17c3-10 6 8 10-2s6 2 10-6M7 3v6M4 6h6M18 19v5m-2.5-2.5h5",
  brush: "m12 13 7-11 3 2-8 11M12 13c-5-1-8 2-7 5-1 1-2 2-3 2 7 3 11 0 12-5z",
  place: "M12 2v9m-4-4 4 4 4-4M4 16h16l-2 6H6z",
  undo: "m8 4-5 5 5 5M3 9h10a7 7 0 0 1 0 14",
  redo: "m16 4 5 5-5 5m5-5H11a7 7 0 0 0 0 14",
  previous: "m15 4-8 8 8 8",
  next: "m9 4 8 8-8 8",
  home: "m2 11 10-8 10 8M5 9v13h14V9m-10 13v-8h6v8",
  help: "M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 4v.2M2 12a10 10 0 1 0 20 0 10 10 0 1 0-20 0",
  story: "M12 5C8 2 4 3 2 4v16c4-2 7-1 10 1 3-2 6-3 10-1V4c-2-1-6-2-10 1v16",
  close: "m5 5 14 14M5 19 19 5",
  check: "m4 12 5 5L20 6",
  play: "m7 3 14 9-14 9z",
  fire: "M13 2c2 6-6 6-3 12 3 1 5-2 5-5 8 9 2 13-3 13S0 17 6 9c0 4 3 5 3 3-1-4 4-7 4-10",
  sound: "M3 9h4l5-5v16l-5-5H3zM16 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14",
  muted: "M3 9h4l5-5v16l-5-5H3zM17 9l5 6m-5 0 5-6",
  photo: "M3 7h4l2-3h6l2 3h4v14H3zM8 14a4 4 0 1 0 8 0 4 4 0 1 0-8 0",
  download: "M12 2v13m-5-5 5 5 5-5M3 17v5h18v-5",
  minus: "M5 12h14",
  plus: "M5 12h14M12 5v14",
};
export function icon(name: string) {
  return `<svg viewBox="0 0 26 26" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name] ?? paths.check}"/></svg>`;
}
