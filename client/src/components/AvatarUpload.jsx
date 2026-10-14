import { useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import api, { errMsg } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Avatar } from "./ui";
import { useConfirm, useToast } from "./Feedback";

/** Crops the picture to a centred square and shrinks it, so it stays small enough to store (about 20-40 KB). */
export async function fileToAvatar(file, size = 256) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Please choose a JPG, PNG or WebP picture.");
  if (file.size > 10 * 1024 * 1024) throw new Error("That picture is too large. Choose one under 10 MB.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("We couldn't read that picture. Try another one."));
      el.src = url;
    });
    const side = Math.min(img.width, img.height);
    const canvas = Object.assign(document.createElement("canvas"), { width: size, height: size });
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally { URL.revokeObjectURL(url); }
}

export default function AvatarUpload({ size = 88 }) {
  const { user, refresh } = useAuth();
  const input = useRef(null);
  const confirm = useConfirm();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function save(avatar, message) {
    setBusy(true);
    try { await api.put("/account", { avatar }); await refresh(); toast(message); }
    catch (e) { toast(errMsg(e), "error"); } finally { setBusy(false); }
  }

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // lets the same file be chosen again later
    if (!file) return;
    try { await save(await fileToAvatar(file), "Profile picture updated"); }
    catch (err) { toast(err.message, "error"); }
  }

  async function remove() {
    const ok = await confirm({ title: "Remove your profile picture?", message: "Your initials will be shown instead. You can upload a new picture any time.", confirmText: "Remove", tone: "danger" });
    if (ok) save("", "Profile picture removed");
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <Avatar name={user.name} src={user.avatar} size={size} className="ring-4 ring-white shadow-card" />
        <button type="button" onClick={() => input.current?.click()} disabled={busy} aria-label="Change profile picture"
          className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-brand text-white shadow-sm hover:bg-brand-dark disabled:opacity-60">
          <Camera size={14} aria-hidden="true" />
        </button>
      </div>
      <div className="flex flex-col items-start gap-1.5">
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className="text-sm font-semibold text-brand hover:underline disabled:opacity-60">
          {busy ? "Saving..." : user.avatar ? "Change photo" : "Upload photo"}
        </button>
        {user.avatar && (
          <button type="button" onClick={remove} disabled={busy} className="inline-flex items-center gap-1 text-xs font-semibold text-bad hover:underline disabled:opacity-60">
            <Trash2 size={12} aria-hidden="true" /> Remove
          </button>
        )}
        <p className="text-xs text-ink-soft">JPG, PNG or WebP.</p>
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pick} />
    </div>
  );
}
