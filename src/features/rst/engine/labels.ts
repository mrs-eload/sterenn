import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

/**
 * Attach a billboarded text label to an object. It tracks the object's world
 * position and always faces the camera. Rendered in the CSS2D overlay, so the
 * text stays crisp and a constant pixel size regardless of zoom.
 *
 * Framework-free: builds a DOM node and a CSS2DObject, adds it to `target`, and
 * returns the label so a caller can restyle or remove it. Nothing here depends
 * on the engine, so any body module can label itself.
 */
export function addLabel(
  target: THREE.Object3D,
  text: string,
  color = '#cfe3ff',
): CSS2DObject {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.color = color;
  el.style.fontFamily = 'system-ui, sans-serif';
  el.style.fontSize = '12px';
  el.style.fontWeight = '600';
  el.style.whiteSpace = 'nowrap';
  el.style.pointerEvents = 'none';
  el.style.userSelect = 'none';
  // A drop shadow keeps text legible over both the dark sky and a bright body.
  el.style.textShadow = '0 0 3px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.7)';

  const label = new CSS2DObject(el);
  // Nudge the text up-right of the point so it doesn't sit on the marker.
  label.center.set(-0.05, 1.1);
  target.add(label);
  return label;
}
