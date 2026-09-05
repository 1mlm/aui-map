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
  Quaternion,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three"
import { CAMERA_LONG_EDGE_FOV_DEG, tanHalfFov, wrapDeltaDeg } from "./equirect"

const RAD2DEG = 180 / Math.PI
const DEG2RAD = Math.PI / 180
const WORLD_UP = new Vector3(0, 1, 0)

// the live coverage strip during capture renders cheap and small -- rendering the normalize pass
// at full export resolution after every single frame spends real GPU fill-rate a phone doesn't
// have to spare while it's also decoding camera video and running the alignment search below
const LIVE_PREVIEW_MAX_WIDTH_PX = 1024

// how far (in pixels, at the panorama's own resolution) the local alignment pass searches for a
// better match than the raw orientation reading alone would place a frame at. Bigger catches more
// sensor drift but costs more per-frame CPU and risks locking onto a false match on a
// low-texture wall/sky; picked to comfortably cover the kind of drift a phone's gyro accumulates
// over one frame-to-frame step, not a whole session's worth
const ALIGN_SEARCH_RANGE_PX = 28
const ALIGN_PATCH_WIDTH_PX = 44
const ALIGN_STRIP_HEIGHT_PX = 64
// a correction bigger than this almost certainly means the search locked onto the wrong feature
// (a repeating pattern, a flat featureless wall) rather than actually finding the seam -- capped
// rather than trusted outright, so a bad match nudges the frame a little instead of teleporting it
const ALIGN_MAX_CORRECTION_DEG = 6

// worldDir(uv) here has to match equirect.ts's yawPitchToDirection exactly -- one's GLSL, one's
// JS, so they can't literally share the function, but they must agree on which axis is "yaw 0" and
// which way pitch runs or captured tiles land in the wrong spot on the canvas. uPitchHalfRangeRad
// is a uniform (not baked in) because it depends on the phone's actual camera aspect ratio, known
// only once capture starts -- this is a narrow band around the horizon, not a full sphere, which
// is the whole point of "linear 360" over the old full-sphere capture
const CYLINDER_DIRECTION_GLSL = /* glsl */ `
  uniform float uPitchHalfRangeRad;
  vec3 cylinderDirection(vec2 uv) {
    float yaw = (uv.x - 0.5) * 6.28318530718;
    float pitch = (uv.y - 0.5) * 2.0 * uPitchHalfRangeRad;
    return vec3(cos(pitch) * cos(yaw), sin(pitch), cos(pitch) * sin(yaw));
  }
`

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

// one capture's contribution to the cylindrical canvas: for every texel, work out the ray
// direction it represents, rotate that into the capture's own local (camera) space, and -- if
// that ray fell inside the capture's frustum -- sample the photo there. Written with additive
// (ONE, ONE) blending into an RGBA16F target, color pre-multiplied by weight, so accumulating
// many overlapping captures is just "add more in" rather than figuring out how to overwrite
// cleanly
const ACCUMULATE_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D tCapture;
  uniform vec4 uQuaternion;
  uniform float uTanHalfFovX;
  uniform float uTanHalfFovY;
  varying vec2 vUv;

  ${CYLINDER_DIRECTION_GLSL}
  ${CONJUGATE_ROTATE_GLSL}

  void main() {
    vec3 worldDir = cylinderDirection(vUv);
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
// never-covered texel (weight 0) into a visible "not captured yet" gap rather than undefined noise
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

// grayscale luma of a small crop, for the alignment search below -- SSD on full RGB would just be
// tripling the work for a search this small without meaningfully better matches
function toGrayscale(imageData: ImageData): Float32Array {
  const { data } = imageData
  const gray = new Float32Array(data.length / 4)
  for (let i = 0; i < gray.length; i++) {
    const o = i * 4
    gray[i] = data[o] * 0.299 + data[o + 1] * 0.587 + data[o + 2] * 0.114
  }
  return gray
}

// slides `candidate` across `reference` (both grayscale, same height) and returns the horizontal
// offset -- in pixels, relative to the reference window's own left edge -- where the sum of
// squared differences is smallest. Reference is always `candidate`'s width plus 2*searchRangePx
// wider than candidate, so every offset in [0, 2*searchRangePx] is a fully-in-bounds comparison
function bestMatchOffsetPx(
  reference: Float32Array,
  referenceWidthPx: number,
  candidate: Float32Array,
  candidateWidthPx: number,
  heightPx: number,
  searchRangePx: number,
): number {
  let bestOffset = searchRangePx
  let bestScore = Number.POSITIVE_INFINITY
  for (let offset = 0; offset <= 2 * searchRangePx; offset++) {
    let score = 0
    for (let y = 0; y < heightPx; y++) {
      const refRowStart = y * referenceWidthPx + offset
      const candRowStart = y * candidateWidthPx
      for (let x = 0; x < candidateWidthPx; x++) {
        const diff = reference[refRowStart + x] - candidate[candRowStart + x]
        score += diff * diff
      }
    }
    if (score < bestScore) {
      bestScore = score
      bestOffset = offset
    }
  }
  return bestOffset - searchRangePx
}

// accumulates captured frames onto a growing cylindrical (horizon-band, not full-sphere) canvas
// as they come in, correcting each new frame's placement against a local pixel search rather
// than trusting the orientation sensor's yaw outright -- device orientation is accurate enough to
// predict roughly where a frame lands, but not pixel-accurate, and a "linear 360 you can scroll
// through" lives or dies on that seam actually lining up. One instance per capture session; call
// dispose() when it closes
export class PanoramaStitcher {
  readonly canvas: HTMLCanvasElement
  readonly widthPx: number
  readonly heightPx: number
  readonly pxPerDeg: number
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
  // reused scratch canvases for the alignment search -- allocated once, redrawn every frame,
  // rather than a fresh canvas (and getImageData allocation) per capture
  private referenceScratch: HTMLCanvasElement
  private candidateScratch: HTMLCanvasElement
  private hasFirstFrame = false
  // tracks the actually-used (corrected) yaw span so export can crop to what was really swept
  // instead of shipping a mostly-empty 360°-wide image for a partial pan
  private minYawDeg = 0
  private maxYawDeg = 0

  // `frameWidthPx`/`frameHeightPx` are the captured video frame's own dimensions -- the canvas's
  // pixel density is derived directly from them (frame pixels per degree of the camera's own
  // FOV), so a frame's own left-edge pixels land at exactly the same scale as the canvas region
  // they're being matched against, with no resampling in between to blur the alignment search
  constructor(frameWidthPx: number, frameHeightPx: number) {
    const longPx = Math.max(frameWidthPx, frameHeightPx)
    this.pxPerDeg = longPx / CAMERA_LONG_EDGE_FOV_DEG
    const { tanHalfFovY } = tanHalfFov(frameWidthPx, frameHeightPx)
    const verticalFovDeg = 2 * Math.atan(tanHalfFovY) * RAD2DEG
    this.widthPx = Math.round(360 * this.pxPerDeg)
    this.heightPx = Math.round(verticalFovDeg * this.pxPerDeg)

    this.canvas = document.createElement("canvas")
    this.canvas.width = this.widthPx
    this.canvas.height = this.heightPx
    this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      preserveDrawingBuffer: true,
    })
    this.renderer.setSize(this.widthPx, this.heightPx, false)
    // autoClear defaults to true, which would wipe accumTarget's color buffer back to zero at
    // the start of every single accumulate() call -- since additive blending is how captures
    // stack onto each other, that would mean only the most recent capture ever survives. Cleared
    // once by hand right after the target exists (below), then never again
    this.renderer.autoClear = false

    this.accumTarget = new WebGLRenderTarget(this.widthPx, this.heightPx, {
      type: HalfFloatType,
      depthBuffer: false,
      stencilBuffer: false,
      wrapS: ClampToEdgeWrapping,
      wrapT: ClampToEdgeWrapping,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
    })
    this.exportTarget = new WebGLRenderTarget(this.widthPx, this.heightPx, {
      type: UnsignedByteType,
      depthBuffer: false,
      stencilBuffer: false,
    })
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
        uPitchHalfRangeRad: { value: (verticalFovDeg / 2) * DEG2RAD },
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
    // the vertex shader writes clip-space position directly and ignores the camera's matrices
    // entirely, but three.js still frustum-culls meshes against the camera before ever calling
    // the vertex shader, and an orthographic camera with near=0 produces a degenerate frustum
    // that culls this mesh every time, silently skipping the draw call. This quad has no
    // meaningful bounds to cull against anyway
    this.quadMesh.frustumCulled = false
    this.quadScene.add(this.quadMesh)

    this.referenceScratch = document.createElement("canvas")
    this.referenceScratch.width =
      ALIGN_PATCH_WIDTH_PX + 2 * ALIGN_SEARCH_RANGE_PX
    this.referenceScratch.height = ALIGN_STRIP_HEIGHT_PX
    this.candidateScratch = document.createElement("canvas")
    this.candidateScratch.width = ALIGN_PATCH_WIDTH_PX
    this.candidateScratch.height = ALIGN_STRIP_HEIGHT_PX
  }

  // best-effort: measures how far off the raw orientation reading's placement looks against
  // what's already on the canvas, in degrees of yaw. Returns 0 (no correction) whenever the
  // predicted placement is too close to a canvas edge to sample a full search window, or when
  // there's nothing accumulated yet to compare against
  private measureYawCorrectionDeg(
    source: HTMLCanvasElement,
    rawYawDeg: number,
  ) {
    const { tanHalfFovX } = tanHalfFov(source.width, source.height)
    const halfFovXDeg = Math.atan(tanHalfFovX) * RAD2DEG
    const leftEdgeYawDeg = (((rawYawDeg - halfFovXDeg) % 360) + 360) % 360
    const predictedX = Math.round((leftEdgeYawDeg / 360) * this.widthPx)

    const referenceWidth = this.referenceScratch.width
    const windowStartX = predictedX - ALIGN_SEARCH_RANGE_PX
    if (windowStartX < 0 || windowStartX + referenceWidth > this.widthPx)
      return 0

    const stripY = Math.round((this.heightPx - ALIGN_STRIP_HEIGHT_PX) / 2)
    const refCtx = this.referenceScratch.getContext("2d")
    const candCtx = this.candidateScratch.getContext("2d")
    if (!refCtx || !candCtx) return 0

    refCtx.drawImage(
      this.canvas,
      windowStartX,
      stripY,
      referenceWidth,
      ALIGN_STRIP_HEIGHT_PX,
      0,
      0,
      referenceWidth,
      ALIGN_STRIP_HEIGHT_PX,
    )
    // the source frame's own left edge (x=0) is by definition the same direction as
    // `leftEdgeYawDeg` -- no projection math needed to find it, it's just column 0
    const sourceStripY = Math.round((source.height - ALIGN_STRIP_HEIGHT_PX) / 2)
    candCtx.drawImage(
      source,
      0,
      sourceStripY,
      ALIGN_PATCH_WIDTH_PX,
      ALIGN_STRIP_HEIGHT_PX,
      0,
      0,
      ALIGN_PATCH_WIDTH_PX,
      ALIGN_STRIP_HEIGHT_PX,
    )

    const reference = toGrayscale(
      refCtx.getImageData(0, 0, referenceWidth, ALIGN_STRIP_HEIGHT_PX),
    )
    const candidate = toGrayscale(
      candCtx.getImageData(0, 0, ALIGN_PATCH_WIDTH_PX, ALIGN_STRIP_HEIGHT_PX),
    )
    const offsetPx = bestMatchOffsetPx(
      reference,
      referenceWidth,
      candidate,
      ALIGN_PATCH_WIDTH_PX,
      ALIGN_STRIP_HEIGHT_PX,
      ALIGN_SEARCH_RANGE_PX,
    )
    const correctionDeg = offsetPx / this.pxPerDeg
    return Math.max(
      -ALIGN_MAX_CORRECTION_DEG,
      Math.min(ALIGN_MAX_CORRECTION_DEG, correctionDeg),
    )
  }

  // `source` is a snapshot of one capture, already the still frame it'll stay as. `quaternion`
  // and `rawYawDeg` are the phone's facing direction and yaw at the moment it was taken, per the
  // orientation tracker -- rawYawDeg is passed separately rather than re-derived, since the
  // caller already has it from the same sample this quaternion came from
  addFrame(
    source: HTMLCanvasElement,
    quaternion: Quaternion,
    rawYawDeg: number,
  ) {
    const correctionDeg = this.hasFirstFrame
      ? this.measureYawCorrectionDeg(source, rawYawDeg)
      : 0
    const correctedQuaternion = correctionDeg
      ? new Quaternion()
          .setFromAxisAngle(WORLD_UP, correctionDeg * DEG2RAD)
          .multiply(quaternion)
      : quaternion
    const correctedYawDeg = rawYawDeg + correctionDeg

    const texture = new CanvasTexture(source)
    texture.flipY = false
    texture.minFilter = LinearFilter
    texture.magFilter = LinearFilter
    texture.wrapS = ClampToEdgeWrapping
    texture.wrapT = ClampToEdgeWrapping
    texture.needsUpdate = true

    const { tanHalfFovX, tanHalfFovY } = tanHalfFov(source.width, source.height)
    this.accumulateMaterial.uniforms.tCapture.value = texture
    this.accumulateMaterial.uniforms.uQuaternion.value =
      correctedQuaternion.toArray()
    this.accumulateMaterial.uniforms.uTanHalfFovX.value = tanHalfFovX
    this.accumulateMaterial.uniforms.uTanHalfFovY.value = tanHalfFovY

    this.quadMesh.material = this.accumulateMaterial
    this.renderer.setRenderTarget(this.accumTarget)
    this.renderer.render(this.quadScene, this.quadCamera)
    this.renderer.setRenderTarget(null)

    texture.dispose()

    if (!this.hasFirstFrame) {
      this.hasFirstFrame = true
      this.minYawDeg = correctedYawDeg
      this.maxYawDeg = correctedYawDeg
    } else {
      // unwrapped against the previous frame's yaw (not clamped to 0..360) so a sweep that
      // crosses the 0°/360° seam still grows min/max monotonically instead of snapping back
      const previousCenter = (this.minYawDeg + this.maxYawDeg) / 2
      const unwrapped =
        previousCenter + wrapDeltaDeg(correctedYawDeg - previousCenter)
      this.minYawDeg = Math.min(this.minYawDeg, unwrapped)
      this.maxYawDeg = Math.max(this.maxYawDeg, unwrapped)
    }

    this.renderPreview()
  }

  // total yaw actually swept so far, unwrapped (can exceed 360 if the sweep overlaps itself) --
  // used to drive the capture UI's progress bar and decide when a full loop has closed
  get sweptDeg() {
    return this.maxYawDeg - this.minYawDeg
  }

  // draws the current accumulated state (however partial) onto `this.canvas`, downscaled if it's
  // wider than the live preview needs -- called after every frame so the coverage strip stays
  // live, cheaply. Confirming brings it back to full resolution once, via renderFullPreview()
  renderPreview() {
    const scale = Math.min(1, LIVE_PREVIEW_MAX_WIDTH_PX / this.widthPx)
    this.quadMesh.material = this.normalizeMaterial
    this.renderer.setSize(
      Math.round(this.widthPx * scale),
      Math.round(this.heightPx * scale),
      false,
    )
    this.renderer.setRenderTarget(null)
    this.renderer.render(this.quadScene, this.quadCamera)
  }

  renderFullPreview() {
    this.quadMesh.material = this.normalizeMaterial
    this.renderer.setSize(this.widthPx, this.heightPx, false)
    this.renderer.setRenderTarget(null)
    this.renderer.render(this.quadScene, this.quadCamera)
  }

  // the crop actually worth exporting: the swept yaw range, plus a little padding so the
  // feathered edges of the first/last frame aren't cut off mid-fade. Clamped to the canvas since
  // a sweep past a full 360° loop would otherwise ask for a wider crop than exists
  private exportCropPx() {
    const paddingDeg = 4
    const startDeg = this.minYawDeg - paddingDeg
    const endDeg = Math.min(this.maxYawDeg + paddingDeg, startDeg + 360)
    const x = Math.max(0, Math.round((startDeg / 360) * this.pxPerDeg * 360))
    const width = Math.min(
      this.widthPx - x,
      Math.round(((endDeg - startDeg) / 360) * this.pxPerDeg * 360),
    )
    return { x, width }
  }

  async exportBlob(): Promise<Blob> {
    this.quadMesh.material = this.normalizeMaterial
    this.renderer.setRenderTarget(this.exportTarget)
    this.renderer.render(this.quadScene, this.quadCamera)

    const pixels = new Uint8Array(this.widthPx * this.heightPx * 4)
    this.renderer.readRenderTargetPixels(
      this.exportTarget,
      0,
      0,
      this.widthPx,
      this.heightPx,
      pixels,
    )
    this.renderer.setRenderTarget(null)

    // readRenderTargetPixels hands back row 0 as the bottom of the image, but a 2D canvas's
    // ImageData expects row 0 at the top -- the same top-down order the live preview already
    // shows. Flip it once here rather than getting it backwards in every consumer
    const flipped = new Uint8ClampedArray(pixels.length)
    const rowBytes = this.widthPx * 4
    for (let row = 0; row < this.heightPx; row++) {
      const sourceStart = row * rowBytes
      const destStart = (this.heightPx - 1 - row) * rowBytes
      flipped.set(
        pixels.subarray(sourceStart, sourceStart + rowBytes),
        destStart,
      )
    }

    const fullCanvas = document.createElement("canvas")
    fullCanvas.width = this.widthPx
    fullCanvas.height = this.heightPx
    const fullCtx = fullCanvas.getContext("2d")
    if (!fullCtx) throw new Error("Couldn't export the panorama.")
    fullCtx.putImageData(
      new ImageData(flipped, this.widthPx, this.heightPx),
      0,
      0,
    )

    const { x, width } = this.exportCropPx()
    const exportCanvas = document.createElement("canvas")
    exportCanvas.width = Math.max(1, width)
    exportCanvas.height = this.heightPx
    const ctx = exportCanvas.getContext("2d")
    if (!ctx) throw new Error("Couldn't export the panorama.")
    ctx.drawImage(
      fullCanvas,
      x,
      0,
      exportCanvas.width,
      this.heightPx,
      0,
      0,
      exportCanvas.width,
      this.heightPx,
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
