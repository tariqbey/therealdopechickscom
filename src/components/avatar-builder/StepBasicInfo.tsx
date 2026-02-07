import AvatarSelectField from "./AvatarSelectField";

export interface BasicInfoData {
  gender: string;
  age: string;
  ethnicity: string;
}

interface StepBasicInfoProps {
  data: BasicInfoData;
  onChange: (data: BasicInfoData) => void;
}

const genderOptions = ["Female", "Male", "Non-binary"];
const ageOptions = ["18-22", "23-27", "28-35", "36-45", "46+"];
const ethnicityOptions = ["Asian", "Black", "Caucasian", "Hispanic/Latina", "Middle Eastern", "Mixed", "South Asian"];

const StepBasicInfo = ({ data, onChange }: StepBasicInfoProps) => (
  <div className="space-y-6">
    <div>
      <h2 className="text-xl font-bold text-primary mb-1">Let's start with the basics</h2>
      <p className="text-sm text-muted-foreground">Select a few key details to help us begin shaping your avatar.</p>
    </div>
    <AvatarSelectField label="Gender" required value={data.gender} onChange={(v) => onChange({ ...data, gender: v })} options={genderOptions} />
    <AvatarSelectField label="Age" required value={data.age} onChange={(v) => onChange({ ...data, age: v })} options={ageOptions} />
    <AvatarSelectField label="Ethnicity" required value={data.ethnicity} onChange={(v) => onChange({ ...data, ethnicity: v })} options={ethnicityOptions} />
    <p className="text-xs text-muted-foreground">* mandatory fields</p>
  </div>
);

export default StepBasicInfo;
