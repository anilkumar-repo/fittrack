"use client";

import { useScrollLock } from "./use-scroll-lock";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, X } from "lucide-react";
import { ROZI_MOODS, type RoziMood } from "@/lib/rozi";
import { useFitTrack } from "./fit-track-provider";
import { SheetGrip } from "@/components/ui/sheet-grip";

/**
 * A person's picture. The saved value is one of:
 *   "photo:<url>"  an uploaded photo (a small data URL on this device, or a Supabase Storage link)
 *   "rozi:<mood>"  a Rozi avatar
 *   "face:<name>"  a round Rozi face (pastel background), from public/rozi/faces/v1
 *   "color:<hex>"  initials on a colour
 * Anything else shows the initial on coral.
 */
export function Avatar({ value, name, size = 40, className = "" }: { value?: string; name: string; size?: number; className?: string }) {
  const initial = (name.trim()[0] ?? "R").toUpperCase();
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) };
  if (value?.startsWith("photo:")) {
    // eslint-disable-next-line @next/next/no-img-element -- small user photo, already resized; may be a data URL
    return <img src={value.slice(6)} alt="" width={size} height={size} className={`avatar-img ${className}`} style={style} />;
  }
  if (value?.startsWith("face:") && (ROZI_FACES as readonly string[]).includes(value.slice(5))) {
    // eslint-disable-next-line @next/next/no-img-element -- static Rozi face
    return <img src={`/rozi/faces/v1/${value.slice(5)}.webp`} alt="" width={size} height={size} className={`avatar-img ${className}`} style={style} />;
  }
  if (value?.startsWith("rozi:") && (ROZI_MOODS as readonly string[]).includes(value.slice(5))) {
    // eslint-disable-next-line @next/next/no-img-element -- static Rozi picture
    return <img src={`/rozi/${value.slice(5)}.webp`} alt="" width={size} height={size} className={`avatar-img avatar-rozi ${className}`} style={style} />;
  }
  const color = value?.startsWith("color:") && /^#[0-9a-f]{6}$/i.test(value.slice(6)) ? value.slice(6) : "#ef7d5c";
  return <span className={`avatar-initial ${className}`} style={{ ...style, background: color }} aria-hidden="true">{initial}</span>;
}

/** Rozi faces in the picker's order. Each has public/rozi/faces/v1/<name>.webp (built by scripts/build-avatars.mjs). */
export const ROZI_FACES = ["happy", "wink", "love", "cool", "strong", "focused", "laughing", "starry", "party", "sweet", "shy", "surprised", "zen", "cozy", "hydrated", "sleepy", "grumpy"] as const;

const AVATAR_MOODS: RoziMood[] = ["base", "hello", "cheer", "upper-body", "full-body", "stretch", "water", "trophy"];
const AVATAR_COLORS = ["#ef7d5c", "#7cc576", "#5b9bd5", "#9b7be0", "#e5a33b", "#16181a"];

/** Shrinks a photo to a 256 px square (centre crop) so it loads fast everywhere. */
async function squarePhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser can’t edit photos.");
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 256, 256);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The photo could not be read."))), "image/webp", 0.82));
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The photo could not be read."));
    reader.readAsDataURL(blob);
  });
}

/** Settings: change your picture — upload a photo, pick a Rozi, or use initials on a colour. */
export function AvatarPicker() {
  const { state, isDemo, browserClient, updateProfile } = useFitTrack();
  const [open, setOpen] = useState(false);
  useScrollLock(open);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const profile = state.profile;

  async function savePhoto(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      if (file.size > 15 * 1024 * 1024) throw new Error("Please choose a photo under 15 MB.");
      const small = await squarePhoto(file);
      let url: string;
      if (isDemo || !browserClient) url = await blobToDataUrl(small);
      else {
        const path = `${profile.id}/${crypto.randomUUID()}.webp`;
        const { error: uploadError } = await browserClient.storage.from("avatars").upload(path, small, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
        if (uploadError) throw new Error(uploadError.message);
        url = browserClient.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      }
      updateProfile({ avatar: `photo:${url}` });
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The photo could not be saved.");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function choose(avatar: string) {
    updateProfile({ avatar });
    setOpen(false);
  }

  return (
    <>
      <button type="button" className="avatar-edit" onClick={() => setOpen(true)} aria-label="Change your picture">
        <Avatar value={profile.avatar} name={profile.displayName} size={64} />
        <span className="avatar-edit-badge" aria-hidden="true"><Camera /></span>
      </button>
      {open && typeof document !== "undefined" && createPortal(<div className="avatar-sheet-backdrop" onClick={() => setOpen(false)}>
        <section className="avatar-sheet panel" role="dialog" aria-modal="true" aria-labelledby="avatar-title" onClick={(event) => event.stopPropagation()}>
          <SheetGrip onClose={() => setOpen(false)} />
          <div className="avatar-sheet-head"><h3 id="avatar-title">Your picture</h3><button type="button" className="icon-button" aria-label="Close" onClick={() => setOpen(false)}><X /></button></div>
          <input ref={fileInput} type="file" accept="image/*" hidden onChange={(event) => void savePhoto(event.target.files?.[0])} />
          <button type="button" className="button button-primary full-width" disabled={busy} onClick={() => fileInput.current?.click()}><Camera aria-hidden="true" /> {busy ? "Saving photo…" : "Upload a photo"}</button>
          <h4>Rozi faces</h4>
          <div className="avatar-grid faces">{ROZI_FACES.map((face) => <button key={face} type="button" className={profile.avatar === `face:${face}` ? "selected" : ""} onClick={() => choose(`face:${face}`)} aria-label={`Rozi ${face}`} title={face[0].toUpperCase() + face.slice(1)}><Avatar value={`face:${face}`} name={profile.displayName} size={52} /></button>)}</div>
          <h4>Rozi in action</h4>
          <div className="avatar-grid">{AVATAR_MOODS.map((mood) => <button key={mood} type="button" className={profile.avatar === `rozi:${mood}` ? "selected" : ""} onClick={() => choose(`rozi:${mood}`)} aria-label={`Rozi ${mood}`}><Avatar value={`rozi:${mood}`} name={profile.displayName} size={56} /></button>)}</div>
          <h4>Or your initial</h4>
          <div className="avatar-grid colors">{AVATAR_COLORS.map((color) => <button key={color} type="button" className={profile.avatar === `color:${color}` ? "selected" : ""} onClick={() => choose(`color:${color}`)} aria-label={`Initial on colour ${color}`}><Avatar value={`color:${color}`} name={profile.displayName} size={36} /></button>)}</div>
          {error && <p className="form-error" role="alert">{error}</p>}
          {profile.avatar && <button type="button" className="text-button" onClick={() => choose("")}>Remove picture</button>}
        </section>
      </div>, document.body)}
    </>
  );
}
