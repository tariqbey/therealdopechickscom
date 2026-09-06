/** Projection + stereo layout of an immersive video. Mirrors the vr_videos.format column. */
export type VRFormat =
  | "MONO_180" | "STEREO_180_LR" | "STEREO_180_TB"
  | "MONO_360" | "STEREO_360_LR" | "STEREO_360_TB"
  | "FLAT";

export const VR_FORMATS: { value: VRFormat; label: string; hint: string }[] = [
  { value: "STEREO_180_LR", label: "VR180 · 3D side-by-side", hint: "Most VR180 cameras (Canon dual fisheye export, Vuze, Insta360 EVO). Left eye on the left." },
  { value: "STEREO_180_TB", label: "VR180 · 3D top-bottom", hint: "Left eye on top, right eye below." },
  { value: "MONO_180", label: "VR180 · 2D", hint: "Single 180° image, no depth." },
  { value: "STEREO_360_LR", label: "360° · 3D side-by-side", hint: "Full sphere, left/right halves." },
  { value: "STEREO_360_TB", label: "360° · 3D top-bottom", hint: "Full sphere, top/bottom halves (YouTube 3D 360 style)." },
  { value: "MONO_360", label: "360° · 2D", hint: "Standard equirectangular 360 video." },
  { value: "FLAT", label: "Regular video (cinema)", hint: "Normal 16:9 video shown on a big virtual screen." },
];

export const DEFAULT_VR_FORMAT: VRFormat = "STEREO_180_LR";

export const isVRFormat = (v: unknown): v is VRFormat =>
  typeof v === "string" && VR_FORMATS.some((f) => f.value === v);

export const formatLabel = (f: VRFormat) => VR_FORMATS.find((x) => x.value === f)?.label ?? f;

/** Short badge text for cards: "VR180 3D", "360 2D", "Video". */
export const formatBadge = (f: VRFormat | null | undefined) => {
  switch (f) {
    case "MONO_180": return "VR180";
    case "STEREO_180_TB": return "VR180 3D";
    case "MONO_360": return "360°";
    case "STEREO_360_LR": case "STEREO_360_TB": return "360° 3D";
    case "FLAT": return "Video";
    default: return "VR180 3D";
  }
};

export const is360 = (f: VRFormat) => f.includes("360");
export const isStereo = (f: VRFormat) => f.startsWith("STEREO");
export const isTopBottom = (f: VRFormat) => f.endsWith("_TB");

/**
 * Best guess from pixel dimensions when the uploader didn't say.
 * 2:1 is ambiguous (180 SBS vs 360 mono); this platform defaults to VR180 3D.
 */
export const guessFormat = (width?: number | null, height?: number | null): VRFormat => {
  if (!width || !height) return DEFAULT_VR_FORMAT;
  const a = width / height;
  if (a >= 3.5) return "STEREO_360_LR";
  if (a >= 1.7 && a <= 2.3) return "STEREO_180_LR";
  if (a >= 0.9 && a <= 1.1) return "MONO_180";
  if (a <= 0.6) return "STEREO_180_TB";
  return "FLAT";
};
