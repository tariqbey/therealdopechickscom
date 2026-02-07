import { useState } from "react";
import { motion } from "framer-motion";
import { Video, Download, Save, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface GeneratedResultCardProps {
  url: string;
  index: number;
  onAnimateToVideo: (imageUrl: string) => void;
  onSaveToLibrary: (imageUrl: string) => Promise<void>;
}

const GeneratedResultCard = ({ url, index, onAnimateToVideo, onSaveToLibrary }: GeneratedResultCardProps) => {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveToLibrary(url);
      setSaved(true);
      toast({ title: "Saved!", description: "Image saved to your library." });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `generation-${index + 1}.png`;
    a.target = "_blank";
    a.click();
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.1 }}
      className="group rounded-xl border border-border overflow-hidden bg-gradient-card"
    >
      <div className="aspect-square overflow-hidden relative">
        <img src={url} alt={`Generated ${index + 1}`} className="w-full h-full object-cover" />
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleDownload}
              className="h-8 text-xs"
            >
              <Download className="h-3 w-3 mr-1" /> Download
            </Button>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="p-3 space-y-2">
        <Button
          size="sm"
          onClick={() => onAnimateToVideo(url)}
          className="w-full bg-gradient-purple text-primary-foreground font-bold hover:opacity-90 h-8 text-xs"
        >
          <Video className="h-3 w-3 mr-1" /> Animate to Video
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleSave}
          disabled={saving || saved}
          className="w-full h-8 text-xs"
        >
          {saving ? (
            <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Saving...</>
          ) : saved ? (
            <><Check className="h-3 w-3 mr-1 text-green-500" /> Saved</>
          ) : (
            <><Save className="h-3 w-3 mr-1" /> Save to Library</>
          )}
        </Button>
      </div>
    </motion.div>
  );
};

export default GeneratedResultCard;
