import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// Objects on this layer bloom; everything else is masked to black in the bloom
// pass, so only the Sun (and the orbit dots) glow. Layer 0 stays enabled too, so
// the same object still renders normally in the final composite. Bodies opt in
// with `object.layers.enable(BLOOM_LAYER)`.
export const BLOOM_LAYER = 1;

/**
 * Selective bloom via the two-composer trick, lifted out of the engine so it
 * owns only the post-processing pipeline (renderer + scene + camera in,
 * `render()` out).
 *
 *  - bloomComposer renders the scene with every non-bloom object blacked out,
 *    then UnrealBloomPass blurs the result into a glow buffer (off-screen).
 *  - finalComposer renders the real scene, then a mix pass adds that glow buffer
 *    on top, and OutputPass encodes linear → sRGB for display.
 * Both draw the same scene/camera; the bloom layer decides what glows.
 */
export class BloomPipeline {
  private readonly bloomComposer: EffectComposer;
  private readonly finalComposer: EffectComposer;
  private readonly bloomLayer = new THREE.Layers();
  // Swapped in for non-bloom meshes during the bloom pass; still writes depth,
  // so a body in front of the Sun correctly occludes its glow.
  private readonly darkMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
  private readonly savedMaterials = new Map<string, THREE.Material | THREE.Material[]>();
  // Non-mesh renderables (orbit/trajectory lines) hidden during the bloom pass.
  private readonly hiddenForBloom: THREE.Object3D[] = [];

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
    width: number,
    height: number,
  ) {
    this.bloomLayer.set(BLOOM_LAYER);

    const renderPass = new RenderPass(this.scene, this.camera);

    const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.2, 0.05, 0);
    // strength, radius, threshold: threshold 0 is safe because the mask already
    // leaves only the Sun and the orbit dots bright. Strength stays high (they
    // keep their brightness/shine) but the radius is small, so the glow hugs each
    // dot instead of spreading into a hazy halo over the whole scene.

    this.bloomComposer = new EffectComposer(this.renderer);
    this.bloomComposer.renderToScreen = false;
    this.bloomComposer.addPass(renderPass);
    this.bloomComposer.addPass(bloomPass);

    const mixPass = new ShaderPass(
      new THREE.ShaderMaterial({
        uniforms: {
          u_baseTexture: { value: null },
          u_bloomTexture: { value: this.bloomComposer.renderTarget2.texture },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform sampler2D u_baseTexture;
          uniform sampler2D u_bloomTexture;
          varying vec2 vUv;
          void main() {
            gl_FragColor = texture2D(u_baseTexture, vUv) + texture2D(u_bloomTexture, vUv);
          }
        `,
      }),
      // ShaderPass feeds the previous pass's output into this named uniform.
      'u_baseTexture',
    );
    mixPass.needsSwap = true;

    this.finalComposer = new EffectComposer(this.renderer);
    this.finalComposer.addPass(renderPass);
    this.finalComposer.addPass(mixPass);
    this.finalComposer.addPass(new OutputPass());

    const ratio = this.renderer.getPixelRatio();
    this.bloomComposer.setPixelRatio(ratio);
    this.finalComposer.setPixelRatio(ratio);
  }

  /**
   * One frame of the selective-bloom pipeline. The skybox is dropped for the
   * bloom pass so only the Sun feeds the glow, then restored for the real render.
   */
  render(): void {
    const background = this.scene.background;
    this.scene.background = null;
    this.scene.traverse(this.darkenNonBloomed);
    this.bloomComposer.render();
    this.scene.traverse(this.restoreMaterial);
    for (const obj of this.hiddenForBloom) obj.visible = true;
    this.hiddenForBloom.length = 0;
    this.scene.background = background;
    this.finalComposer.render();
  }

  setSize(width: number, height: number): void {
    this.bloomComposer.setSize(width, height);
    this.finalComposer.setSize(width, height);
  }

  dispose(): void {
    // Composers own their render targets (and the bloom pass); free them first.
    this.bloomComposer.dispose();
    this.finalComposer.dispose();
    this.darkMaterial.dispose();
  }

  /**
   * Bloom-pass mask (run via scene.traverse). For objects not on the bloom
   * layer: meshes are swapped to flat black — kept in place so they still occlude
   * the Sun's glow — while lines/points (orbit paths, trajectories) are hidden
   * outright, since at threshold 0 even their dim colour would otherwise bloom.
   */
  private readonly darkenNonBloomed = (obj: THREE.Object3D): void => {
    if (this.bloomLayer.test(obj.layers)) return;
    const renderable = obj as THREE.Mesh & THREE.Line;
    if (renderable.isMesh) {
      this.savedMaterials.set(obj.uuid, renderable.material);
      renderable.material = this.darkMaterial;
    } else if (renderable.isLine || (renderable as unknown as THREE.Points).isPoints) {
      this.hiddenForBloom.push(obj);
      obj.visible = false;
    }
  };

  /** Undo darkenNonBloomed after the bloom pass. */
  private readonly restoreMaterial = (obj: THREE.Object3D): void => {
    const saved = this.savedMaterials.get(obj.uuid);
    if (saved) {
      (obj as THREE.Mesh).material = saved;
      this.savedMaterials.delete(obj.uuid);
    }
  };
}
