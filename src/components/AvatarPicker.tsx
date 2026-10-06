import { useRef, useState } from "react";
import { useGame } from "../store/game";
import { useUi } from "../store/ui";
import { AVATARS } from "../data";
import { SystemWindow } from "./SystemWindow";
import { audio } from "../lib/audio";

export function AvatarPicker() {
  const open = useUi((s) => s.avatarOpen);
  const closeAll = useUi((s) => s.closeAll);
  const avatar = useGame((s) => s.avatar);
  const setAvatar = useGame((s) => s.setAvatar);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  if (!open) return null;

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/") || file.size > 2_000_000) {
      alert("Please choose an image under 2 MB.");
      return;
    }
    setUploading(true);
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      // Keep the portrait crisp at HUD size without rewriting a multi-MB save per event.
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 320;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Image conversion is unavailable.");
      const side = Math.min(image.naturalWidth, image.naturalHeight);
      ctx.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 320, 320);
      setAvatar(canvas.toDataURL("image/jpeg", 0.85));
      audio.chime();
    } catch {
      alert("The image could not be opened. Try a JPG, PNG or WebP image.");
    } finally {
      URL.revokeObjectURL(url);
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[66] sys-backdrop flex items-center justify-center p-4">
      <div className="w-full max-w-[420px]">
        <SystemWindow title="SELECT PORTRAIT" titleSize="sm">
          <div className="grid grid-cols-4 gap-2">
            {AVATARS.map((a) => (
              <button
                key={a.id}
                onClick={() => {
                  setAvatar(a.src);
                  audio.repBeep();
                }}
                className={`pfp-pick aspect-[4/5] ${avatar === a.src ? "on" : ""}`}
                title={a.name}
              >
                <img src={a.src} alt={a.name} />
              </button>
            ))}
          </div>

          <div className="flex gap-2 mt-4">
            <button className="sl-btn flex-1 py-2 text-[10px]" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? "OPTIMIZING..." : "UPLOAD OWN"}
            </button>
            <button className="sl-btn sl-btn-solid flex-1 py-2 text-[10px]" onClick={closeAll}>
              CONFIRM
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
        </SystemWindow>
      </div>
    </div>
  );
}
