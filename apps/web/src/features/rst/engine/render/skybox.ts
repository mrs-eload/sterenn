import * as THREE from 'three';

/**
 * Load an equirectangular (2:1) panorama and hand back the configured texture.
 * Async: `onLoad` fires once it resolves. The caller owns lifecycle — decide
 * whether the engine is still alive, set it as the scene background, and track
 * it for disposal — so this stays a pure "fetch + configure a texture" helper
 * with no engine references.
 */
export function loadSkyboxTexture(url: string, onLoad: (texture: THREE.Texture) => void): void {
  new THREE.TextureLoader().load(url, (texture) => {
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    // A 2:1 panorama wraps the sphere of directions; sRGB so it isn't washed.
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    onLoad(texture);
  });
}
