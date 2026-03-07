(function () {
  'use strict';

  // ── geometry helpers ─────────────────────────────────────────────────────────

  var TAU = Math.PI * 2;

  function drawFace(ctx, w, h, face) {
    face = face || {};
    var cx = w / 2;
    var cy = h / 2;
    var r  = Math.min(w, h) * 0.38;

    ctx.clearRect(0, 0, w, h);

    // skin
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fillStyle = '#f5c09a';
    ctx.fill();
    ctx.strokeStyle = '#d4956a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // eye parameters
    var blinkL = face.blinkL !== undefined ? face.blinkL : 1;
    var blinkR = face.blinkR !== undefined ? face.blinkR : 1;
    var gazeX  = face.gazeX  || 0;
    var gazeY  = face.gazeY  || 0;
    var yaw    = face.yaw    || 0;
    var pitch  = face.pitch  || 0;

    var eyeOffX = r * 0.3;
    var eyeOffY = r * 0.1;
    var eyeRx   = r * 0.18;
    var eyeRy   = r * 0.14;

    // head tilt shifts eye positions
    var tiltX = yaw   * r * 0.15;
    var tiltY = pitch * r * 0.10;

    drawEye(ctx, cx - eyeOffX + tiltX, cy - eyeOffY + tiltY, eyeRx, eyeRy, blinkL, gazeX, gazeY);
    drawEye(ctx, cx + eyeOffX + tiltX, cy - eyeOffY + tiltY, eyeRx, eyeRy, blinkR, gazeX, gazeY);

    // mouth
    var jawOpen = face.jawOpen || 0;
    var smile   = face.smile   || 0;
    drawMouth(ctx, cx + tiltX, cy + r * 0.38 + tiltY, r * 0.28, jawOpen, smile);
  }

  function drawEye(ctx, cx, cy, rx, ry, openness, gazeX, gazeY) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry * openness + 0.5, 0, 0, TAU);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (openness > 0.1) {
      // pupil — offset by gaze
      var px = cx + gazeX * rx * 0.5;
      var py = cy + gazeY * ry * 0.5;
      ctx.beginPath();
      ctx.arc(px, py, rx * 0.38, 0, TAU);
      ctx.fillStyle = '#2b2b2b';
      ctx.fill();
    }
    ctx.restore();
  }

  function drawMouth(ctx, cx, cy, hw, jawOpen, smile) {
    ctx.save();
    var openH = jawOpen * hw * 0.6 + 1;
    if (jawOpen > 0.05) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, hw, openH, 0, 0, TAU);
      ctx.fillStyle = '#b06060';
      ctx.fill();
    }
    // smile curve
    ctx.beginPath();
    ctx.moveTo(cx - hw, cy);
    var cpY = cy + (smile * 2 - 0.5) * hw * 0.6;
    ctx.quadraticCurveTo(cx, cpY, cx + hw, cy);
    ctx.strokeStyle = '#7a3030';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  // ── IRendererInstance ────────────────────────────────────────────────────────

  function createInstance() {
    var canvas   = null;
    var ctx      = null;
    var mounted  = false;
    var rafId    = null;
    var lastFace = null;

    function renderFrame() {
      if (!mounted || !ctx) return;
      drawFace(ctx, canvas.width, canvas.height, lastFace);
      rafId = null;
    }

    function scheduleRender() {
      if (rafId) return;
      rafId = requestAnimationFrame(renderFrame);
    }

    return {
      mount: function (container, opts) {
        opts = opts || {};
        canvas = document.createElement('canvas');
        canvas.width  = opts.width  || container.clientWidth  || 360;
        canvas.height = opts.height || container.clientHeight || 360;
        canvas.style.display = 'block';
        canvas.style.width   = '100%';
        canvas.style.height  = '100%';
        ctx = canvas.getContext('2d');
        container.appendChild(canvas);
        mounted = true;
        scheduleRender();
        return Promise.resolve();
      },

      update: function (mediaState) {
        if (!mounted) return;
        lastFace = (mediaState && mediaState.faceControl) || lastFace;
        scheduleRender();
      },

      unmount: function () {
        mounted = false;
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
        if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
        canvas = null;
        ctx    = null;
      },

      getState: function () {
        return { mounted: mounted, faceControl: lastFace };
      }
    };
  }

  // ── IRendererFactory ─────────────────────────────────────────────────────────

  var VectorRendererFactory = {
    // Fallback — always returns true; register last so higher-priority renderers win.
    canHandle: function (/* mediaState */) { return true; },
    createInstance: createInstance
  };

  window.OpenPersonaVectorRenderer = VectorRendererFactory;
})();
