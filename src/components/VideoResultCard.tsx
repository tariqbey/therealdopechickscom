import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Video, Save, RefreshCw, Download, Loader2, Check, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface VideoResultCardProps {
  videoUrl: string;
  onSaveToLibrary: (url: string) => Promise<void>;
  onRerun: () => void;
}

const VideoResultCard = ({ videoUrl, onSaveToLibrary, onRerun }: VideoResultCardProps) => {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveToLibrary(videoUrl);
      setSaved(true);
      toast({ title: "Saved!", description: "Video saved to your library." });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = `generated-video.mp4`;
    a.target = "_blank";
    a.click();
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-xl border border-border overflow-hidden bg-gradient-card"
      >
        {/* Video preview */}
        <div
          className="relative cursor-pointer group"
          onClick={() => setLightboxOpen(true)}
        >
          <video
            src={videoUrl}
            className="w-full h-auto"
            muted
            loop
            autoPlay
            playsInline
          />
          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Play className="h-12 w-12 text-white drop-shadow-lg" />
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 space-y-2">
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || saved}
              className="flex-1 bg-gradient-purple text-primary-foreground font-bold hover:opacity-90 h-9 text-xs"
            >
              {saving ? (
                <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Saving...</>
              ) : saved ? (
                <><Check className="h-3 w-3 mr-1" /> Saved</>
              ) : (
                <><Save className="h-3 w-3 mr-1" /> Save to Library</>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownload}
              className="h-9 text-xs px-3"
            >
              <Download className="h-3 w-3" />
            </Button>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={onRerun}
            className="w-full h-9 text-xs"
          >
            <RefreshCw className="h-3 w-3 mr-1" /> Generate Again
          </Button>
        </div>
      </motion.div>

      {/* Fullscreen lightbox */}
      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
            onClick={() => setLightboxOpen(false)}
          >
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-background/20 hover:bg-background/40 text-white transition-colors z-50"
            >
              <X className="h-6 w-6" />
            </button>
            <motion.video
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={videoUrl}
              className="max-w-full max-h-[90vh] rounded-lg"
              controls
              autoPlay
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default VideoResultCard;
