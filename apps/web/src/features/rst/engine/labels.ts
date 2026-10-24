import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

/**
 * Fired (bubbling) from a label element when it's clicked, carrying the object
 * the click should select as pivot. The engine listens for it on the container
 * and hands the pivot to the camera — so a label is just another way to click
 * its body, without labels ever knowing the camera exists.
 */
export const LABEL_SELECT_EVENT = 'sterenn:label-select';

export interface LabelSelectDetail {
  /** The object to focus/pivot on — the same root the body registers for picking. */
  pivot: THREE.Object3D;
}

/**
 * Attach a billboarded text label to an object. It tracks the object's world
 * position and always faces the camera. Rendered in the CSS2D overlay, so the
 * text stays crisp and a constant pixel size regardless of zoom.
 *
 * Framework-free: builds a DOM node and a CSS2DObject, adds it to `target`, and
 * returns the label so a caller can restyle or remove it. Nothing here depends
 * on the engine, so any body module can label itself.
 *
 * Pass `pivot` to make the label a clickable proxy for its body: clicking the
 * text then selects that object exactly as clicking the body would. The label
 * dispatches a bubbling LABEL_SELECT_EVENT the engine picks up — it re-enables
 * pointer events on this node alone (the overlay has them off), so the text is
 * clickable but never steals drags or zoom from the canvas beneath it.
 */
export function addLabel(
  target: THREE.Object3D,
  text: string,
  color = '#cfe3ff',
  pivot?: THREE.Object3D,
): CSS2DObject {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.color = color;
  el.style.fontFamily = 'system-ui, sans-serif';
  el.style.fontSize = '12px';
  el.style.fontWeight = '600';
  el.style.whiteSpace = 'nowrap';
  el.style.userSelect = 'none';
  // A drop shadow keeps text legible over both the dark sky and a bright body.
  el.style.textShadow = '0 0 3px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.7)';

  if (pivot) {
    // Re-enable pointer events on just this node (the overlay container keeps
    // them off), so the label catches clicks without blocking the canvas.
    el.style.pointerEvents = 'auto';
    el.style.cursor = 'pointer';
    el.addEventListener('click', (event) => {
      event.stopPropagation();
      el.dispatchEvent(
        new CustomEvent<LabelSelectDetail>(LABEL_SELECT_EVENT, {
          detail: { pivot },
          bubbles: true,
        }),
      );
    });
  } else {
    el.style.pointerEvents = 'none';
  }

  const label = new CSS2DObject(el);
  // Nudge the text up-right of the point so it doesn't sit on the marker.
  label.center.set(-0.05, 1.1);
  target.add(label);
  return label;
}
