import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Crown, Plus, X, Search, Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface CreatorProfile {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  is_creator: boolean;
}

const AdminFeaturedTab = () => {
  const [allCreators, setAllCreators] = useState<CreatorProfile[]>([]);
  const [featuredIds, setFeaturedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [creatorsRes, settingRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, display_name, avatar_url, is_creator")
          .eq("is_creator", true)
          .order("display_name"),
        supabase
          .from("platform_settings")
          .select("*")
          .eq("key", "featured_creators")
          .maybeSingle(),
      ]);
      setAllCreators((creatorsRes.data as CreatorProfile[]) || []);
      if (settingRes.data) {
        setFeaturedIds((settingRes.data as any).value?.user_ids || []);
      }
      setLoading(false);
    };
    load();
  }, []);

  const save = async (ids: string[]) => {
    setSaving(true);
    const { error } = await supabase
      .from("platform_settings")
      .update({ value: { user_ids: ids } as any, updated_at: new Date().toISOString() })
      .eq("key", "featured_creators");
    if (error) {
      toast.error("Failed to save");
    } else {
      toast.success("Featured creators updated");
    }
    setSaving(false);
  };

  const addFeatured = (userId: string) => {
    const next = [...featuredIds, userId];
    setFeaturedIds(next);
    save(next);
  };

  const removeFeatured = (userId: string) => {
    const next = featuredIds.filter((id) => id !== userId);
    setFeaturedIds(next);
    save(next);
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const next = [...featuredIds];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setFeaturedIds(next);
    save(next);
  };

  const moveDown = (idx: number) => {
    if (idx >= featuredIds.length - 1) return;
    const next = [...featuredIds];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setFeaturedIds(next);
    save(next);
  };

  const featuredCreators = featuredIds
    .map((id) => allCreators.find((c) => c.user_id === id))
    .filter(Boolean) as CreatorProfile[];

  const availableCreators = allCreators.filter(
    (c) =>
      !featuredIds.includes(c.user_id) &&
      (!search ||
        (c.display_name || "").toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Current Featured */}
      <div className="rounded-xl bg-gradient-card border border-border p-6">
        <h3 className="text-lg font-display font-bold text-foreground mb-1 flex items-center gap-2">
          <Crown className="h-5 w-5 text-accent" /> Featured Creators
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          These creators appear on the homepage. Drag to reorder.
        </p>

        {featuredCreators.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <Star className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">No featured creators yet</p>
            <p className="text-xs mt-1">Add creators from the list below</p>
          </div>
        ) : (
          <div className="space-y-2">
            {featuredCreators.map((creator, idx) => (
              <div
                key={creator.user_id}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border"
              >
                <span className="text-xs font-bold text-muted-foreground w-6 text-center">
                  {idx + 1}
                </span>
                <div className="h-10 w-10 rounded-full overflow-hidden bg-muted shrink-0">
                  {creator.avatar_url ? (
                    <img src={creator.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs font-bold text-muted-foreground">
                      {(creator.display_name || "?")[0].toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {creator.display_name || "Unknown"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-xs text-muted-foreground"
                    onClick={() => moveUp(idx)}
                    disabled={idx === 0 || saving}
                  >
                    ↑
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-xs text-muted-foreground"
                    onClick={() => moveDown(idx)}
                    disabled={idx >= featuredCreators.length - 1 || saving}
                  >
                    ↓
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                    onClick={() => removeFeatured(creator.user_id)}
                    disabled={saving}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Creators */}
      <div className="rounded-xl bg-gradient-card border border-border p-6">
        <h3 className="text-lg font-display font-bold text-foreground mb-4 flex items-center gap-2">
          <Plus className="h-5 w-5 text-primary" /> Add to Featured
        </h3>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search creators..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {availableCreators.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {allCreators.length === 0
              ? "No creators registered yet"
              : "All creators are already featured"}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
            {availableCreators.map((creator) => (
              <button
                key={creator.user_id}
                onClick={() => addFeatured(creator.user_id)}
                disabled={saving}
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors text-left"
              >
                <div className="h-9 w-9 rounded-full overflow-hidden bg-muted shrink-0">
                  {creator.avatar_url ? (
                    <img src={creator.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs font-bold text-muted-foreground">
                      {(creator.display_name || "?")[0].toUpperCase()}
                    </div>
                  )}
                </div>
                <span className="text-sm font-medium text-foreground truncate flex-1">
                  {creator.display_name || "Unknown"}
                </span>
                <Plus className="h-4 w-4 text-primary shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {saving && (
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Saving…
        </div>
      )}
    </motion.div>
  );
};

export default AdminFeaturedTab;
