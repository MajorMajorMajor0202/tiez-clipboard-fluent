export interface WindowFrameState {
  square_corners: boolean;
  maximized: boolean;
  snapped: boolean;
}

/** Share one radius between the DOM clip, background and Canvas border. */
export function applyWindowFrameState(doc: Document, state: WindowFrameState) {
  doc.documentElement.classList.toggle("window-square-corners", state.square_corners);
  doc.body.classList.toggle("window-square-corners", state.square_corners);
}
