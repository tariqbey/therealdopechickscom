import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Image as ImageIcon, Video, Download, Wand2, Plus,
  X, Loader2, Eye, Layers, ExternalLink, Film,
} from "lucide-react";

interface LibraryItem {
  id: string;
  result_url: string;
  generation_type: string;
  prompt: string | null;
  created_at: string;
  style_preset: string | null;
  aspect_ratio: string | null;
}

interface ContentLibraryProps {
  onAnimateToVideo: (imageUrl: string) => void;
  onEditInTimeline?: (url: string, type: "image" | "video") => void;
  onClose: () => void;
}

const ContentLibrary = ({ onAnimateToVideo, onEditInTimeline, onClose }: ContentLibraryProps) => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "image" | "video" | "character">("all");
  const [previewItem, setPreviewItem] = useState<LibraryItem | null>(null);
  const [addingToProfile, setAddingToProfile] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("ai_generations")
        .select("id, result_url, generation_type, prompt, created_at, style_preset, aspect_ratio")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .not("result_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(100);
      setItems((data as LibraryItem[]) || []);
      setLoading(false);
    };
    load();
  }, [user]);

  const filtered = filter === "all" ? items : items.filter((i) => i.generation_type === filter);

  const handleDownload = async (item: LibraryItem) => {
    try {
      const response = await fetch(item.result_url);
      const blob = await response.blob();
      const ext = item.generation_type === "video" ? "mp4" : "png";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dopechicks-${item.id.slice(0, 8)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Download started!" });
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    }
  };

  const handleAddToProfile = async (item: LibraryItem) => {
    if (!user || !profile?.is_creator) {
      toast({ title: "Creator account required", description: "Only creators can post to their profile.", variant: "destructive" });
      return;
    }
    setAddingToProfile(item.id);
    try {
      const mediaType = item.generation_type === "video" ? "video" : "photo";
      const { error } = await supabase
        .from("creator_posts" as any)
        .insert({
          creator_id: user.id,
          title: item.prompt?.slice(0, 100) || "AI Generated Content",
          description: item.prompt || null,
          media_url: item.result_url,
          media_type: mediaType,
          is_locked: false,
          min_tier: null,
        } as any);
      if (error) throw error;
      toast({ title: "Added to your profile!", description: "Content is now visible on your creator page." });
    } catch (err: any) {
      toast({ title: "Failed to add", description: err.message, variant: "destructive" });
    } finally {
      setAddingToProfile(null);
    }
  };

  const filters = [
    { key: "all" as const, label: "All", icon: Layers },
    { key: "image" as const, label: "Images", icon: ImageIcon },
    { key: "video" as const, label: "Videos", icon: Video },
    { key: "character" as const, label: "Characters", icon: Wand2 },
  ];

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-gradient-card border border-border p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-foreground flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" /> Content Library
          </h3>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                filter === f.key
                  ? "border-primary text-primary bg-primary/10"
                  : "border-border text-muted-foreground hover:border-primary/30"
              }`}
            >
              <f.icon className="h-3 w-3" />
              {f.label}
              {f.key === "all" && <span className="text-[10px] opacity-60">({items.length})</span>}
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-muted-foreground">
            <ImageIcon className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm font-medium">No content yet</p>
            <p className="text-xs mt-1">Generate images & videos in the studio above!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[60vh] overflow-y-auto pr-1">
            {filtered.map((item) => {
              const isVideo = item.generation_type === "video";
              return (
                <div key={item.id} className="relative aspect-square rounded-xl overflow-hidden border border-border group cursor-pointer hover:border-primary/30 transition-all hover:shadow-lg">
                  {isVideo ? (
                    <video src={item.result_url} className="w-full h-full object-cover" muted playsInline />
                  ) : (
                    <img src={item.result_url} alt="" className="w-full h-full object-cover" />
                  )}

                  {/* Type badge */}
                  <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-background/80 backdrop-blur-sm">
                    {isVideo ? <Video className="h-3 w-3 text-primary" /> : <ImageIcon className="h-3 w-3 text-primary" />}
                    <span className="text-[10px] font-medium">{isVideo ? "Video" : item.generation_type === "character" ? "Character" : "Image"}</span>
                  </div>

                  {/* Hover overlay with actions */}
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                    {/* Preview */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] w-full max-w-[140px]"
                      onClick={() => setPreviewItem(item)}
                    >
                      <Eye className="h-3 w-3 mr-1" /> Preview
                    </Button>

                    {/* Download */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] w-full max-w-[140px]"
                      onClick={() => handleDownload(item)}
                    >
                      <Download className="h-3 w-3 mr-1" /> Download
                    </Button>

                    {/* Animate (images only) */}
                    {!isVideo && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] w-full max-w-[140px]"
                        onClick={() => { onAnimateToVideo(item.result_url); onClose(); }}
                      >
                        <Video className="h-3 w-3 mr-1" /> Animate
                      </Button>
                    )}

                    {/* Edit in Timeline */}
                    {onEditInTimeline && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] w-full max-w-[140px]"
                        onClick={() => { onEditInTimeline(item.result_url, isVideo ? "video" : "image"); onClose(); }}
                      >
                        <Film className="h-3 w-3 mr-1" /> Edit in Timeline
                      </Button>
                    )}

                    {/* Add to Profile */}
                    {profile?.is_creator && (
                      <Button
                        size="sm"
                        className="h-7 text-[11px] w-full max-w-[140px] bg-gradient-purple text-primary-foreground hover:opacity-90"
                        disabled={addingToProfile === item.id}
                        onClick={() => handleAddToProfile(item)}
                      >
                        {addingToProfile === item.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <><Plus className="h-3 w-3 mr-1" /> Add to Profile</>
                        )}
                      </Button>
                    )}

                    {/* Prompt */}
                    <span className="text-[10px] text-muted-foreground truncate max-w-full px-1 mt-1">
                      {item.prompt?.slice(0, 50) || "No prompt"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Lightbox Preview */}
      <AnimatePresence>
        {previewItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md p-4"
            onClick={() => setPreviewItem(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-4xl max-h-[90vh] w-full rounded-2xl overflow-hidden border border-border bg-card shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => setPreviewItem(null)}
                className="absolute top-3 right-3 z-10 p-2 rounded-full bg-background/80 hover:bg-background text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Media */}
              <div className="flex items-center justify-center bg-muted min-h-[300px] max-h-[70vh]">
                {previewItem.generation_type === "video" ? (
                  <video
                    src={previewItem.result_url}
                    controls
                    autoPlay
                    className="max-w-full max-h-[70vh] object-contain"
                  />
                ) : (
                  <img
                    src={previewItem.result_url}
                    alt=""
                    className="max-w-full max-h-[70vh] object-contain"
                  />
                )}
              </div>

              {/* Info & actions bar */}
              <div className="p-4 border-t border-border space-y-3">
                <div>
                  <p className="text-sm text-foreground font-medium">{previewItem.prompt || "No prompt"}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      {previewItem.generation_type === "video" ? <Video className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                      {previewItem.generation_type}
                    </span>
                    {previewItem.style_preset && <span>Style: {previewItem.style_preset}</span>}
                    {previewItem.aspect_ratio && <span>Ratio: {previewItem.aspect_ratio}</span>}
                    <span>{new Date(previewItem.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleDownload(previewItem)}>
                    <Download className="h-4 w-4 mr-1" /> Download
                  </Button>
                  {previewItem.generation_type !== "video" && (
                    <Button size="sm" variant="outline" onClick={() => { onAnimateToVideo(previewItem.result_url); onClose(); setPreviewItem(null); }}>
                      <Video className="h-4 w-4 mr-1" /> Animate to Video
                    </Button>
                  )}
                  {onEditInTimeline && (
                    <Button size="sm" variant="outline" onClick={() => { onEditInTimeline(previewItem.result_url, previewItem.generation_type === "video" ? "video" : "image"); onClose(); setPreviewItem(null); }}>
                      <Film className="h-4 w-4 mr-1" /> Edit in Timeline
                    </Button>
                  )}
                  {profile?.is_creator && (
                    <Button
                      size="sm"
                      className="bg-gradient-purple text-primary-foreground hover:opacity-90"
                      disabled={addingToProfile === previewItem.id}
                      onClick={() => handleAddToProfile(previewItem)}
                    >
                      {addingToProfile === previewItem.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <><Plus className="h-4 w-4 mr-1" /> Add to Profile</>
                      )}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => window.open(previewItem.result_url, "_blank")}>
                    <ExternalLink className="h-4 w-4 mr-1" /> Open Original
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ContentLibrary;
