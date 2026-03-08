/**
 * vrm-renderer.js — IRendererFactory for VRM 3D avatars.
 *
 * Loads a .vrm model via Three.js + @pixiv/three-vrm using dynamic ES module
 * imports from esm.sh (no bundler required). Supports both VRM 0.x and VRM 1.0.
 *
 * canHandle: returns true when mediaState contains avatarModelVrmUrl.
 *
 * control.avatar.face parameter mapping:
 *   pose.yaw / pitch / roll → head bone rotation (Euler, radians scaled from -1..1)
 *   eyes.blinkL / blinkR    → eye close blend shape (1=open, 0=closed in control space)
 *   eyes.gazeX / gazeY      → eye bone rotation
 *   mouth.jawOpen           → mouth open blend shape
 *   mouth.smile             → joy/happy blend shape
 */

/* global window, document, requestAnimationFrame, cancelAnimationFrame */

(function (global) {
  'use strict';

  var THREE_CDN      = 'https://esm.sh/three@0.175.0';
  var GLTF_CDN       = 'https://esm.sh/three@0.175.0/examples/jsm/loaders/GLTFLoader';
  var THREE_VRM_CDN  = 'https://esm.sh/@pixiv/three-vrm@2.1.2?deps=three@0.175.0';

  // ── face → VRM blend shape name maps ──────────────────────────────────────

  // VRM 0.x uses uppercase BlendShapeProxy preset names.
  var BLEND_MAP_V0 = {
    blinkL:  'BLINK_L',
    blinkR:  'BLINK_R',
    jawOpen: 'A',
    smile:   'JOY',
    angry:   'ANGRY',
    sad:     'SORROW',
  };

  // VRM 1.0 uses lowercase ExpressionManager preset names.
  var BLEND_MAP_V1 = {
    blinkL:  'blinkLeft',
    blinkR:  'blinkRight',
    jawOpen: 'aa',
    smile:   'happy',
    angry:   'angry',
    sad:     'sad',
  };

  // emotion.label → VRM expression name maps.
  // applyEmotionControl runs AFTER applyFaceControl — emotion wins for expression presets.
  // Agents should use face.mouth.smile OR emotion.label for smile, not both simultaneously.
  var EMOTION_MAP_V1 = {
    happy:     'happy',
    joy:       'happy',
    sad:       'sad',
    sorrow:    'sad',
    angry:     'angry',
    anger:     'angry',
    surprised: 'surprised',
    surprise:  'surprised',
    relaxed:   'relaxed',
    calm:      'relaxed',
  };

  var EMOTION_MAP_V0 = {
    happy:     'JOY',
    joy:       'JOY',
    sad:       'SORROW',
    sorrow:    'SORROW',
    angry:     'ANGRY',
    anger:     'ANGRY',
    // 'surprised' may not exist in all VRM 0.x models — set safely
    surprised: 'SURPRISED',
    surprise:  'SURPRISED',
    relaxed:   'FUN',
    calm:      'FUN',
  };

  // All expression names managed by applyEmotionControl (to clear on neutral).
  var EMOTION_EXPRS_V1 = ['happy', 'sad', 'angry', 'surprised', 'relaxed'];
  var EMOTION_EXPRS_V0 = ['JOY', 'SORROW', 'ANGRY', 'SURPRISED', 'FUN'];

  // Head bone euler scale: face values are in -1..1, map to radians.
  var HEAD_YAW_SCALE   =  0.5;
  var HEAD_PITCH_SCALE = -0.4;
  var HEAD_ROLL_SCALE  = -0.3;
  var EYE_GAZE_SCALE   =  0.5;

  // VRM humanoid bone names for body control skeleton keys
  var BODY_BONE_MAP = {
    hips:          'hips',
    spine:         'spine',
    chest:         'chest',
    neck:          'neck',
    leftUpperArm:  'leftUpperArm',
    leftLowerArm:  'leftLowerArm',
    rightUpperArm: 'rightUpperArm',
    rightLowerArm: 'rightLowerArm',
    leftUpperLeg:  'leftUpperLeg',
    rightUpperLeg: 'rightUpperLeg',
  };

  // ── Dynamic dependency loading ──────────────────────────────────────────────

  var _depsPromise = null;

  function loadDeps() {
    if (_depsPromise) return _depsPromise;
    _depsPromise = import(THREE_CDN)
      .then(function (threeModule) {
        return import(GLTF_CDN).then(function (gltfModule) {
          return import(THREE_VRM_CDN).then(function (vrmModule) {
            return { THREE: threeModule, GLTFLoader: gltfModule.GLTFLoader, VRM: vrmModule };
          });
        });
      })
      .catch(function (err) {
        _depsPromise = null; // reset so retry is possible
        return Promise.reject(err);
      });
    return _depsPromise;
  }

  // ── VRM apply helpers ───────────────────────────────────────────────────────

  // Flatten control.avatar.face (nested) to a working flat object.
  function normalizeFace(face) {
    if (!face) return {};
    var pose  = face.pose  || {};
    var eyes  = face.eyes  || {};
    var mouth = face.mouth || {};
    return {
      yaw:     pose.yaw    != null ? pose.yaw    : 0,
      pitch:   pose.pitch  != null ? pose.pitch  : 0,
      roll:    pose.roll   != null ? pose.roll   : 0,
      blinkL:  eyes.blinkL != null ? eyes.blinkL : 1,
      blinkR:  eyes.blinkR != null ? eyes.blinkR : 1,
      gazeX:   eyes.gazeX  != null ? eyes.gazeX  : 0,
      gazeY:   eyes.gazeY  != null ? eyes.gazeY  : 0,
      jawOpen: mouth.jawOpen != null ? mouth.jawOpen : 0,
      smile:   mouth.smile   != null ? mouth.smile   : 0,
    };
  }

  function applyFaceControl(vrm, face, THREE) {
    if (!vrm || !face) return;

    var f = normalizeFace(face);
    var isV1 = vrm.expressionManager != null;
    var blendMap = isV1 ? BLEND_MAP_V1 : BLEND_MAP_V0;

    // Blend shapes / expressions
    var fcMap = { blinkL: f.blinkL, blinkR: f.blinkR, jawOpen: f.jawOpen, smile: f.smile };
    var keys = Object.keys(blendMap);
    for (var i = 0; i < keys.length; i++) {
      var fcKey = keys[i];
      var vrmKey = blendMap[fcKey];
      var val = fcMap[fcKey];
      if (val == null) continue;

      // blinkL/blinkR: control 1=open, VRM 1=closed → invert
      if (fcKey === 'blinkL' || fcKey === 'blinkR') val = 1 - val;

      if (isV1) {
        vrm.expressionManager.setValue(vrmKey, val);
      } else if (vrm.blendShapeProxy) {
        vrm.blendShapeProxy.setValue(vrmKey, val);
      }
    }

    // Head bone rotation
    var head = vrm.humanoid && vrm.humanoid.getNormalizedBoneNode('head');
    if (head) {
      var q = new THREE.Quaternion();
      q.setFromEuler(new THREE.Euler(
        f.pitch * HEAD_PITCH_SCALE,
        f.yaw   * HEAD_YAW_SCALE,
        f.roll  * HEAD_ROLL_SCALE,
        'YXZ'
      ));
      head.quaternion.slerp(q, 0.15);
    }

    // Eye gaze bones
    var leftEye  = vrm.humanoid && vrm.humanoid.getNormalizedBoneNode('leftEye');
    var rightEye = vrm.humanoid && vrm.humanoid.getNormalizedBoneNode('rightEye');
    if (leftEye && rightEye) {
      var eyeQ = new THREE.Quaternion();
      eyeQ.setFromEuler(new THREE.Euler(
        -f.gazeY * EYE_GAZE_SCALE,
         f.gazeX * EYE_GAZE_SCALE,
        0, 'YXZ'
      ));
      leftEye.quaternion.copy(eyeQ);
      rightEye.quaternion.copy(eyeQ);
    }

    // Commit VRM 0.x blend shapes
    if (!isV1 && vrm.blendShapeProxy) {
      vrm.blendShapeProxy.update();
    }
  }

  function applyBodyControl(vrm, body, THREE) {
    if (!vrm || !body) return;
    var skeleton = body.skeleton || {};
    var boneKeys = Object.keys(BODY_BONE_MAP);
    for (var i = 0; i < boneKeys.length; i++) {
      var ck = boneKeys[i];
      var vk = BODY_BONE_MAP[ck];
      var rot = skeleton[ck];
      if (!rot) continue;
      var bone = vrm.humanoid && vrm.humanoid.getNormalizedBoneNode(vk);
      if (!bone) continue;
      var q = new THREE.Quaternion();
      q.setFromEuler(new THREE.Euler(
        (rot.x || 0) * Math.PI / 180,
        (rot.y || 0) * Math.PI / 180,
        (rot.z || 0) * Math.PI / 180,
        'YXZ'
      ));
      bone.quaternion.slerp(q, 0.12);
    }
  }

  // Apply emotion.label as a VRM expression preset.
  // Runs AFTER applyFaceControl so emotion overrides the expression layer.
  // 'neutral' clears all managed emotion expressions.
  function applyEmotionControl(vrm, emotion) {
    if (!vrm || !emotion) return;
    var label     = String(emotion.label || 'neutral').toLowerCase();
    var intensity = emotion.intensity != null
      ? Math.max(0, Math.min(1, Number(emotion.intensity)))
      : 0.5;

    var isV1       = vrm.expressionManager != null;
    var emotionMap = isV1 ? EMOTION_MAP_V1 : EMOTION_MAP_V0;
    var allExprs   = isV1 ? EMOTION_EXPRS_V1 : EMOTION_EXPRS_V0;

    function setExpr(name, val) {
      if (isV1) {
        vrm.expressionManager.setValue(name, val);
      } else if (vrm.blendShapeProxy) {
        try { vrm.blendShapeProxy.setValue(name, val); } catch (e) { /* preset may not exist */ }
      }
    }

    // Clear all managed emotion expressions first
    for (var i = 0; i < allExprs.length; i++) {
      setExpr(allExprs[i], 0);
    }

    // Apply the requested expression (neutral stays cleared)
    var vrmExpr = emotionMap[label];
    if (vrmExpr) setExpr(vrmExpr, intensity);

    // Commit VRM 0.x blend shapes
    if (!isV1 && vrm.blendShapeProxy) vrm.blendShapeProxy.update();
  }

  // ── Renderer instance factory ───────────────────────────────────────────────

  function createInstance() {
    var _three        = null;
    var _vrm          = null;
    var _scene        = null;
    var _camera       = null;
    var _renderer     = null;
    var _rafId        = null;
    var _mounted      = false;
    var _lastFace     = null;
    var _container    = null;
    var _resizeObserver = null;
    var _ambientLight = null;
    var _dirLight     = null;

    function startLoop() {
      var clock = _three ? new _three.Clock() : null;
      function tick() {
        if (!_mounted) return;
        _rafId = requestAnimationFrame(tick);
        var delta = clock ? clock.getDelta() : 0.016;
        if (_vrm) _vrm.update(delta);
        if (_renderer && _scene && _camera) {
          _renderer.render(_scene, _camera);
        }
      }
      tick();
    }

    function stopLoop() {
      if (_rafId != null) { cancelAnimationFrame(_rafId); _rafId = null; }
    }

    function setupScene(THREE, container) {
      var w = container.clientWidth  || 360;
      var h = container.clientHeight || 360;

      _scene = new THREE.Scene();

      _camera = new THREE.PerspectiveCamera(30, w / h, 0.1, 20);
      _camera.position.set(0, 1.4, 1.8);
      _camera.lookAt(0, 1.2, 0);

      _renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      _renderer.setSize(w, h);
      _renderer.setPixelRatio(window.devicePixelRatio || 1);
      _renderer.outputColorSpace = THREE.SRGBColorSpace;
      container.appendChild(_renderer.domElement);

      // Lighting — stored as closure refs so applySceneControl can update them
      _ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      _scene.add(_ambientLight);
      _dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
      _dirLight.position.set(1, 2, 2);
      _scene.add(_dirLight);

      // Resize observer — stored so unmount() can disconnect it
      if (typeof ResizeObserver !== 'undefined') {
        _resizeObserver = new ResizeObserver(function () {
          if (!_renderer) return;
          var nw = container.clientWidth  || 360;
          var nh = container.clientHeight || 360;
          _camera.aspect = nw / nh;
          _camera.updateProjectionMatrix();
          _renderer.setSize(nw, nh);
        });
        _resizeObserver.observe(container);
      }
    }

    function applySceneControl(scene, THREE) {
      if (!scene) return;
      var cam   = scene.camera || {};
      var world = scene.world  || {};
      var kl    = world.keyLight || {};

      // Camera position / target / fov
      if (_camera) {
        var cp = cam.position || {};
        var ct = cam.target   || {};
        if (cp.x != null) _camera.position.set(cp.x, cp.y != null ? cp.y : _camera.position.y, cp.z != null ? cp.z : _camera.position.z);
        if (ct.x != null) _camera.lookAt(ct.x, ct.y != null ? ct.y : 0, ct.z != null ? ct.z : 0);
        if (cam.fov != null) { _camera.fov = cam.fov; _camera.updateProjectionMatrix(); }
      }

      // Ambient light
      if (_ambientLight && world.ambientLight != null) {
        _ambientLight.intensity = world.ambientLight;
      }

      // Key (directional) light
      if (_dirLight) {
        if (kl.intensity != null) _dirLight.intensity = kl.intensity;
        if (kl.direction) {
          var d = kl.direction;
          if (d.x != null) _dirLight.position.set(d.x, d.y != null ? d.y : _dirLight.position.y, d.z != null ? d.z : _dirLight.position.z);
        }
      }

      // Background color
      if (_scene && world.background) {
        try { _scene.background = new THREE.Color(world.background); } catch (e) { /* ignore invalid color */ }
      }
    }

    function loadVRM(GLTFLoader, VRM, modelUrl) {
      var loader = new GLTFLoader();
      loader.register(function (parser) {
        return new VRM.VRMLoaderPlugin(parser);
      });
      return new Promise(function (resolve, reject) {
        loader.load(
          modelUrl,
          function (gltf) {
            var loaded = gltf.userData.vrm;
            if (!loaded) return reject(new Error('[VRMRenderer] no VRM in GLTF'));
            if (VRM.VRMUtils.removeUnnecessaryVertices) {
              VRM.VRMUtils.removeUnnecessaryVertices(gltf.scene);
            }
            if (typeof VRM.VRMUtils.combineSkeletons === 'function') {
              VRM.VRMUtils.combineSkeletons(gltf.scene);
            } else if (typeof VRM.VRMUtils.removeUnnecessaryJoints === 'function') {
              VRM.VRMUtils.removeUnnecessaryJoints(gltf.scene);
            }
            if (typeof VRM.VRMUtils.rotateVRM0 === 'function') {
              VRM.VRMUtils.rotateVRM0(loaded);
            }
            _scene.add(loaded.scene);
            resolve(loaded);
          },
          undefined,
          reject
        );
      });
    }

    return {
      mount: function (container, opts) {
        opts = opts || {};
        _container = container;
        var modelUrl = opts.avatarModelVrmUrl || opts.modelUrl || '';

        return loadDeps().then(function (deps) {
          var THREE = deps.THREE;
          var VRM   = deps.VRM;
          _three = THREE;

          setupScene(THREE, container);

          // Apply initial scene control if provided
          var initControl = opts.control || {};
          if (initControl.scene) applySceneControl(initControl.scene, _three);

          if (!modelUrl) {
            _mounted = true;
            startLoop();
            return;
          }

          return loadVRM(deps.GLTFLoader, VRM, modelUrl).then(function (loaded) {
            _vrm     = loaded;
            _mounted = true;
            if (_lastFace) applyFaceControl(_vrm, _lastFace, _three);
            var initAv = (opts.control || {}).avatar || {};
            if (initAv.emotion) applyEmotionControl(_vrm, initAv.emotion);
            startLoop();
          });
        });
      },

      update: function (mediaState) {
        if (!mediaState) return;
        var ctrl = mediaState.control || {};
        var av   = ctrl.avatar || {};

        // Face (mechanical: blink, gaze, jawOpen, smile)
        var face = av.face;
        if (face) {
          _lastFace = face;
          if (_vrm && _three) applyFaceControl(_vrm, face, _three);
        }

        // Emotion (expression preset overlay — runs after face so it wins)
        if (av.emotion && _vrm) applyEmotionControl(_vrm, av.emotion);

        // Body
        if (av.body && _vrm && _three) {
          applyBodyControl(_vrm, av.body, _three);
        }

        // Scene
        if (ctrl.scene && _three) {
          applySceneControl(ctrl.scene, _three);
        }
      },

      unmount: function () {
        _mounted = false;
        stopLoop();
        if (_resizeObserver) { _resizeObserver.disconnect(); _resizeObserver = null; }
        if (_vrm) {
          if (_scene) _scene.remove(_vrm.scene);
          _vrm = null;
        }
        if (_renderer) {
          _renderer.dispose();
          if (_renderer.domElement && _renderer.domElement.parentNode) {
            _renderer.domElement.parentNode.removeChild(_renderer.domElement);
          }
          _renderer = null;
        }
        _scene = _camera = _three = _lastFace = _container = null;
        _ambientLight = _dirLight = null;
      },
    };
  }

  // ── IRendererFactory ────────────────────────────────────────────────────────

  var VRMRenderer = {
    canHandle: function (mediaState) {
      return !!(mediaState && mediaState.avatarModelVrmUrl != null);
    },
    createInstance: createInstance,
  };

  global.OpenPersonaVRMRenderer = VRMRenderer;
}(typeof window !== 'undefined' ? window : this));
