import AvatarSelectField from "./AvatarSelectField";

export interface FacialFeaturesData {
  hairColour: string;
  hairLength: string;
  eyeColour: string;
  eyeShape: string;
}

interface StepFacialFeaturesProps {
  data: FacialFeaturesData;
  onChange: (data: FacialFeaturesData) => void;
}

const hairColourOptions = ["Black", "Brown", "Blonde", "Red", "Auburn", "Platinum", "Pink", "Blue", "Purple", "Silver"];
const hairLengthOptions = ["Pixie / Short", "Shoulder length", "Mid-back", "Waist length", "Extra long"];
const eyeColourOptions = ["Brown", "Hazel", "Green", "Blue", "Grey", "Amber"];
const eyeShapeOptions = ["Almond", "Round", "Hooded", "Monolid", "Upturned", "Downturned", "Cat-eye"];

const StepFacialFeatures = ({ data, onChange }: StepFacialFeaturesProps) => (
  <div className="space-y-6">
    <div>
      <h2 className="text-xl font-bold text-primary mb-1">Now let's bring your avatar to life</h2>
      <p className="text-sm text-muted-foreground">Select your avatar's hair and eye features to shape their unique look.</p>
    </div>
    <AvatarSelectField label="Hair colour" value={data.hairColour} onChange={(v) => onChange({ ...data, hairColour: v })} options={hairColourOptions} />
    <AvatarSelectField label="Hair length" value={data.hairLength} onChange={(v) => onChange({ ...data, hairLength: v })} options={hairLengthOptions} />
    <AvatarSelectField label="Eye colour" value={data.eyeColour} onChange={(v) => onChange({ ...data, eyeColour: v })} options={eyeColourOptions} />
    <AvatarSelectField label="Eye shape" value={data.eyeShape} onChange={(v) => onChange({ ...data, eyeShape: v })} options={eyeShapeOptions} />
  </div>
);

export default StepFacialFeatures;
