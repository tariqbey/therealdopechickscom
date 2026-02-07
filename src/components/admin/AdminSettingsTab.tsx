import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Settings, ToggleLeft, Eye, UserCircle, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const AdminSettingsTab = () => {
  const [showDummy, setShowDummy] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from("platform_settings" as any)
        .select("*")
        .eq("key", "show_dummy_content")
        .maybeSingle();
      if (data) {
        setShowDummy((data as any).value?.enabled ?? true);
      }
      setLoading(false);
    };
    fetchSettings();
  }, []);

  const toggleDummyContent = async (enabled: boolean) => {
    setSaving(true);
    setShowDummy(enabled);
    const { error } = await supabase
      .from("platform_settings" as any)
      .update({ value: { enabled }, updated_at: new Date().toISOString() } as any)
      .eq("key", "show_dummy_content");
    if (error) {
      toast.error("Failed to update setting");
      setShowDummy(!enabled);
    } else {
      toast.success(`Dummy content ${enabled ? "enabled" : "disabled"}`);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-pulse text-muted-foreground">Loading settings…</div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Dummy Content Toggle */}
      <div className="rounded-xl bg-gradient-card border border-border p-6">
        <h3 className="text-lg font-display font-bold text-foreground mb-4 flex items-center gap-2">
          <ToggleLeft className="h-5 w-5 text-primary" /> Content Display
        </h3>
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-border">
          <div>
            <Label className="text-sm font-medium text-foreground">Show Dummy/Placeholder Content</Label>
            <p className="text-xs text-muted-foreground mt-1">
              When enabled, placeholder images and sample content will appear on creator profiles that don't have real content yet.
            </p>
          </div>
          <Switch
            checked={showDummy}
            onCheckedChange={toggleDummyContent}
            disabled={saving}
          />
        </div>
      </div>

      {/* View As Section */}
      <div className="rounded-xl bg-gradient-card border border-border p-6">
        <h3 className="text-lg font-display font-bold text-foreground mb-4 flex items-center gap-2">
          <Eye className="h-5 w-5 text-accent" /> View Platform As
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Experience the platform from different user perspectives. This opens the site in a new view while keeping your admin session.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col items-center gap-2 border-primary/30 hover:bg-primary/10"
            onClick={() => navigate("/?viewAs=fan")}
          >
            <UserCircle className="h-6 w-6 text-primary" />
            <span className="font-medium">View as Fan</span>
            <span className="text-xs text-muted-foreground">See what fans experience</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col items-center gap-2 border-accent/30 hover:bg-accent/10"
            onClick={() => navigate("/?viewAs=creator")}
          >
            <Crown className="h-6 w-6 text-accent" />
            <span className="font-medium">View as Creator</span>
            <span className="text-xs text-muted-foreground">See the creator experience</span>
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default AdminSettingsTab;
