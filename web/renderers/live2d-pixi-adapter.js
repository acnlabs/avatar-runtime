;(function () {
  'use strict';

  // ── Cached promise for the full lib-load chain ──────────────────────────────
  var LIBS_LOAD = null;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var existed = document.querySelector('script[data-openpersona-src="' + src + '"]');
      if (existed) {
        if (existed.dataset.opsLoaded) return resolve();
        if (existed.dataset.opsError)  return reject(new Error('Script load failed: ' + src));
        existed.addEventListener('load', resolve);
        existed.addEventListener('error', function () {
          reject(new Error('Script load failed: ' + src));
        });
        return;
      }
      var s = document.createElement('script');
      s.src = src;
      s.setAttribute('data-openpersona-src', src);
      s.onload = function () {
        s.dataset.opsLoaded = '1';
        resolve();
      };
      s.onerror = function () {
        s.dataset.opsError = '1';
        reject(new Error('Script load failed: ' + src));
      };
      document.head.appendChild(s);
    });
  }

  /**
   * Load dependency chain in strict order:
   *   live2d.min.js   (Cubism 2 SDK UMD runtime — sets window.Live2D, must be first)
   *   pixi.min.js     (Pixi.js v6)
   *   cubism2.min.js  (pixi-live2d-display cubism2 build — must be last)
   *
   * Returns Promise<PIXI> resolving to window.PIXI with PIXI.live2d attached.
   */
  function ensureLive2DLibs(vendorBase) {
    if (LIBS_LOAD) return LIBS_LOAD;
    var base = vendorBase || '/demo/vendor-dist';
    LIBS_LOAD = loadScript(base + '/live2d.min.js')
      .then(function () { return loadScript(base + '/pixi.min.js'); })
      .then(function () { return loadScript(base + '/cubism2.min.js'); })
      .then(function () {
        var P = window.PIXI;
        if (!P || !P.Application) throw new Error('PIXI runtime missing after script load');
        if (!P.live2d || !P.live2d.Live2DModel) throw new Error('pixi-live2d-display cubism2 missing after script load');
        return P;
      });
    return LIBS_LOAD;
  }

  // ── Utilities ────────────────────────────────────────────────────────────────

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, Number(v) || 0));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function applyDeadzone(v, zone) {
    var n = Number(v) || 0;
    var z = Math.max(0, Number(zone) || 0);
    if (Math.abs(n) <= z) return 0;
    return n > 0 ? n - z : n + z;
  }

  // ── Cubism 2 standard parameter IDs ─────────────────────────────────────────

  var PARAM = {
    ANGLE_X:      'PARAM_ANGLE_X',      // head yaw   -30..30
    ANGLE_Y:      'PARAM_ANGLE_Y',      // head pitch -30..30
    ANGLE_Z:      'PARAM_ANGLE_Z',      // head roll  -30..30
    EYE_L_OPEN:   'PARAM_EYE_L_OPEN',  // 0=closed  1=open
    EYE_R_OPEN:   'PARAM_EYE_R_OPEN',
    EYE_BALL_X:   'PARAM_EYE_BALL_X',  // -1..1
    EYE_BALL_Y:   'PARAM_EYE_BALL_Y',
    MOUTH_OPEN_Y: 'PARAM_MOUTH_OPEN_Y',// 0..1
    MOUTH_FORM:   'PARAM_MOUTH_FORM'   // -1=sad  1=happy
  };

  // ── Adapter factory ──────────────────────────────────────────────────────────

  function createAdapter(opts) {
    opts = opts || {};
    var mountEl      = opts.mountEl;
    var modelJsonUrl = opts.modelJsonUrl;
    var vendorBase   = opts.vendorBase  || '/demo/vendor-dist';
    var frameMode    = opts.frameMode   || 'upperBodyFocus';
    var viewport     = {
      width:  Number(opts.viewport && opts.viewport.width)  || 360,
      height: Number(opts.viewport && opts.viewport.height) || 360,
      dpr:    Number(opts.viewport && opts.viewport.dpr)    || window.devicePixelRatio || 1
    };

    var app       = null;
    var model     = null;
    var destroyed = false;
    var lastFace  = null;

    // Smooth faceControl state (blinkL/R: 1=open, 0=closed — inverse of input)
    var faceCurrent = { yaw: 0, pitch: 0, roll: 0, gazeX: 0, gazeY: 0, blinkL: 1, blinkR: 1, jawOpen: 0, smile: 0 };
    var faceTarget  = { yaw: 0, pitch: 0, roll: 0, gazeX: 0, gazeY: 0, blinkL: 1, blinkR: 1, jawOpen: 0, smile: 0 };

    if (!mountEl) return Promise.reject(new Error('mountEl is required'));
    if (!modelJsonUrl) return Promise.reject(new Error('modelJsonUrl is required'));

    // ── Layout ────────────────────────────────────────────────────────────────

    function applyLayout() {
      if (!app || !model) return;
      var viewW = Math.max(1, viewport.width);
      var viewH = Math.max(1, viewport.height);
      var dpr   = Math.max(1, viewport.dpr);

      app.renderer.resize(Math.round(viewW * dpr), Math.round(viewH * dpr));
      app.stage.scale.set(dpr, dpr);

      // Natural model canvas size (as defined in the .moc file).
      var mW = (model.internalModel && model.internalModel.originalWidth)  || model.width  || viewW;
      var mH = (model.internalModel && model.internalModel.originalHeight) || model.height || viewH;
      if (!mW || !mH) { mW = viewW; mH = viewH; }

      var scale;
      if (frameMode === 'upperBodyFocus') {
        // Show top 72 % of model height (head + torso), scaled to fill viewport width.
        var visibleH = mH * 0.72;
        scale = Math.min((viewW / mW), (viewH / visibleH)) * 0.97;
        // Anchor top-center; position so model top aligns with viewport top.
        model.anchor.set(0.5, 0);
        model.scale.set(scale);
        model.x = viewW / 2;
        model.y = -mH * scale * 0.03; // slight upward nudge to reduce top dead-space
      } else {
        // noCropContain: show full model, bottom-aligned.
        // We don't push the canvas — the full canvas stays inside the viewport
        // so nothing is clipped. A post-render scan (scheduleFootSnap) will then
        // shift the model up so the actual character feet land at the bottom edge.
        scale = Math.min((viewW / mW), (viewH / mH)) * 0.98;
        model.anchor.set(0.5, 1);
        model.scale.set(scale);
        model.x = viewW / 2;
        model.y = viewH - Math.round(viewH * 0.005); // canvas bottom ≈ viewport bottom
      }
    }

    // ── Public interface ──────────────────────────────────────────────────────

    function setViewport(vp) {
      if (!vp) return;
      if (vp.width  !== undefined) viewport.width  = Math.max(1, Number(vp.width)  || 1);
      if (vp.height !== undefined) viewport.height = Math.max(1, Number(vp.height) || 1);
      if (vp.dpr    !== undefined) viewport.dpr    = Math.max(1, Number(vp.dpr)    || 1);
      applyLayout();
      if (model && frameMode !== 'upperBodyFocus') scheduleFootSnap();
    }

    function setFrameMode(mode) {
      frameMode = (mode === 'upperBodyFocus') ? 'upperBodyFocus' : 'noCropContain';
      applyLayout();
      if (model && frameMode !== 'upperBodyFocus') scheduleFootSnap();
    }

    // No-op: Live2D pose is handled via faceControl parameters.
    function setPose() {}

    function applyFaceControl(faceControl) {
      if (!faceControl) return;
      lastFace = faceControl;
      var pose  = faceControl.pose  || {};
      var eyes  = faceControl.eyes  || {};
      var mouth = faceControl.mouth || {};

      faceTarget.yaw    = applyDeadzone(clamp(Number(pose.yaw)    || 0, -1,  1), 0.02);
      faceTarget.pitch  = applyDeadzone(clamp(Number(pose.pitch)  || 0, -1,  1), 0.02);
      faceTarget.roll   = applyDeadzone(clamp(Number(pose.roll)   || 0, -1,  1), 0.02);
      faceTarget.gazeX  = applyDeadzone(clamp(Number(eyes.gazeX)  || 0, -1,  1), 0.02);
      faceTarget.gazeY  = applyDeadzone(clamp(Number(eyes.gazeY)  || 0, -1,  1), 0.02);
      // Input: blinkL/R 0=open 1=closed → internal: 1=open 0=closed
      faceTarget.blinkL = 1 - clamp(Number(eyes.blinkL) || 0, 0, 1);
      faceTarget.blinkR = 1 - clamp(Number(eyes.blinkR) || 0, 0, 1);
      faceTarget.jawOpen = clamp(Number(mouth.jawOpen) || 0, 0, 1);
      faceTarget.smile   = clamp(Number(mouth.smile)   || 0, -1, 1);
    }

    function destroy() {
      destroyed = true;
      if (footSnapTimer) { clearTimeout(footSnapTimer); footSnapTimer = null; }
      try {
        if (model) { app && app.stage.removeChild(model); model.destroy(); }
        if (app)   { app.destroy(true, { children: true }); }
      } catch (_) {}
      app = model = null;
      try {
        while (mountEl && mountEl.firstChild) mountEl.removeChild(mountEl.firstChild);
      } catch (_) {}
    }

    // ── Foot snap (post-render detection) ────────────────────────────────────
    // After the model renders its first frames, scan the WebGL canvas bottom-up
    // to find the lowest non-transparent character pixel, then nudge model.y so
    // the feet land exactly at the viewport bottom. This avoids all dead-space
    // guesswork and works for any Live2D model.

    var footSnapTimer = null;

    function detectCharacterBottomCSS() {
      if (!app || !app.renderer) return null;
      try {
        // Use PIXI extract plugin if available.
        var extract = app.renderer.plugins && app.renderer.plugins.extract;
        if (extract) {
          var ec = extract.canvas(app.stage);
          var ctx = ec.getContext('2d');
          if (!ctx) return null;
          var w = ec.width, h = ec.height;
          var dpr = Math.max(1, viewport.dpr);
          for (var y = h - 1; y >= 0; y--) {
            var row = ctx.getImageData(Math.floor(w * 0.1), y, Math.floor(w * 0.8), 1).data;
            for (var i = 3; i < row.length; i += 4) {
              if (row[i] > 12) return y / dpr;
            }
          }
          return null;
        }

        // Fallback: read directly from WebGL context.
        // WebGL y=0 is at canvas BOTTOM (opposite of CSS).
        var gl = app.renderer.gl;
        if (!gl) return null;
        var cW = app.view.width, cH = app.view.height;
        var dprF = Math.max(1, viewport.dpr);
        var strip = Math.min(cW, 512);
        var offX  = Math.floor((cW - strip) / 2);
        var buf   = new Uint8Array(strip * 4);
        for (var gy = 0; gy < cH; gy++) {          // scan from GL bottom = CSS top-of-feet upward
          gl.readPixels(offX, gy, strip, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
          for (var xi = 3; xi < buf.length; xi += 4) {
            if (buf[xi] > 12) {
              // gy from GL bottom → CSS y from top = (cH - 1 - gy) / dpr
              return (cH - 1 - gy) / dprF;
            }
          }
        }
        return null;
      } catch (_) { return null; }
    }

    function snapFeetToBottom() {
      if (destroyed || !model || frameMode !== 'noCropContain') return;
      var charBottomCSS = detectCharacterBottomCSS();
      if (charBottomCSS === null) return;
      var viewH = Math.max(1, viewport.height);
      var targetBottom = viewH - Math.round(viewH * 0.008); // 0.8 % inset
      var delta = targetBottom - charBottomCSS;
      if (Math.abs(delta) > 1) model.y += delta;
    }

    function scheduleFootSnap() {
      if (footSnapTimer) clearTimeout(footSnapTimer);
      // Allow ~5 frames (≈83 ms at 60 fps) for the model to render before scanning.
      footSnapTimer = setTimeout(function () {
        footSnapTimer = null;
        snapFeetToBottom();
        // Second pass in case the first frame wasn't fully rendered.
        footSnapTimer = setTimeout(function () {
          footSnapTimer = null;
          snapFeetToBottom();
        }, 200);
      }, 120);
    }

    // ── Safe parameter setter ─────────────────────────────────────────────────

    function setParamSafe(name, value) {
      if (!model || !model.internalModel) return;
      try {
        var core = model.internalModel.coreModel;
        if (core && typeof core.setParamFloat === 'function') {
          core.setParamFloat(name, value);
        }
      } catch (_) {}
    }

    // ── Boot ──────────────────────────────────────────────────────────────────

    return ensureLive2DLibs(vendorBase).then(function (PIXI) {
      if (destroyed) throw new Error('adapter destroyed before load');
      var dpr   = Math.max(1, viewport.dpr);
      var viewW = Math.max(1, viewport.width);
      var viewH = Math.max(1, viewport.height);

      app = new PIXI.Application({
        width:           Math.round(viewW * dpr),
        height:          Math.round(viewH * dpr),
        backgroundAlpha: 0,
        antialias:       true,
        resolution:      1,
        autoDensity:     false
      });
      app.view.style.width   = '100%';
      app.view.style.height  = '100%';
      app.view.style.display = 'block';
      mountEl.innerHTML = '';
      mountEl.appendChild(app.view);

      // autoUpdate: false → we drive the model update manually in our ticker.
      return PIXI.live2d.Live2DModel.from(modelJsonUrl, { autoUpdate: false }).then(function (live2dModel) {
        if (destroyed) throw new Error('adapter destroyed after model load');
        model = live2dModel;
        app.stage.addChild(model);
        applyLayout();

        // After a few rendered frames, snap the character feet to the viewport bottom.
        scheduleFootSnap();

        // Kick off the idle motion loop.
        try {
          var priority = (PIXI.live2d.MotionPriority && PIXI.live2d.MotionPriority.IDLE) || 1;
          model.motion('idle', 0, priority);
        } catch (_) {}

        // ── Per-frame ticker ─────────────────────────────────────────────────
        app.ticker.add(function () {
          if (!model || destroyed) return;

          // 1. Lerp faceControl parameters towards targets.
          var k  = 0.18;  // head / gaze smoothing factor
          var kb = 0.35;  // blink (faster for natural feel)
          faceCurrent.yaw    = lerp(faceCurrent.yaw,    faceTarget.yaw,    k);
          faceCurrent.pitch  = lerp(faceCurrent.pitch,  faceTarget.pitch,  k);
          faceCurrent.roll   = lerp(faceCurrent.roll,   faceTarget.roll,   k);
          faceCurrent.gazeX  = lerp(faceCurrent.gazeX,  faceTarget.gazeX,  k);
          faceCurrent.gazeY  = lerp(faceCurrent.gazeY,  faceTarget.gazeY,  k);
          faceCurrent.blinkL = lerp(faceCurrent.blinkL, faceTarget.blinkL, kb);
          faceCurrent.blinkR = lerp(faceCurrent.blinkR, faceTarget.blinkR, kb);
          faceCurrent.jawOpen = lerp(faceCurrent.jawOpen, faceTarget.jawOpen, k);
          faceCurrent.smile   = lerp(faceCurrent.smile,   faceTarget.smile,   k);

          // 2. Run model update (processes idle motion + physics).
          try { model.update(app.ticker.deltaMS); } catch (_) {}

          // 3. Override face parameters AFTER motion so our values take precedence.
          //    Cubism 2 angle range: -30..30; eye open: 0..1; eyeball: -1..1.
          setParamSafe(PARAM.ANGLE_X,      faceCurrent.yaw    * 30);
          setParamSafe(PARAM.ANGLE_Y,      faceCurrent.pitch  * 30);
          setParamSafe(PARAM.ANGLE_Z,      faceCurrent.roll   * 30);
          setParamSafe(PARAM.EYE_BALL_X,   faceCurrent.gazeX);
          setParamSafe(PARAM.EYE_BALL_Y,   faceCurrent.gazeY);
          setParamSafe(PARAM.EYE_L_OPEN,   faceCurrent.blinkL);
          setParamSafe(PARAM.EYE_R_OPEN,   faceCurrent.blinkR);
          setParamSafe(PARAM.MOUTH_OPEN_Y, faceCurrent.jawOpen);
          setParamSafe(PARAM.MOUTH_FORM,   faceCurrent.smile);

          // 4. Re-bake geometry so face overrides are visible in this frame.
          try {
            var core = model.internalModel && model.internalModel.coreModel;
            if (core && typeof core.update === 'function') core.update();
          } catch (_) {}
        });

        return {
          kind:             'pixi-live2d',
          setViewport:      setViewport,
          setFrameMode:     setFrameMode,
          setPose:          setPose,
          applyFaceControl: applyFaceControl,
          destroy:          destroy,
          getState: function () {
            return {
              ready:       !!model,
              frameMode:   frameMode,
              faceControl: lastFace
            };
          }
        };
      });
    });
  }

  // ── IRendererFactory integration ─────────────────────────────────────────────

  function canHandle(mediaState) {
    var url = String((mediaState || {}).avatarModel3Url || '');
    return url.length > 0 &&
      (url.indexOf('.model.json') !== -1 || url.indexOf('.model3.json') !== -1);
  }

  window.OpenPersonaPixiLive2DAdapter = {
    create: createAdapter,   // backward-compatible entry point
    canHandle: canHandle,

    factory: {               // IRendererFactory
      canHandle: canHandle,
      createInstance: function () {
        var adapter = null;
        return {
          mount: function (container, opts) {
            var modelUrl = (opts && (opts.modelJsonUrl || opts.avatarModel3Url)) || '';
            return createAdapter(Object.assign({ mountEl: container }, opts || {}, { modelJsonUrl: modelUrl }))
              .then(function (a) { adapter = a; });
          },
          update: function (mediaState) {
            if (!adapter) return;
            if (mediaState && mediaState.faceControl) adapter.applyFaceControl(mediaState.faceControl);
          },
          unmount: function () {
            if (adapter) { try { adapter.destroy(); } catch (_) {} adapter = null; }
          },
          getState: function () { return adapter ? adapter.getState() : null; }
        };
      }
    }
  };
})();
