import AvatarSelectField from "./AvatarSelectField";

export interface StyleData {
  outfit: string;
  setting: string;
  mood: string;
  artStyle: string;
}

interface StepStyleProps {
  data: StyleData;
  onChange: (data: StyleData) => void;
}

const outfitOptions = ["Casual", "Lingerie", "Swimwear", "Elegant dress", "Streetwear", "Athleisure", "Fantasy costume"];
const settingOptions = ["Studio (plain)", "Bedroom", "Beach", "Urban street", "Nature / Forest", "Luxury interior", "Neon city"];
const moodOptions = ["Confident", "Playful", "Mysterious", "Sultry", "Cute", "Fierce", "Dreamy"];
const artStyleOptions = ["Photorealistic", "Anime", "3D Render", "Digital painting", "Comic book", "Soft glamour"];

const StepStyle = ({ data, onChange }: StepStyleProps) => (
  <div className="space-y-6">
    <div>
      <h2 className="text-xl font-bold text-primary mb-1">Set the vibe</h2>
      <p className="text-sm text-muted-foreground">Choose outfit, setting, and mood for your avatar's first look.</p>
    </div>
    <AvatarSelectField label="Outfit" value={data.outfit} onChange={(v) => onChange({ ...data, outfit: v })} options={outfitOptions} />
    <AvatarSelectField label="Setting / Background" value={data.setting} onChange={(v) => onChange({ ...data, setting: v })} options={settingOptions} />
    <AvatarSelectField label="Mood / Expression" value={data.mood} onChange={(v) => onChange({ ...data, mood: v })} options={moodOptions} />
    <AvatarSelectField label="Art style" value={data.artStyle} onChange={(v) => onChange({ ...data, artStyle: v })} options={artStyleOptions} />
  </div>
);

export default StepStyle;
