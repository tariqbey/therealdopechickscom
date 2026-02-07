import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Video, Download, Save, Loader2, Check, X, ZoomIn, Crop } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import MediaEditor from "@/components/editor/MediaEditor";

interface GeneratedResultCardProps {
  url: string;
  index: number;
  onAnimateToVideo: (imageUrl: string) => void;
  onSaveToLibrary: (imageUrl: string) => Promise<void>;
}

const GeneratedResultCard = ({ url, index, onAnimateToVideo, onSaveToLibrary }: GeneratedResultCardProps) => {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
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
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: index * 0.1 }}
        className="group rounded-xl border border-border overflow-hidden bg-gradient-card"
      >
        <div
          className="overflow-hidden relative cursor-pointer"
          onClick={() => setLightboxOpen(true)}
        >
          <img src={url} alt={`Generated ${index + 1}`} className="w-full h-auto object-contain" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <ZoomIn className="h-8 w-8 text-white drop-shadow-lg" />
          </div>
        </div>

        <div className="p-3 space-y-2">
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => onAnimateToVideo(url)}
              className="flex-1 bg-gradient-purple text-primary-foreground font-bold hover:opacity-90 h-8 text-xs"
            >
              <Video className="h-3 w-3 mr-1" /> Animate
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditorOpen(true)}
              className="flex-1 h-8 text-xs"
            >
              <Crop className="h-3 w-3 mr-1" /> Edit
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleSave}
              disabled={saving || saved}
              className="flex-1 h-8 text-xs"
            >
              {saving ? (
                <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Saving...</>
              ) : saved ? (
                <><Check className="h-3 w-3 mr-1 text-green-500" /> Saved</>
              ) : (
                <><Save className="h-3 w-3 mr-1" /> Save to Library</>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownload}
              className="h-8 text-xs px-3"
            >
              <Download className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Lightbox */}
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
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={url}
              alt={`Generated ${index + 1}`}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Media Editor */}
      <MediaEditor
        mediaUrl={url}
        mediaType="image"
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
      />
    </>
  );
};

export default GeneratedResultCard;
