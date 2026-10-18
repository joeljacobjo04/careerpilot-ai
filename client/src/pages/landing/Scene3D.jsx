import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Hero scene: a glowing "readiness core" with orbit rings and skill nodes,
 * and a paper plane (the pilot) circling it and leaving a light trail.
 * Pauses when off screen or when the tab is hidden, and draws one still frame for reduced-motion users.
 */
export default function Scene3D({ onFail }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      onFail?.();
      return undefined;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = window.matchMedia("(max-width: 767px)").matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.cssText = "width:100%;height:100%;display:block;touch-action:pan-y";
    renderer.domElement.setAttribute("aria-hidden", "true");
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    const root = new THREE.Group();
    scene.add(root);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(3, 4, 5);
    scene.add(key);
    const fill = new THREE.PointLight(0x4ade80, 40, 20);
    fill.position.set(-4, -2, 3);
    scene.add(fill);

    // ---- core: solid faceted shape + wireframe shell + soft glow ----
    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.1, 1),
      new THREE.MeshStandardMaterial({ color: 0x16a34a, flatShading: true, metalness: 0.25, roughness: 0.35, emissive: 0x064e23, emissiveIntensity: 0.7 })
    );
    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.5, 2),
      new THREE.MeshBasicMaterial({ color: 0x86efac, wireframe: true, transparent: true, opacity: 0.2 })
    );
    root.add(core, shell);

    const glowCanvas = document.createElement("canvas");
    glowCanvas.width = glowCanvas.height = 128;
    const gctx = glowCanvas.getContext("2d");
    const grad = gctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(74,222,128,0.65)");
    grad.addColorStop(0.45, "rgba(34,197,94,0.18)");
    grad.addColorStop(1, "rgba(34,197,94,0)");
    gctx.fillStyle = grad;
    gctx.fillRect(0, 0, 128, 128);
    const glowTex = new THREE.CanvasTexture(glowCanvas);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.set(6.2, 6.2, 1);
    root.add(glow);

    // ---- orbit rings with nodes ----
    const nodeColors = [0x4ade80, 0xfbbf24, 0xffffff, 0x86efac];
    const rings = [
      { r: 2.1, tilt: [1.2, 0.2], speed: 0.35, nodes: 3 },
      { r: 2.7, tilt: [0.5, -0.6], speed: -0.25, nodes: 4 },
      { r: 3.3, tilt: [-0.9, 0.4], speed: 0.18, nodes: 3 },
    ].map((cfg, i) => {
      const tiltGroup = new THREE.Group();
      tiltGroup.rotation.set(cfg.tilt[0], cfg.tilt[1], 0);
      const spin = new THREE.Group();
      spin.add(new THREE.Mesh(
        new THREE.TorusGeometry(cfg.r, 0.011, 8, 180),
        new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.45 })
      ));
      for (let n = 0; n < cfg.nodes; n++) {
        const a = (n / cfg.nodes) * Math.PI * 2 + i;
        const node = new THREE.Mesh(
          new THREE.SphereGeometry(n % 2 ? 0.07 : 0.1, 16, 16),
          new THREE.MeshBasicMaterial({ color: nodeColors[(n + i) % nodeColors.length] })
        );
        node.position.set(Math.cos(a) * cfg.r, Math.sin(a) * cfg.r, 0);
        spin.add(node);
      }
      tiltGroup.add(spin);
      root.add(tiltGroup);
      return { spin, speed: cfg.speed };
    });

    // ---- paper plane ----
    const N = new THREE.Vector3(0, 0, 1.25), L = new THREE.Vector3(-0.78, 0.14, -0.7), R = new THREE.Vector3(0.78, 0.14, -0.7);
    const B = new THREE.Vector3(0, 0.02, -0.5), K = new THREE.Vector3(0, -0.26, -0.7);
    const tri = (...v) => v.flatMap((p) => [p.x, p.y, p.z]);
    const planeGeo = new THREE.BufferGeometry();
    planeGeo.setAttribute("position", new THREE.Float32BufferAttribute([...tri(N, L, B), ...tri(N, B, R), ...tri(N, B, K), ...tri(B, L, K), ...tri(B, K, R)], 3));
    planeGeo.computeVertexNormals();
    const plane = new THREE.Group();
    plane.add(new THREE.Mesh(planeGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x2a5a3a, emissiveIntensity: 0.35, roughness: 0.5, flatShading: true, side: THREE.DoubleSide })));
    plane.add(new THREE.LineSegments(new THREE.EdgesGeometry(planeGeo), new THREE.LineBasicMaterial({ color: 0xbbf7d0, transparent: true, opacity: 0.8 })));
    plane.scale.setScalar(0.66);
    root.add(plane);

    const orbit = (t, out) => out.set(Math.cos(t) * 3.9, Math.sin(t * 2) * 0.55 + Math.sin(t) * 0.9, Math.sin(t) * 3.1);
    const pA = new THREE.Vector3(), pB = new THREE.Vector3();

    // trail of fading light points behind the plane
    const TRAIL = 80;
    const trailPos = new Float32Array(TRAIL * 3);
    const trailCol = new Float32Array(TRAIL * 3);
    for (let i = 0; i < TRAIL; i++) {
      const f = Math.pow(1 - i / TRAIL, 1.8);
      trailCol.set([0.98 * f, 0.75 * f, 0.14 * f], i * 3);
    }
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPos, 3));
    trailGeo.setAttribute("color", new THREE.BufferAttribute(trailCol, 3));
    const trail = new THREE.Points(trailGeo, new THREE.PointsMaterial({ size: 0.09, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    trail.frustumCulled = false;
    root.add(trail);

    // ---- star dust ----
    const DUST = small ? 380 : 800;
    const dustPos = new Float32Array(DUST * 3);
    for (let i = 0; i < DUST; i++) {
      const rad = 4.4 + Math.random() * 5.5, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      dustPos.set([rad * Math.sin(ph) * Math.cos(th), rad * Math.cos(ph) * 0.8, rad * Math.sin(ph) * Math.sin(th)], i * 3);
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
    const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.035, color: 0xbbf7d0, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(dust);

    // ---- sizing: keep the whole orbit in view at any aspect ratio ----
    const fit = () => {
      const w = Math.max(mount.clientWidth, 1), h = Math.max(mount.clientHeight, 1);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      camera.position.set(0, 0.5, Math.max(4.6 / (tan * camera.aspect), 3.6 / tan, 7));
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    };
    fit();
    const ro = new ResizeObserver(() => { fit(); if (reduced) renderer.render(scene, camera); });
    ro.observe(mount);

    // ---- pointer parallax ----
    const target = { x: 0, y: 0 };
    const onMove = (e) => { target.y = (e.clientX / window.innerWidth - 0.5) * 0.7; target.x = (e.clientY / window.innerHeight - 0.5) * 0.35; };
    if (!reduced) window.addEventListener("pointermove", onMove, { passive: true });

    // ---- loop ----
    const clock = new THREE.Clock();
    let raf = 0, visible = true, t = 0.6;
    const trailHead = new THREE.Vector3();

    const frame = () => {
      const dt = Math.min(clock.getDelta(), 0.05);
      t += dt * 0.42;
      core.rotation.y += dt * 0.35;
      core.rotation.x += dt * 0.12;
      shell.rotation.y -= dt * 0.15;
      shell.rotation.z += dt * 0.08;
      glow.material.opacity = 0.85 + Math.sin(t * 3) * 0.12;
      rings.forEach((r) => { r.spin.rotation.z += dt * r.speed; });
      dust.rotation.y += dt * 0.02;

      orbit(t, pA);
      orbit(t + 0.03, pB);
      plane.position.copy(pA);
      plane.lookAt(pB);
      plane.rotateZ(Math.cos(t) * -0.55); // bank into the turn

      trailPos.copyWithin(3, 0, (TRAIL - 1) * 3);
      trailHead.copy(pA).addScaledVector(pB.sub(pA).normalize(), -0.55);
      trailPos.set([trailHead.x, trailHead.y, trailHead.z], 0);
      trailGeo.attributes.position.needsUpdate = true;

      root.rotation.y += (target.y - root.rotation.y) * 0.04;
      root.rotation.x += (target.x - root.rotation.x) * 0.04;
      renderer.render(scene, camera);
    };

    const loop = () => { raf = requestAnimationFrame(loop); frame(); };
    const start = () => { if (!raf && visible && !document.hidden && !reduced) { clock.getDelta(); loop(); } };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };

    if (reduced) { frame(); } else { start(); }
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; visible ? start() : stop(); }, { threshold: 0.01 });
    io.observe(mount);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);

    return () => {
      stop();
      io.disconnect(); ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVis);
      scene.traverse((o) => {
        o.geometry?.dispose?.();
        const m = o.material;
        (Array.isArray(m) ? m : m ? [m] : []).forEach((x) => { x.map?.dispose?.(); x.dispose(); });
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [onFail]);

  return <div ref={mountRef} className="h-full w-full" />;
}
