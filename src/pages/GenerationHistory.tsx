import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Image as ImageIcon, User, Video, Coins, Sparkles, X, Trash2, Play, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface Generation {
  id: string;
  generation_type: string;
  prompt: string | null;
  style_preset: string | null;
  result_url: string | null;
  cost: number;
  status: string;
  created_at: string;
}

const typeIcons: Record<string, React.ElementType> = {
  image: ImageIcon,
  character: User,
  video: Video,
};

const GenerationHistory = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Generation | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    const fetchGenerations = async () => {
      const { data } = await supabase
        .from("ai_generations")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      setGenerations((data as Generation[]) || []);
      setLoading(false);
    };

    fetchGenerations();
  }, [user, navigate]);

  const totalSpent = generations.reduce((sum, g) => sum + g.cost, 0);

  const handleDelete = async (gen: Generation) => {
    const { error } = await supabase.from("ai_generations").delete().eq("id", gen.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    setGenerations((prev) => prev.filter((g) => g.id !== gen.id));
    setSelected(null);
    toast({ title: "Deleted", description: "Generation removed." });
  };

  const handleAnimateToVideo = (imageUrl: string) => {
    navigate("/ai-studio", { state: { sourceImageUrl: imageUrl, tab: "video" } });
  };

  const handleDownload = (url: string, type: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `generation.${type === "video" ? "mp4" : "png"}`;
    a.target = "_blank";
    a.click();
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>

          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-black">Generation History</h1>
              <p className="text-muted-foreground text-sm">{generations.length} generations · {totalSpent} BREAD spent</p>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl bg-gradient-card border border-border p-4 animate-pulse h-48" />
              ))}
            </div>
          ) : generations.length === 0 ? (
            <div className="text-center py-16">
              <Sparkles className="h-12 w-12 text-primary/20 mx-auto mb-4" />
              <h3 className="font-bold mb-2">No generations yet</h3>
              <p className="text-sm text-muted-foreground mb-4">Head to AI Studio to create your first generation.</p>
              <button onClick={() => navigate("/ai-studio")} className="text-sm text-primary hover:underline">Go to AI Studio →</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {generations.map((gen) => {
                const Icon = typeIcons[gen.generation_type] || Sparkles;
                return (
                  <div
                    key={gen.id}
                    className="rounded-xl bg-gradient-card border border-border overflow-hidden hover:border-primary/30 transition-colors cursor-pointer group"
                    onClick={() => setSelected(gen)}
                  >
                    {/* Thumbnail */}
                    <div className="aspect-video bg-muted flex items-center justify-center relative overflow-hidden">
                      {gen.result_url ? (
                        gen.generation_type === "video" ? (
                          <>
                            <video src={gen.result_url} className="w-full h-full object-cover" muted />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Play className="h-10 w-10 text-white drop-shadow-lg" />
                            </div>
                          </>
                        ) : (
                          <>
                            <img src={gen.result_url} alt={gen.prompt || "Generation"} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <ImageIcon className="h-10 w-10 text-white drop-shadow-lg" />
                            </div>
                          </>
                        )
                      ) : (
                        <Icon className="h-10 w-10 text-muted-foreground/30" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-bold uppercase text-primary">{gen.generation_type}</span>
                        <span className={`ml-auto text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          gen.status === "completed" ? "bg-green-500/10 text-green-400" :
                          gen.status === "failed" ? "bg-destructive/10 text-destructive" :
                          "bg-accent/10 text-accent"
                        }`}>
                          {gen.status}
                        </span>
                      </div>
                      <p className="text-sm text-foreground line-clamp-2 mb-2">{gen.prompt || "—"}</p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Coins className="h-3 w-3 text-accent" />
                          <span className="font-bold text-gradient-gold">{gen.cost}</span>
                        </div>
                        <span>{new Date(gen.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
      <Footer />

      {/* Detail Lightbox */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
            onClick={() => setSelected(null)}
          >
            <button
              onClick={() => setSelected(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-background/20 hover:bg-background/40 text-white transition-colors z-50"
            >
              <X className="h-6 w-6" />
            </button>

            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card rounded-2xl border border-border overflow-hidden max-w-2xl w-full max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Media */}
              <div className="bg-muted flex items-center justify-center max-h-[60vh] overflow-hidden">
                {selected.result_url ? (
                  selected.generation_type === "video" ? (
                    <video src={selected.result_url} className="w-full max-h-[60vh] object-contain" controls autoPlay />
                  ) : (
                    <img src={selected.result_url} alt={selected.prompt || ""} className="w-full max-h-[60vh] object-contain" />
                  )
                ) : (
                  <div className="py-16 text-muted-foreground text-sm">No result available</div>
                )}
              </div>

              {/* Details & Actions */}
              <div className="p-5 space-y-4">
                {selected.prompt && (
                  <p className="text-sm text-foreground">{selected.prompt}</p>
                )}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="font-bold uppercase text-primary">{selected.generation_type}</span>
                  <span>·</span>
                  <span>{selected.cost} BREAD</span>
                  <span>·</span>
                  <span>{new Date(selected.created_at).toLocaleString()}</span>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {selected.result_url && selected.generation_type !== "video" && (
                    <Button
                      size="sm"
                      onClick={() => handleAnimateToVideo(selected.result_url!)}
                      className="bg-gradient-purple text-primary-foreground font-bold hover:opacity-90"
                    >
                      <Video className="h-3.5 w-3.5 mr-1" /> Animate to Video
                    </Button>
                  )}
                  {selected.result_url && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownload(selected.result_url!, selected.generation_type)}
                    >
                      <Download className="h-3.5 w-3.5 mr-1" /> Download
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(selected)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GenerationHistory;
