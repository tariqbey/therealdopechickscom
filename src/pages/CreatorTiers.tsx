import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Crown, Plus, Trash2, Save, Loader2, DollarSign } from "lucide-react";

interface TierRow {
  id: string;
  tier_name: string;
  price_cents: number;
  description: string;
  is_active: boolean;
  isNew?: boolean;
}

const defaultTierTemplates = [
  { tier_name: "Bronze", price_cents: 499, description: "Access to basic posts, like & comment" },
  { tier_name: "Silver", price_cents: 999, description: "Exclusive photo sets, behind-the-scenes, priority DMs" },
  { tier_name: "Gold", price_cents: 2499, description: "Custom requests, 1-on-1 calls, early access, merch discounts" },
];

const CreatorTiers = () => {
  const [tiers, setTiers] = useState<TierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    if (profile && !profile.is_creator) {
      toast({ title: "Creator access only", description: "You need a creator account to manage tiers.", variant: "destructive" });
      navigate("/");
      return;
    }
    loadTiers();
  }, [user, profile]);

  const loadTiers = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("creator_subscription_tiers")
      .select("*")
      .eq("creator_id", user.id)
      .order("price_cents", { ascending: true });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    if (data && data.length > 0) {
      setTiers(data.map((t) => ({ ...t, description: t.description || "" })));
    } else {
      // Pre-populate with defaults
      setTiers(defaultTierTemplates.map((t, i) => ({
        id: `new-${i}`,
        ...t,
        is_active: true,
        isNew: true,
      })));
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      for (const tier of tiers) {
        if (tier.isNew) {
          const { error } = await supabase.from("creator_subscription_tiers").insert({
            creator_id: user.id,
            tier_name: tier.tier_name,
            price_cents: tier.price_cents,
            description: tier.description,
            is_active: tier.is_active,
          });
          if (error) throw error;
        } else {
          const { error } = await supabase.from("creator_subscription_tiers").update({
            tier_name: tier.tier_name,
            price_cents: tier.price_cents,
            description: tier.description,
            is_active: tier.is_active,
          }).eq("id", tier.id);
          if (error) throw error;
        }
      }

      toast({ title: "Tiers saved!", description: "Your subscription tiers have been updated." });
      loadTiers();
    } catch (err: any) {
      toast({ title: "Error saving", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const addTier = () => {
    setTiers([...tiers, {
      id: `new-${Date.now()}`,
      tier_name: "",
      price_cents: 999,
      description: "",
      is_active: true,
      isNew: true,
    }]);
  };

  const removeTier = async (index: number) => {
    const tier = tiers[index];
    if (!tier.isNew) {
      const { error } = await supabase
        .from("creator_subscription_tiers")
        .update({ is_active: false })
        .eq("id", tier.id);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
    }
    setTiers(tiers.filter((_, i) => i !== index));
  };

  const updateTier = (index: number, field: keyof TierRow, value: any) => {
    setTiers(tiers.map((t, i) => i === index ? { ...t, [field]: value } : t));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12 max-w-2xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-2">
            <Crown className="h-5 w-5 text-accent" />
            <span className="text-xs font-bold uppercase tracking-widest text-accent">Creator Settings</span>
          </div>
          <h1 className="text-4xl font-black mb-2">Subscription Tiers</h1>
          <p className="text-muted-foreground mb-8">Set up pricing for your fans. Changes are saved to Stripe automatically.</p>

          <div className="space-y-4">
            {tiers.map((tier, index) => (
              <div key={tier.id} className="rounded-xl bg-card border border-border p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg">{tier.tier_name || `Tier ${index + 1}`}</h3>
                  <Button variant="ghost" size="icon" onClick={() => removeTier(index)} className="text-destructive hover:text-destructive/80">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground">Tier Name</label>
                    <input
                      value={tier.tier_name}
                      onChange={(e) => updateTier(index, "tier_name", e.target.value)}
                      placeholder="e.g., Bronze"
                      className="w-full bg-muted border border-border rounded-lg p-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground">Price ($/month)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="number"
                        step="0.01"
                        value={(tier.price_cents / 100).toFixed(2)}
                        onChange={(e) => updateTier(index, "price_cents", Math.round(parseFloat(e.target.value || "0") * 100))}
                        className="w-full bg-muted border border-border rounded-lg p-2.5 pl-8 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">Description</label>
                  <textarea
                    value={tier.description}
                    onChange={(e) => updateTier(index, "description", e.target.value)}
                    placeholder="What fans get with this tier..."
                    className="w-full h-20 bg-muted border border-border rounded-lg p-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            ))}
          </div>

          {tiers.length < 5 && (
            <Button variant="outline" onClick={addTier} className="w-full mt-4 border-dashed border-border">
              <Plus className="h-4 w-4 mr-2" /> Add Tier
            </Button>
          )}

          <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-border">
            <Button variant="outline" onClick={() => navigate("/settings")}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-gradient-purple text-primary-foreground font-bold hover:opacity-90">
              {saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Saving...</> : <><Save className="h-4 w-4 mr-1" /> Save Tiers</>}
            </Button>
          </div>
        </motion.div>
      </div>
      <Footer />
    </div>
  );
};

export default CreatorTiers;
