import { useState } from "react";
import AvatarSelectField from "./AvatarSelectField";

export interface BodyFeaturesData {
  bodyType: string;
  skinTone: string;
  breastSize: string;
  hipsSize: string;
  additionalDetails: string;
}

interface StepBodyFeaturesProps {
  data: BodyFeaturesData;
  onChange: (data: BodyFeaturesData) => void;
}

const bodyTypeOptions = ["Slim", "Athletic", "Average", "Curvy", "Plus-size", "Petite"];
const skinToneOptions = ["Fair", "Light", "Medium", "Olive", "Tan", "Brown", "Dark"];
const breastSizeOptions = ["Small", "Medium", "Large", "Extra Large"];
const hipsSizeOptions = ["Narrow", "Medium", "Wide", "Extra Wide"];

const StepBodyFeatures = ({ data, onChange }: StepBodyFeaturesProps) => {
  const maxChars = 100;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-primary mb-1">Finally, shape the look</h2>
        <p className="text-sm text-muted-foreground">Select body features to complete your avatar's appearance.</p>
      </div>
      <AvatarSelectField label="Body type" value={data.bodyType} onChange={(v) => onChange({ ...data, bodyType: v })} options={bodyTypeOptions} />
      <AvatarSelectField label="Skin tone" value={data.skinTone} onChange={(v) => onChange({ ...data, skinTone: v })} options={skinToneOptions} />
      <AvatarSelectField label="Breast size" value={data.breastSize} onChange={(v) => onChange({ ...data, breastSize: v })} options={breastSizeOptions} />
      <AvatarSelectField label="Hips size" value={data.hipsSize} onChange={(v) => onChange({ ...data, hipsSize: v })} options={hipsSizeOptions} />
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Additional details</label>
        <textarea
          value={data.additionalDetails}
          onChange={(e) => {
            if (e.target.value.length <= maxChars) {
              onChange({ ...data, additionalDetails: e.target.value });
            }
          }}
          placeholder="Additional prompt details (e.g., light freckles, full lips, dimples)"
          className="w-full h-20 bg-muted border border-border rounded-lg p-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <p className="text-xs text-muted-foreground">{data.additionalDetails.length} / {maxChars} characters</p>
      </div>
    </div>
  );
};

export default StepBodyFeatures;
