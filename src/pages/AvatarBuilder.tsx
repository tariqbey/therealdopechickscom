import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AvatarBuilderProgress from "@/components/avatar-builder/AvatarBuilderProgress";
import StepBasicInfo, { type BasicInfoData } from "@/components/avatar-builder/StepBasicInfo";
import StepFacialFeatures, { type FacialFeaturesData } from "@/components/avatar-builder/StepFacialFeatures";
import StepBodyFeatures, { type BodyFeaturesData } from "@/components/avatar-builder/StepBodyFeatures";
import StepStyle, { type StyleData } from "@/components/avatar-builder/StepStyle";
import StepReview, { buildPrompt } from "@/components/avatar-builder/StepReview";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/hooks/useWallet";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Coins } from "lucide-react";
import BuyBreadModal from "@/components/BuyBreadModal";

const TOTAL_STEPS = 5;
const AVATAR_COST = 30;

const stepLabels = ["Basic info", "Facial features", "Body features", "Style & vibe", "Review & generate"];

const AvatarBuilderPage = () => {
  const [step, setStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [showBuyModal, setShowBuyModal] = useState(false);

  const [basicInfo, setBasicInfo] = useState<BasicInfoData>({ gender: "Female", age: "", ethnicity: "" });
  const [facialFeatures, setFacialFeatures] = useState<FacialFeaturesData>({ hairColour: "", hairLength: "", eyeColour: "", eyeShape: "" });
  const [bodyFeatures, setBodyFeatures] = useState<BodyFeaturesData>({ bodyType: "", skinTone: "", breastSize: "", hipsSize: "", additionalDetails: "" });
  const [style, setStyle] = useState<StyleData>({ outfit: "", setting: "", mood: "", artStyle: "" });

  const { user } = useAuth();
  const { balance } = useWallet();
  const { toast } = useToast();
  const navigate = useNavigate();

  const canProceed = () => {
    if (step === 1) return basicInfo.gender && basicInfo.age && basicInfo.ethnicity;
    return true;
  };

  const handleGenerate = async () => {
    if (!user) {
      toast({ title: "Please log in", description: "You need an account to generate avatars.", variant: "destructive" });
      navigate("/auth");
      return;
    }
    if (balance < AVATAR_COST) {
      toast({ title: "Not enough BREAD", description: `You need ${AVATAR_COST} BREAD.`, variant: "destructive" });
      setShowBuyModal(true);
      return;
    }

    setIsGenerating(true);
    try {
      const prompt = buildPrompt(basicInfo, facialFeatures, bodyFeatures, style);
      const { data, error } = await supabase.functions.invoke("generate-ai", {
        body: { type: "character", characterName: "Avatar", characterStyle: style.artStyle || "Realistic", characterDescription: prompt },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: "Generation failed", description: data.error, variant: "destructive" });
      } else {
        toast({ title: "Avatar generated!", description: `Cost: ${AVATAR_COST} BREAD` });
        const url = data?.result?.character?.thumbnail_url || data?.result?.images?.[0]?.url;
        if (url) setGeneratedUrl(url);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1: return <StepBasicInfo data={basicInfo} onChange={setBasicInfo} />;
      case 2: return <StepFacialFeatures data={facialFeatures} onChange={setFacialFeatures} />;
      case 3: return <StepBodyFeatures data={bodyFeatures} onChange={setBodyFeatures} />;
      case 4: return <StepStyle data={style} onChange={setStyle} />;
      case 5: return <StepReview basicInfo={basicInfo} facialFeatures={facialFeatures} bodyFeatures={bodyFeatures} style={style} />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12 max-w-2xl">
        <AvatarBuilderProgress currentStep={step} totalSteps={TOTAL_STEPS} stepLabel={stepLabels[step - 1]} />

        {/* BREAD Balance */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border mb-6">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-accent" />
            <span className="text-sm font-bold text-gradient-gold">{user ? `${balance} BREAD` : "Log in"}</span>
          </div>
          <span className="text-xs text-muted-foreground">Cost: {AVATAR_COST} BREAD</span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>

        {/* Generated result */}
        {generatedUrl && (
          <div className="mt-6">
            <h3 className="text-sm font-bold mb-3">Your Avatar</h3>
            <div className="aspect-square max-w-sm mx-auto rounded-xl border border-border overflow-hidden">
              <img src={generatedUrl} alt="Generated avatar" className="w-full h-full object-cover" />
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
          <Button
            variant="outline"
            onClick={() => step > 1 ? setStep(step - 1) : navigate(-1)}
            className="rounded-full px-6"
          >
            Back
          </Button>

          {step < TOTAL_STEPS ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="rounded-full px-6 bg-[hsl(var(--gold))] text-background font-bold hover:opacity-90"
            >
              Next
            </Button>
          ) : (
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="rounded-full px-6 bg-[hsl(var(--gold))] text-background font-bold hover:opacity-90"
            >
              <Sparkles className="h-4 w-4 mr-1" />
              {isGenerating ? "Generating..." : "Generate avatar"}
            </Button>
          )}
        </div>
      </div>
      <Footer />
      <BuyBreadModal open={showBuyModal} onClose={() => setShowBuyModal(false)} />
    </div>
  );
};

export default AvatarBuilderPage;
