import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  X, Download, Upload, Crop, Scissors, Film, Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import ImageEditor from "./ImageEditor";
import VideoTrimmer from "./VideoTrimmer";
import ClipTimeline from "./ClipTimeline";

type EditorTab = "crop" | "trim" | "timeline";

interface MediaEditorProps {
  mediaUrl: string;
  mediaType: "image" | "video";
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

const MediaEditor = ({ mediaUrl, mediaType, open, onClose, onSaved }: MediaEditorProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const hasMedia = !!mediaUrl;
  const [activeTab, setActiveTab] = useState<EditorTab>(
    !hasMedia ? "timeline" : mediaType === "image" ? "crop" : "trim"
  );
  const [editedBlob, setEditedBlob] = useState<Blob | null>(null);
  const [editedPreview, setEditedPreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  const tabs: { id: EditorTab; label: string; icon: React.ElementType; show: boolean }[] = [
    { id: "crop", label: "Crop & Resize", icon: Crop, show: hasMedia && mediaType === "image" },
    { id: "trim", label: "Trim", icon: Scissors, show: hasMedia && mediaType === "video" },
    { id: "timeline", label: "Timeline", icon: Film, show: true },
  ];

  const handleEdited = (blob: Blob) => {
    setEditedBlob(blob);
    setEditedPreview(URL.createObjectURL(blob));
    toast({ title: "Edit applied!", description: "Download or post to your profile." });
  };

  const handleDownload = () => {
    const blob = editedBlob;
    if (!blob) return;
    const ext = blob.type.includes("webm") ? "webm" : blob.type.includes("mp4") ? "mp4" : "jpg";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `edited-${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePostToProfile = async () => {
    if (!editedBlob || !user) return;
    setPosting(true);

    try {
      const ext = editedBlob.type.includes("webm") ? "webm" : editedBlob.type.includes("mp4") ? "mp4" : "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const isVideo = editedBlob.type.startsWith("video/");

      const { error: uploadError } = await supabase.storage
        .from("creator-content")
        .upload(path, editedBlob, { upsert: false });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from("creator-content").getPublicUrl(path);

      const { error: insertError } = await supabase
        .from("creator_posts" as any)
        .insert({
          creator_id: user.id,
          media_url: publicUrl,
          media_type: isVideo ? "video" : "photo",
          is_locked: false,
        } as any);
      if (insertError) throw insertError;

      toast({ title: "Posted to profile!", description: "Content is now live on your page." });
      onSaved?.();
      onClose();
    } catch (err: any) {
      toast({ title: "Post failed", description: err.message, variant: "destructive" });
    } finally {
      setPosting(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="font-bold text-sm flex items-center gap-2">
            {mediaType === "image" ? <Crop className="h-4 w-4 text-primary" /> : <Film className="h-4 w-4 text-primary" />}
            Media Editor
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 px-4 py-2 border-b border-border">
          {tabs.filter((t) => t.show).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "text-muted-foreground hover:bg-muted border border-transparent"
              }`}
            >
              <tab.icon className="h-3 w-3" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Editor content */}
        <div className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full">
          {activeTab === "crop" && hasMedia && mediaType === "image" && (
            <ImageEditor imageUrl={mediaUrl} onSave={handleEdited} />
          )}
          {activeTab === "trim" && hasMedia && mediaType === "video" && (
            <VideoTrimmer videoUrl={mediaUrl} onTrimmed={handleEdited} />
          )}
          {activeTab === "timeline" && (
            <ClipTimeline
              initialClip={hasMedia ? { url: mediaUrl, type: mediaType } : undefined}
              onRender={handleEdited}
            />
          )}
        </div>

        {/* Bottom actions */}
        {editedBlob && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="border-t border-border p-4"
          >
            {/* Edited preview */}
            {editedPreview && (
              <div className="mb-3 rounded-lg overflow-hidden bg-muted max-h-32 flex items-center justify-center">
                {editedBlob.type.startsWith("video/") ? (
                  <video src={editedPreview} className="max-h-32" controls muted />
                ) : (
                  <img src={editedPreview} alt="Edited" className="max-h-32 object-contain" />
                )}
              </div>
            )}
            <div className="flex gap-2 max-w-2xl mx-auto">
              <Button
                variant="outline"
                onClick={handleDownload}
                className="flex-1"
              >
                <Download className="h-4 w-4 mr-1" /> Download
              </Button>
              <Button
                onClick={handlePostToProfile}
                disabled={posting}
                className="flex-1 bg-gradient-purple text-primary-foreground font-bold hover:opacity-90"
              >
                {posting ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Posting...</>
                ) : (
                  <><Upload className="h-4 w-4 mr-1" /> Post to Profile</>
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default MediaEditor;
