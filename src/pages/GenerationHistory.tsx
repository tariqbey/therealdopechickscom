import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Image as ImageIcon, User, Video, Coins, Sparkles } from "lucide-react";

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
                  <div key={gen.id} className="rounded-xl bg-gradient-card border border-border overflow-hidden hover:border-primary/30 transition-colors">
                    {/* Thumbnail */}
                    <div className="aspect-video bg-muted flex items-center justify-center">
                      {gen.result_url ? (
                        gen.generation_type === "video" ? (
                          <video src={gen.result_url} className="w-full h-full object-cover" muted />
                        ) : (
                          <img src={gen.result_url} alt={gen.prompt || "Generation"} className="w-full h-full object-cover" />
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
    </div>
  );
};

export default GenerationHistory;
