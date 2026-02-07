import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Loader2, Image as ImageIcon, Video, Check, X } from "lucide-react";

interface Generation {
  id: string;
  result_url: string;
  generation_type: string;
  prompt: string | null;
  created_at: string;
}

interface LibraryPickerProps {
  onSelect: (items: { url: string; type: "photo" | "video" }[]) => void;
  onClose: () => void;
}

const LibraryPicker = ({ onSelect, onClose }: LibraryPickerProps) => {
  const { user } = useAuth();
  const [items, setItems] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("ai_generations")
        .select("id, result_url, generation_type, prompt, created_at")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .not("result_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(50);
      setItems((data as Generation[]) || []);
      setLoading(false);
    };
    load();
  }, [user]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    const picked = items
      .filter((i) => selected.has(i.id))
      .map((i) => ({
        url: i.result_url,
        type: (i.generation_type === "video" ? "video" : "photo") as "photo" | "video",
      }));
    onSelect(picked);
  };

  return (
    <div className="rounded-xl bg-gradient-card border border-border p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-primary" /> Your AI Library
        </h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-8">
          No generated content yet. Head to AI Studio to create images & videos!
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">Tap to select items to add to your profile.</p>
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2 max-h-64 overflow-y-auto">
            {items.map((item) => {
              const isVideo = item.generation_type === "video";
              const isSelected = selected.has(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => toggleSelect(item.id)}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-colors ${
                    isSelected ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/30"
                  }`}
                >
                  {isVideo ? (
                    <video src={item.result_url} className="w-full h-full object-cover" muted />
                  ) : (
                    <img src={item.result_url} alt="" className="w-full h-full object-cover" />
                  )}
                  <div className="absolute top-1 left-1">
                    {isVideo ? (
                      <Video className="h-3 w-3 text-primary-foreground drop-shadow-md" />
                    ) : (
                      <ImageIcon className="h-3 w-3 text-primary-foreground drop-shadow-md" />
                    )}
                  </div>
                  {isSelected && (
                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                      <Check className="h-6 w-6 text-primary" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <Button
            onClick={handleConfirm}
            disabled={selected.size === 0}
            className="w-full bg-gradient-purple text-primary-foreground font-bold hover:opacity-90"
            size="sm"
          >
            Add {selected.size} item{selected.size !== 1 ? "s" : ""} to Profile
          </Button>
        </>
      )}
    </div>
  );
};

export default LibraryPicker;
