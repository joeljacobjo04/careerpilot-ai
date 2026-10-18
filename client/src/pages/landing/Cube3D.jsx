import { useEffect, useRef } from "react";

/**
 * CSS-3D cube. One face per readiness signal. Spins by itself; drag (or swipe sideways) to turn it.
 */
export default function Cube3D({ faces }) {
  const sceneRef = useRef(null);
  const cubeRef = useRef(null);

  useEffect(() => {
    const scene = sceneRef.current, cube = cubeRef.current;
    if (!scene || !cube) return undefined;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const st = { ry: -30, rx: -22, vy: 0.22, drag: false, lastX: 0, lastY: 0, on: true };
    const paint = () => { cube.style.transform = `rotateX(${st.rx}deg) rotateY(${st.ry}deg)`; };
    paint();
    if (reduced) return undefined;

    let raf = 0, last = performance.now();
    const tick = (now) => {
      const dt = Math.min(now - last, 50) / 16.7;
      last = now;
      if (!st.drag) {
        st.ry += st.vy * dt;
        st.vy += (0.22 - st.vy) * 0.02 * dt; // glide back to the slow idle spin
        st.rx += (-22 - st.rx) * 0.02 * dt;
      }
      paint();
      raf = requestAnimationFrame(tick);
    };
    const run = () => { if (!raf && st.on) { last = performance.now(); raf = requestAnimationFrame(tick); } };
    const halt = () => { cancelAnimationFrame(raf); raf = 0; };

    const down = (e) => { st.drag = true; st.lastX = e.clientX; st.lastY = e.clientY; scene.setPointerCapture?.(e.pointerId); };
    const move = (e) => {
      if (!st.drag) return;
      const dx = e.clientX - st.lastX, dy = e.clientY - st.lastY;
      st.lastX = e.clientX; st.lastY = e.clientY;
      st.ry += dx * 0.6; st.vy = dx * 0.25;
      st.rx = Math.max(-70, Math.min(70, st.rx - dy * 0.4));
    };
    const up = () => { st.drag = false; };
    scene.addEventListener("pointerdown", down);
    scene.addEventListener("pointermove", move);
    scene.addEventListener("pointerup", up);
    scene.addEventListener("pointercancel", up);

    const io = new IntersectionObserver(([en]) => { st.on = en.isIntersecting; st.on ? run() : halt(); }, { threshold: 0.05 });
    io.observe(scene);
    run();
    return () => {
      halt(); io.disconnect();
      scene.removeEventListener("pointerdown", down);
      scene.removeEventListener("pointermove", move);
      scene.removeEventListener("pointerup", up);
      scene.removeEventListener("pointercancel", up);
    };
  }, []);

  // front, right, back, left, top, bottom
  const place = [
    "rotateY(0deg)", "rotateY(90deg)", "rotateY(180deg)", "rotateY(-90deg)", "rotateX(90deg)", "rotateX(-90deg)",
  ];

  return (
    <div ref={sceneRef} className="lp-cube-scene [--s:11rem] sm:[--s:13rem]" role="img" aria-label="Rotating cube of the six readiness signals. Drag to turn it.">
      <div ref={cubeRef} className="lp-cube">
        {faces.map((f, i) => (
          <div key={f.label} className="lp-face" style={{ transform: `${place[i]} translateZ(calc(var(--s) / 2))` }}>
            <f.icon size={26} aria-hidden="true" />
            <b>{f.weight}%</b>
            <span>{f.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
