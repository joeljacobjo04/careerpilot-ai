import { useRef } from "react";

/** Card that leans toward the mouse and lights up under it. Touch devices just get a normal card. */
export default function Tilt({ as: Tag = "div", max = 7, className = "", style, children, ...rest }) {
  const ref = useRef(null);

  const onMove = (e) => {
    if (e.pointerType === "touch") return;
    const el = ref.current;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    el.style.setProperty("--ry", `${(px - 0.5) * 2 * max}deg`);
    el.style.setProperty("--rx", `${(0.5 - py) * 2 * max}deg`);
    el.style.setProperty("--gx", `${px * 100}%`);
    el.style.setProperty("--gy", `${py * 100}%`);
    el.dataset.active = "true";
  };
  const onLeave = () => {
    const el = ref.current;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.dataset.active = "false";
  };

  return <Tag ref={ref} className={`lp-tilt ${className}`} style={style} onPointerMove={onMove} onPointerLeave={onLeave} {...rest}>{children}</Tag>;
}
