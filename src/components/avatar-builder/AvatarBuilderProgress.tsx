import { cn } from "@/lib/utils";

interface AvatarBuilderProgressProps {
  currentStep: number;
  totalSteps: number;
  stepLabel: string;
}

const AvatarBuilderProgress = ({ currentStep, totalSteps, stepLabel }: AvatarBuilderProgressProps) => {
  const progress = (currentStep / totalSteps) * 100;

  return (
    <div className="mb-8">
      <h1 className="text-4xl font-black mb-2">Build your avatar</h1>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">Step {currentStep} of {totalSteps}</span>
        <span className="text-sm text-muted-foreground">{stepLabel}</span>
      </div>
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export default AvatarBuilderProgress;
