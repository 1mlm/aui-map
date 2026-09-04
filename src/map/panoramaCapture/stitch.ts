import {
  AddEquation,
  CanvasTexture,
  ClampToEdgeWrapping,
  CustomBlending,
  HalfFloatType,
  LinearFilter,
  Mesh,
  NoBlending,
  OneFactor,
  OrthographicCamera,
  PlaneGeometry,
  type Quaternion,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three"
import { tanHalfFov } from "./equirect"

export const EQUIRECT_WIDTH_PX = 3072
export const EQUIRECT_HEIGHT_PX = 1536

// the live coverage thumbnail during capture is a ~112px CSS box -- rendering the normalize pass
// at the full 3072x1536 export resolution for that, after every single shot, spends real GPU
// fill-rate a mobile phone doesn't have to spare while it's also decoding camera video and running
// the guide loop. Same aspect ratio as the full canvas (16:8), just an eighth the pixels
const LIVE_PREVIEW_WIDTH_PX = 384
const LIVE_PREVIEW_HEIGHT_PX = 192

// worldDir(uv) here has to match equirect.ts's yawPitchToDirection exactly -- one's GLSL, one's
// JS, so they can't literally share the function, but they must agree on which axis is "yaw 0" and
// which way pitch runs or captured tiles land in the wrong spot on the sphere
const EQUIRECT_DIRECTION_GLSL = /* glsl */ `
  vec3 equirectDirection(vec2 uv) {
    float yaw = (uv.x - 0.5) * 6.28318530718;
    float pitch = (uv.y - 0.5) * 3.14159265359;
    return vec3(cos(pitch) * cos(yaw), sin(pitch), cos(pitch) * sin(yaw));
  }
`

// rotates `v` by the conjugate of unit quaternion `q` -- i.e. world space into the local space q
// describes -- using the standard cross-product form of quaternion-vector rotation
const CONJUGATE_ROTATE_GLSL = /* glsl */ `
  vec3 rotateByConjugate(vec3 v, vec4 q) {
    vec4 qc = vec4(-q.xyz, q.w);
    vec3 t = 2.0 * cross(qc.xyz, v);
    return v + qc.w * t + cross(qc.xyz, t);
  }
`

const PASSTHROUGH_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

// one capture's contribution to the equirect canvas: for every texel, work out the ray direction
// it represents, rotate that into the capture's own local (camera) space, and -- if that ray fell
// inside the capture's frustum -- sample the photo there. Written with additive (ONE, ONE)
// blending into an RGBA16F target, color pre-multiplied by weight, so accumulating many overlapping
// captures is just "add more in" rather than "figure out how to overwrite cleanly"
const ACCUMULATE_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D tCapture;
  uniform vec4 uQuaternion;
  uniform float uTanHalfFovX;
  uniform float uTanHalfFovY;
  varying vec2 vUv;

  ${EQUIRECT_DIRECTION_GLSL}
  ${CONJUGATE_ROTATE_GLSL}

  void main() {
    vec3 worldDir = equirectDirection(vUv);
    vec3 localDir = rotateByConjugate(worldDir, uQuaternion);
    if (localDir.z >= 0.0) discard; // behind the camera at capture time

    vec2 ndc = localDir.xy / -localDir.z;
    if (abs(ndc.x) > uTanHalfFovX || abs(ndc.y) > uTanHalfFovY) discard;

    vec2 sampleUv = vec2(
      0.5 + 0.5 * ndc.x / uTanHalfFovX,
      0.5 - 0.5 * ndc.y / uTanHalfFovY
    );
    vec3 color = texture2D(tCapture, sampleUv).rgb;

    // feather toward the frustum edge so two overlapping captures blend into each other instead
    // of meeting at a hard seam where one's frustum simply stops
    float edge = 1.0 - max(abs(ndc.x) / uTanHalfFovX, abs(ndc.y) / uTanHalfFovY);
    float weight = smoothstep(0.0, 0.35, edge);
    gl_FragColor = vec4(color * weight, weight);
  }
`

// un-premultiplies the accumulated color/weight buffer into a viewable image -- also what turns a
// never-covered texel (weight 0) into a visible "not captured yet" gap rather than undefined noise.
// picked light enough to read clearly against the black capture UI (the live coverage thumbnail
// is the whole point of this being visible at all, not just a technically-correct fallback) but
// still unmistakably "empty", not close enough to a real photo to be confused for one
const NORMALIZE_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D tAccum;
  varying vec2 vUv;

  void main() {
    vec4 accum = texture2D(tAccum, vUv);
    if (accum.a <= 0.0001) {
      gl_FragColor = vec4(0.26, 0.28, 0.33, 1.0);
      return;
    }
    gl_FragColor = vec4(accum.rgb / accum.a, 1.0);
  }
`

function fullscreenQuadMaterial(
  fragmentShader: string,
  uniforms: Record<string, { value: unknown }>,
) {
  return new ShaderMaterial({
    vertexShader: PASSTHROUGH_VERTEX_SHADER,
    fragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
  })
}

// accumulates captured frames onto a growing equirectangular sphere as they come in, and can
// render the current state (partial or finished) to its own canvas at any point -- that canvas
// doubles as both the live "here's what you've covered so far" preview and, at the end, the
// source for the exported blob. One instance per capture session; call dispose() when it closes
export class PanoramaStitcher {
  readonly canvas: HTMLCanvasElement
  private renderer: WebGLRenderer
  private accumTarget: WebGLRenderTarget
  // a second, byte-precision target the export path reads back from -- toBlob() on the visible
  // canvas depends on the compositor having faithfully preserved the default framebuffer, which
  // is the fragile path on some mobile GPUs. Reading an offscreen target's pixels directly and
  // building the PNG from those bytes ourselves sidesteps that entirely
  private exportTarget: WebGLRenderTarget
  private quadGeometry = new PlaneGeometry(2, 2)
  private quadScene = new Scene()
  private quadCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private accumulateMaterial: ShaderMaterial
  private normalizeMaterial: ShaderMaterial
  private quadMesh: Mesh

  constructor() {
    this.canvas = document.createElement("canvas")
    this.canvas.width = EQUIRECT_WIDTH_PX
    this.canvas.height = EQUIRECT_HEIGHT_PX
    this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      preserveDrawingBuffer: true,
    })
    this.renderer.setSize(EQUIRECT_WIDTH_PX, EQUIRECT_HEIGHT_PX, false)
    // autoClear defaults to true, which would wipe accumTarget's color buffer back to zero at
    // the start of every single accumulate() call -- since additive blending is how captures
    // stack onto each other, that would mean only the most recent capture ever survives. Cleared
    // once by hand right after the target exists (below), then never again
    this.renderer.autoClear = false

    this.accumTarget = new WebGLRenderTarget(
      EQUIRECT_WIDTH_PX,
      EQUIRECT_HEIGHT_PX,
      {
        type: HalfFloatType,
        depthBuffer: false,
        stencilBuffer: false,
        wrapS: ClampToEdgeWrapping,
        wrapT: ClampToEdgeWrapping,
        minFilter: LinearFilter,
        magFilter: LinearFilter,
      },
    )
    this.exportTarget = new WebGLRenderTarget(
      EQUIRECT_WIDTH_PX,
      EQUIRECT_HEIGHT_PX,
      {
        type: UnsignedByteType,
        depthBuffer: false,
        stencilBuffer: false,
      },
    )
    // the one-time clear autoClear would otherwise have given accumTarget for free -- a render
    // target's backing texture isn't guaranteed zeroed GPU memory until something actually
    // clears it. The renderer's clear alpha defaults to 1 (opaque black), which here would mean
    // every never-captured texel reads back as "fully weighted, color zero" instead of "zero
    // weight" -- normalize's uncaptured-fallback branch checks alpha, so it has to actually start
    // at 0
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.setRenderTarget(this.accumTarget)
    this.renderer.clear(true, true, true)
    this.renderer.setRenderTarget(null)

    this.accumulateMaterial = fullscreenQuadMaterial(
      ACCUMULATE_FRAGMENT_SHADER,
      {
        tCapture: { value: null },
        uQuaternion: { value: [0, 0, 0, 1] },
        uTanHalfFovX: { value: 1 },
        uTanHalfFovY: { value: 1 },
      },
    )
    this.accumulateMaterial.blending = CustomBlending
    this.accumulateMaterial.blendEquation = AddEquation
    this.accumulateMaterial.blendSrc = OneFactor
    this.accumulateMaterial.blendDst = OneFactor
    this.accumulateMaterial.transparent = true

    this.normalizeMaterial = fullscreenQuadMaterial(NORMALIZE_FRAGMENT_SHADER, {
      tAccum: { value: this.accumTarget.texture },
    })
    this.normalizeMaterial.blending = NoBlending

    this.quadMesh = new Mesh(this.quadGeometry, this.accumulateMaterial)
    // the vertex shader writes clip-space position directly (`position.xy` straight into
    // gl_Position) and ignores the camera's matrices entirely -- but three.js still frustum-culls
    // meshes against the camera before ever calling the vertex shader, and an orthographic camera
    // with near=0 produces a degenerate frustum that culls this mesh every time, silently
    // skipping the draw call. This quad has no meaningful bounds to cull against anyway
    this.quadMesh.frustumCulled = false
    this.quadScene.add(this.quadMesh)

    // the accumulation target starts at (0,0,0,0) everywhere, which normalize already treats as
    // "not captured" -- nothing to clear explicitly beyond the target's own initial state
  }

  // `source` is a snapshot of one capture, already the still frame it'll stay as (a live video
  // element would keep changing under the shader otherwise). `quaternion` is the phone's facing
  // direction at the moment it was taken
  accumulate(source: HTMLCanvasElement, quaternion: Quaternion) {
    const texture = new CanvasTexture(source)
    texture.flipY = false
    texture.minFilter = LinearFilter
    texture.magFilter = LinearFilter
    texture.wrapS = ClampToEdgeWrapping
    texture.wrapT = ClampToEdgeWrapping
    texture.needsUpdate = true

    const { tanHalfFovX, tanHalfFovY } = tanHalfFov(source.width, source.height)
    this.accumulateMaterial.uniforms.tCapture.value = texture
    this.accumulateMaterial.uniforms.uQuaternion.value = quaternion.toArray()
    this.accumulateMaterial.uniforms.uTanHalfFovX.value = tanHalfFovX
    this.accumulateMaterial.uniforms.uTanHalfFovY.value = tanHalfFovY

    this.quadMesh.material = this.accumulateMaterial
    this.renderer.setRenderTarget(this.accumTarget)
    this.renderer.render(this.quadScene, this.quadCamera)
    this.renderer.setRenderTarget(null)

    texture.dispose()
    this.renderPreview()
  }

  // draws the current accumulated state (however partial) onto `this.canvas`, downscaled -- called
  // after every capture so the corner thumbnail stays live, cheaply. `this.canvas` is also what the
  // confirm step's SphereViewer reads from, so it's brought back up to full resolution once, via
  // renderFullPreview(), the moment capturing actually finishes rather than after every shot
  renderPreview() {
    this.quadMesh.material = this.normalizeMaterial
    this.renderer.setSize(LIVE_PREVIEW_WIDTH_PX, LIVE_PREVIEW_HEIGHT_PX, false)
    this.renderer.setRenderTarget(null)
    this.renderer.render(this.quadScene, this.quadCamera)
  }

  renderFullPreview() {
    this.quadMesh.material = this.normalizeMaterial
    this.renderer.setSize(EQUIRECT_WIDTH_PX, EQUIRECT_HEIGHT_PX, false)
    this.renderer.setRenderTarget(null)
    this.renderer.render(this.quadScene, this.quadCamera)
  }

  async exportBlob(): Promise<Blob> {
    this.quadMesh.material = this.normalizeMaterial
    this.renderer.setRenderTarget(this.exportTarget)
    this.renderer.render(this.quadScene, this.quadCamera)

    const pixels = new Uint8Array(EQUIRECT_WIDTH_PX * EQUIRECT_HEIGHT_PX * 4)
    this.renderer.readRenderTargetPixels(
      this.exportTarget,
      0,
      0,
      EQUIRECT_WIDTH_PX,
      EQUIRECT_HEIGHT_PX,
      pixels,
    )
    this.renderer.setRenderTarget(null)

    // readRenderTargetPixels hands back row 0 as the bottom of the image (nadir, per
    // equirect.ts's convention), but a 2D canvas's ImageData expects row 0 at the top (zenith) --
    // the same top-down order the live preview and SphereViewer already show. Flip it once here
    // rather than getting it backwards in every consumer of the exported file
    const flipped = new Uint8ClampedArray(pixels.length)
    const rowBytes = EQUIRECT_WIDTH_PX * 4
    for (let row = 0; row < EQUIRECT_HEIGHT_PX; row++) {
      const sourceStart = row * rowBytes
      const destStart = (EQUIRECT_HEIGHT_PX - 1 - row) * rowBytes
      flipped.set(
        pixels.subarray(sourceStart, sourceStart + rowBytes),
        destStart,
      )
    }

    const exportCanvas = document.createElement("canvas")
    exportCanvas.width = EQUIRECT_WIDTH_PX
    exportCanvas.height = EQUIRECT_HEIGHT_PX
    const ctx = exportCanvas.getContext("2d")
    if (!ctx) throw new Error("Couldn't export the panorama.")
    ctx.putImageData(
      new ImageData(flipped, EQUIRECT_WIDTH_PX, EQUIRECT_HEIGHT_PX),
      0,
      0,
    )

    return new Promise((resolve, reject) => {
      exportCanvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new Error("Couldn't export the panorama.")),
        "image/png",
      )
    })
  }

  dispose() {
    this.accumTarget.dispose()
    this.exportTarget.dispose()
    this.quadGeometry.dispose()
    this.accumulateMaterial.dispose()
    this.normalizeMaterial.dispose()
    this.renderer.dispose()
  }
}
