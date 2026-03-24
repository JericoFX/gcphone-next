/**
 * GameRender — Renders the FiveM game view into an HTML <canvas> element
 * with real-time post-processing (blur, brightness, contrast, color grading)
 * and video recording support.
 *
 * Based on:
 *  - citizenfx/fivem cfx-ui app.component.ts (createGameView)
 *    https://github.com/citizenfx/fivem/blob/538f9cc/ext/cfx-ui/src/app/app.component.ts#L50-L71
 *  - liquiad's React adaptation
 *    https://gist.github.com/liquiad/f4952575cbff31f923d19b342b4d25f8
 *
 * Uses the CfxTexture WebGL hook — a special texParameterf sequence on
 * TEXTURE_WRAP_T that tells the FiveM NUI runtime to bind the live game
 * render target to a standard WebGL texture.  No external dependencies.
 */

// ── GLSL Shaders ────────────────────────────────────────

const VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec2 a_texcoord;
varying vec2 v_uv;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_uv = a_texcoord;
}`;

const FRAGMENT_SHADER = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D external_texture;
uniform float u_blur;        // 0.0 - 1.0
uniform float u_brightness;  // default 1.0
uniform float u_contrast;    // default 1.0
uniform float u_saturation;  // default 1.0, 0=gray, >1=vivid
uniform float u_temperature; // -1.0 cool/blue .. +1.0 warm/orange
uniform float u_vignette;    // 0.0=off, 1.0=strong
uniform int u_effect;        // 0=normal 1=noir 2=vivid 3=warm
uniform vec2 u_resolution;   // canvas width, height

void main() {
  // ── 9-tap box blur ──
  vec2 texel = u_blur * 3.0 / u_resolution;
  vec4 color = vec4(0.0);
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      color += texture2D(external_texture, v_uv + vec2(float(x), float(y)) * texel);
    }
  }
  color /= 9.0;

  // ── Brightness ──
  color.rgb *= u_brightness;

  // ── Contrast ──
  color.rgb = (color.rgb - 0.5) * u_contrast + 0.5;

  // ── Saturation ──
  float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  color.rgb = mix(vec3(lum), color.rgb, u_saturation);

  // ── Temperature ──
  color.r += u_temperature * 0.1;
  color.b -= u_temperature * 0.1;

  // ── Color grading ──
  if (u_effect == 1) {
    // Noir — desaturate + slight contrast boost
    float lumNoir = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = vec3(lumNoir) * 1.08;
  } else if (u_effect == 2) {
    // Vivid — extra saturation boost
    float lumVivid = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(vec3(lumVivid), color.rgb, 1.4) * 1.05;
  } else if (u_effect == 3) {
    // Warm — shift to warm tones
    color.rgb = mix(color.rgb, color.rgb * vec3(1.15, 1.05, 0.85), 0.5);
  }

  // ── Vignette ──
  float dist = distance(v_uv, vec2(0.5));
  color.rgb *= 1.0 - u_vignette * smoothstep(0.3, 0.85, dist);

  color.rgb = clamp(color.rgb, 0.0, 1.0);
  gl_FragColor = vec4(color.rgb, 1.0);
}`;

// ── Helpers ─────────────────────────────────────────────

function makeShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Could not create shader');
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error('Shader compile error: ' + log);
  }
  return shader;
}

function createTexture(gl: WebGLRenderingContext): WebGLTexture {
  const tex = gl.createTexture();
  if (!tex) throw new Error('Could not create texture');

  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 255, 255]));

  gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);

  // CfxTexture magic hook sequence
  gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
  gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return tex;
}

function createBuffers(gl: WebGLRenderingContext) {
  const vertexBuff = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuff);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  const texBuff = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texBuff);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);

  return { vertexBuff, texBuff };
}

function compileProgram(gl: WebGLRenderingContext) {
  const vs = makeShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fs = makeShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);

  const program = gl.createProgram();
  if (!program) throw new Error('Could not create program');

  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error('Program link error: ' + gl.getProgramInfoLog(program));
  }

  gl.useProgram(program);

  return {
    program,
    vloc: gl.getAttribLocation(program, 'a_position'),
    tloc: gl.getAttribLocation(program, 'a_texcoord'),
    uBlur: gl.getUniformLocation(program, 'u_blur'),
    uBrightness: gl.getUniformLocation(program, 'u_brightness'),
    uContrast: gl.getUniformLocation(program, 'u_contrast'),
    uSaturation: gl.getUniformLocation(program, 'u_saturation'),
    uTemperature: gl.getUniformLocation(program, 'u_temperature'),
    uVignette: gl.getUniformLocation(program, 'u_vignette'),
    uEffect: gl.getUniformLocation(program, 'u_effect'),
    uResolution: gl.getUniformLocation(program, 'u_resolution'),
  };
}

// ── Public API ──────────────────────────────────────────

export interface GameView {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  animationFrame: number | undefined;
  resize: (width: number, height: number) => void;
  pause: () => void;
  resume: () => void;
  destroy: () => void;
  setBlur: (value: number) => void;
  setBrightness: (value: number) => void;
  setContrast: (value: number) => void;
  setSaturation: (value: number) => void;
  setTemperature: (value: number) => void;
  setVignette: (value: number) => void;
  setEffect: (effectId: number) => void;
  startRecording: (onComplete: (blob: Blob, durationMs: number) => void, fps?: number) => Promise<void>;
  stopRecording: () => void;
  recording: () => boolean;
}

export function createGameView(canvas: HTMLCanvasElement): GameView {
  const gl = canvas.getContext('webgl', {
    antialias: false,
    depth: false,
    stencil: false,
    alpha: false,
    desynchronized: false,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
    failIfMajorPerformanceCaveat: false,
  }) as WebGLRenderingContext;

  if (!gl) throw new Error('Could not get WebGL context');

  let paused = false;
  let recorder: MediaRecorder | null = null;
  let recordStartTime = 0;

  // Setup
  const tex = createTexture(gl);
  const { program, vloc, tloc, uBlur, uBrightness, uContrast, uSaturation, uTemperature, uVignette, uEffect, uResolution } = compileProgram(gl);
  const { vertexBuff, texBuff } = createBuffers(gl);

  gl.useProgram(program);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.uniform1i(gl.getUniformLocation(program, 'external_texture'), 0);

  // Default uniforms
  gl.uniform1f(uBlur, 0.0);
  gl.uniform1f(uBrightness, 1.0);
  gl.uniform1f(uContrast, 1.0);
  gl.uniform1f(uSaturation, 1.0);
  gl.uniform1f(uTemperature, 0.0);
  gl.uniform1f(uVignette, 0.0);
  gl.uniform1i(uEffect, 0);
  gl.uniform2f(uResolution, canvas.width || window.innerWidth, canvas.height || window.innerHeight);

  // Attributes
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuff);
  gl.vertexAttribPointer(vloc, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(vloc);

  gl.bindBuffer(gl.ARRAY_BUFFER, texBuff);
  gl.vertexAttribPointer(tloc, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(tloc);

  gl.viewport(0, 0, canvas.width, canvas.height);

  // ── Render loop ──
  function render() {
    if (paused) return;
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.finish();
    gameView.animationFrame = requestAnimationFrame(render);
  }

  // ── GameView object ──
  const gameView: GameView = {
    canvas,
    gl,
    animationFrame: undefined,

    resize(width: number, height: number) {
      gl.viewport(0, 0, width, height);
      gl.canvas.width = width;
      gl.canvas.height = height;
      gl.uniform2f(uResolution, width, height);
    },

    pause() {
      paused = true;
      if (gameView.animationFrame != null) {
        cancelAnimationFrame(gameView.animationFrame);
        gameView.animationFrame = undefined;
      }
    },

    resume() {
      if (!paused) return;
      paused = false;
      gameView.animationFrame = requestAnimationFrame(render);
    },

    destroy() {
      gameView.pause();
      if (recorder && recorder.state === 'recording') {
        recorder.stop();
        recorder = null;
      }
      const ext = gl.getExtension('WEBGL_lose_context');
      ext?.loseContext();
    },

    // ── Shader uniform setters ──
    setBlur(value: number) {
      gl.uniform1f(uBlur, Math.max(0, Math.min(1, value)));
    },

    setBrightness(value: number) {
      gl.uniform1f(uBrightness, Math.max(0, Math.min(2, value)));
    },

    setContrast(value: number) {
      gl.uniform1f(uContrast, Math.max(0, Math.min(2, value)));
    },

    setSaturation(value: number) {
      gl.uniform1f(uSaturation, Math.max(0, Math.min(3, value)));
    },

    setTemperature(value: number) {
      gl.uniform1f(uTemperature, Math.max(-1, Math.min(1, value)));
    },

    setVignette(value: number) {
      gl.uniform1f(uVignette, Math.max(0, Math.min(1, value)));
    },

    setEffect(effectId: number) {
      gl.uniform1i(uEffect, effectId);
    },

    // ── Video recording ──
    recording() {
      return recorder != null && recorder.state === 'recording';
    },

    async startRecording(onComplete, fps = 30) {
      if (recorder) return;

      const videoStream = canvas.captureStream(fps);

      // Try to capture microphone audio
      let audioStream: MediaStream | null = null;
      try {
        audioStream = await navigator.mediaDevices.getUserMedia({
          audio: { autoGainControl: false, noiseSuppression: false, echoCancellation: false },
        });
      } catch {
        // No mic available — record video only
      }

      // Combine video + audio into one stream
      const tracks = [...videoStream.getVideoTracks()];
      if (audioStream) {
        tracks.push(...audioStream.getAudioTracks());
      }
      const combined = new MediaStream(tracks);

      const chunks: Blob[] = [];
      const mimeType = audioStream ? 'video/webm;codecs=vp9,opus' : 'video/webm;codecs=vp9';

      recorder = new MediaRecorder(combined, {
        mimeType,
        videoBitsPerSecond: 4_000_000,
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const duration = Date.now() - recordStartTime;
        const blob = new Blob(chunks, { type: 'video/webm' });
        recorder = null;
        // Stop mic tracks
        if (audioStream) {
          audioStream.getTracks().forEach((t) => t.stop());
        }
        onComplete(blob, duration);
      };

      recordStartTime = Date.now();
      recorder.start(100);
    },

    stopRecording() {
      if (recorder && recorder.state === 'recording') {
        recorder.stop();
      }
    },
  };

  gameView.animationFrame = requestAnimationFrame(render);

  return gameView;
}
