import { useState } from "react";
import { Sparkles } from "lucide-react";
import type { BasicInfoData } from "./StepBasicInfo";
import type { FacialFeaturesData } from "./StepFacialFeatures";
import type { BodyFeaturesData } from "./StepBodyFeatures";
import type { StyleData } from "./StepStyle";

interface StepReviewProps {
  basicInfo: BasicInfoData;
  facialFeatures: FacialFeaturesData;
  bodyFeatures: BodyFeaturesData;
  style: StyleData;
}

function buildPrompt(b: BasicInfoData, f: FacialFeaturesData, bo: BodyFeaturesData, s: StyleData): string {
  const parts: string[] = [];
  parts.push(`A ${s.artStyle || "photorealistic"} portrait of a ${b.age || ""} year old ${b.ethnicity || ""} ${b.gender || "female"}.`);
  if (f.hairColour || f.hairLength) parts.push(`${f.hairLength || ""} ${f.hairColour || ""} hair.`);
  if (f.eyeColour || f.eyeShape) parts.push(`${f.eyeShape || ""} ${f.eyeColour || ""} eyes.`);
  if (bo.bodyType) parts.push(`${bo.bodyType} body type.`);
  if (bo.skinTone) parts.push(`${bo.skinTone} skin tone.`);
  if (bo.breastSize) parts.push(`${bo.breastSize} bust.`);
  if (bo.hipsSize) parts.push(`${bo.hipsSize} hips.`);
  if (s.outfit) parts.push(`Wearing ${s.outfit}.`);
  if (s.setting) parts.push(`Setting: ${s.setting}.`);
  if (s.mood) parts.push(`Expression: ${s.mood}.`);
  if (bo.additionalDetails) parts.push(bo.additionalDetails);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

const StepReview = ({ basicInfo, facialFeatures, bodyFeatures, style }: StepReviewProps) => {
  const [showPrompt, setShowPrompt] = useState(false);
  const prompt = buildPrompt(basicInfo, facialFeatures, bodyFeatures, style);

  const sections = [
    { title: "Basic Info", items: [["Gender", basicInfo.gender], ["Age", basicInfo.age], ["Ethnicity", basicInfo.ethnicity]] },
    { title: "Facial Features", items: [["Hair", `${facialFeatures.hairColour} ${facialFeatures.hairLength}`], ["Eyes", `${facialFeatures.eyeColour} ${facialFeatures.eyeShape}`]] },
    { title: "Body", items: [["Body type", bodyFeatures.bodyType], ["Skin tone", bodyFeatures.skinTone], ["Bust", bodyFeatures.breastSize], ["Hips", bodyFeatures.hipsSize]] },
    { title: "Style", items: [["Outfit", style.outfit], ["Setting", style.setting], ["Mood", style.mood], ["Art style", style.artStyle]] },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-primary mb-1">Review & generate</h2>
        <p className="text-sm text-muted-foreground">Double-check your selections, then hit generate.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {sections.map((section) => (
          <div key={section.title} className="rounded-xl bg-muted/50 border border-border p-4 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary">{section.title}</h3>
            {section.items.map(([label, value]) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium text-foreground">{value || "—"}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {bodyFeatures.additionalDetails && (
        <div className="rounded-xl bg-muted/50 border border-border p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-2">Additional Details</h3>
          <p className="text-sm text-foreground">{bodyFeatures.additionalDetails}</p>
        </div>
      )}

      <div>
        <h3 className="font-bold mb-2">Full prompt preview</h3>
        <button
          onClick={() => setShowPrompt(!showPrompt)}
          className="px-4 py-2 rounded-lg bg-muted border border-border text-sm font-medium hover:bg-muted/80 transition-colors"
        >
          {showPrompt ? "Hide prompt" : "Show prompt"}
        </button>
        {showPrompt && (
          <div className="mt-3 p-4 rounded-xl bg-muted border border-border text-sm text-foreground leading-relaxed">
            {prompt}
          </div>
        )}
      </div>
    </div>
  );
};

export { buildPrompt };
export default StepReview;
