import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Cpu, Palette, CheckCircle2 } from "lucide-react";

const steps = [
  { icon: Cpu, label: "Initializing AI model...", duration: 2000 },
  { icon: Sparkles, label: "Generating your image...", duration: 8000 },
  { icon: Palette, label: "Refining details...", duration: 5000 },
  { icon: CheckCircle2, label: "Almost done...", duration: 3000 },
];

interface GenerationProgressProps {
  isGenerating: boolean;
  type: "image" | "character" | "video";
}

const GenerationProgress = ({ isGenerating, type }: GenerationProgressProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isGenerating) {
      setCurrentStep(0);
      setProgress(0);
      return;
    }

    setCurrentStep(0);
    setProgress(0);

    // Animate progress smoothly
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return 95; // Cap at 95% until done
        return prev + 0.5;
      });
    }, 100);

    // Step through stages
    const timers: NodeJS.Timeout[] = [];
    let elapsed = 0;
    steps.forEach((step, i) => {
      if (i === 0) return;
      elapsed += steps[i - 1].duration;
      timers.push(setTimeout(() => setCurrentStep(i), elapsed));
    });

    return () => {
      clearInterval(progressInterval);
      timers.forEach(clearTimeout);
    };
  }, [isGenerating]);

  if (!isGenerating) return null;

  const typeLabel = type === "character" ? "character" : type === "video" ? "video frame" : "image";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="rounded-xl bg-gradient-card border border-primary/20 p-6 glow-purple"
    >
      {/* Animated preview area */}
      <div className="relative aspect-video max-h-48 rounded-lg bg-muted/50 overflow-hidden mb-5 flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 animate-pulse" />
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        >
          <Sparkles className="h-12 w-12 text-primary/40" />
        </motion.div>
        <div className="absolute bottom-3 left-3 right-3">
          <p className="text-xs text-muted-foreground mb-1 text-center">
            Generating your {typeLabel}...
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-foreground">Progress</span>
          <span className="text-xs font-mono text-primary">{Math.round(progress)}%</span>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-purple-500 rounded-full"
            style={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {steps.map((step, i) => {
          const StepIcon = step.icon;
          const isActive = i === currentStep;
          const isDone = i < currentStep;

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0.4 }}
              animate={{ opacity: isDone || isActive ? 1 : 0.4 }}
              className={`flex items-center gap-3 text-sm ${
                isActive ? "text-primary font-medium" : isDone ? "text-muted-foreground" : "text-muted-foreground/50"
              }`}
            >
              <StepIcon className={`h-4 w-4 flex-shrink-0 ${isActive ? "animate-pulse text-primary" : isDone ? "text-green-500" : ""}`} />
              <span>{step.label}</span>
              {isDone && <CheckCircle2 className="h-3 w-3 text-green-500 ml-auto" />}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default GenerationProgress;
