import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Save, Loader2, Sparkles, ImageIcon, Plus, Trash2, DollarSign, Crown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TierRow {
  id: string;
  tier_name: string;
  price_cents: number;
  description: string;
  is_active: boolean;
  isNew?: boolean;
}

interface CreatorProfileEditorProps {
  onSaved: () => void;
}

const CreatorProfileEditor = ({ onSaved }: CreatorProfileEditorProps) => {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || "");
  const [coverUrl, setCoverUrl] = useState(profile?.cover_url || "");
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [generatingBio, setGeneratingBio] = useState(false);
  const [tiers, setTiers] = useState<TierRow[]>([]);
  const [loadingTiers, setLoadingTiers] = useState(true);

  useEffect(() => {
    if (!user) return;
    const loadTiers = async () => {
      setLoadingTiers(true);
      const { data } = await supabase
        .from("creator_subscription_tiers")
        .select("*")
        .eq("creator_id", user.id)
        .order("price_cents", { ascending: true });
      if (data && data.length > 0) {
        setTiers(data.map((t) => ({ ...t, description: t.description || "" })));
      } else {
        setTiers([
          { id: "new-0", tier_name: "Bronze", price_cents: 499, description: "Access to basic posts", is_active: true, isNew: true },
          { id: "new-1", tier_name: "Silver", price_cents: 999, description: "Exclusive content & priority DMs", is_active: true, isNew: true },
          { id: "new-2", tier_name: "Gold", price_cents: 2499, description: "Custom requests & 1-on-1 calls", is_active: true, isNew: true },
        ]);
      }
      setLoadingTiers(false);
    };
    loadTiers();
  }, [user]);

  if (!user) return null;

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 10MB", variant: "destructive" });
      return;
    }
    setUploadingCover(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/cover.${ext}`;
    const { error } = await supabase.storage.from("covers").upload(path, file, { upsert: true });
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } else {
      const { data: { publicUrl } } = supabase.storage.from("covers").getPublicUrl(path);
      setCoverUrl(publicUrl);
      toast({ title: "Cover uploaded!" });
    }
    setUploadingCover(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 5MB", variant: "destructive" });
      return;
    }
    setUploadingAvatar(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } else {
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(publicUrl);
      toast({ title: "Avatar uploaded!" });
    }
    setUploadingAvatar(false);
  };

  const handleGenerateBio = async () => {
    setGeneratingBio(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-bio", {
        body: { displayName, currentBio: bio, isCreator: true },
      });
      if (error) throw error;
      if (data?.bio) {
        setBio(data.bio);
        toast({ title: "Bio generated!" });
      }
    } catch (err: any) {
      toast({ title: "AI failed", description: err.message, variant: "destructive" });
    }
    setGeneratingBio(false);
  };

  const handleSave = async () => {
    setSaving(true);
    // Save profile
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim(),
        bio: bio.trim(),
        avatar_url: avatarUrl || null,
        cover_url: coverUrl || null,
      } as any)
      .eq("user_id", user.id);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    // Save tiers
    try {
      for (const tier of tiers) {
        if (tier.price_cents < 499) continue;
        if (tier.isNew) {
          await supabase.from("creator_subscription_tiers").insert({
            creator_id: user.id,
            tier_name: tier.tier_name,
            price_cents: tier.price_cents,
            description: tier.description,
            is_active: tier.is_active,
          });
        } else {
          await supabase.from("creator_subscription_tiers").update({
            tier_name: tier.tier_name,
            price_cents: tier.price_cents,
            description: tier.description,
            is_active: tier.is_active,
          }).eq("id", tier.id);
        }
      }
    } catch (e: any) {
      toast({ title: "Tier save error", description: e.message, variant: "destructive" });
    }

    await refreshProfile();
    toast({ title: "Profile & tiers updated!" });
    onSaved();
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      {/* Cover */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">Cover Image</Label>
        <div
          onClick={() => coverInputRef.current?.click()}
          className="relative w-full h-32 rounded-xl border-2 border-dashed border-border bg-muted overflow-hidden cursor-pointer hover:border-primary/30 transition-colors group"
        >
          {coverUrl ? (
            <>
              <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-sm font-medium">Change Cover</span>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <ImageIcon className="h-6 w-6 mb-1" />
              <span className="text-xs">Upload cover image</span>
            </div>
          )}
          {uploadingCover && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}
        </div>
        <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-3">
        <div
          onClick={() => avatarInputRef.current?.click()}
          className="w-16 h-16 rounded-full bg-muted border-2 border-border overflow-hidden cursor-pointer hover:border-primary/30 transition-colors"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <div className="flex items-center justify-center h-full"><Camera className="h-6 w-6 text-muted-foreground" /></div>
          )}
        </div>
        <Button variant="outline" size="sm" disabled={uploadingAvatar} onClick={() => avatarInputRef.current?.click()}>
          {uploadingAvatar ? "Uploading..." : "Change Avatar"}
        </Button>
        <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
      </div>

      {/* Name */}
      <div>
        <Label className="text-xs text-muted-foreground">Display Name</Label>
        <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={50} className="bg-muted border-border mt-1" />
      </div>

      {/* Bio */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <Label className="text-xs text-muted-foreground">Bio</Label>
          <Button variant="ghost" size="sm" onClick={handleGenerateBio} disabled={generatingBio} className="text-xs text-primary h-6 px-2">
            {generatingBio ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Sparkles className="h-3 w-3 mr-1" /> AI Assist</>}
          </Button>
        </div>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={500}
          placeholder="Tell fans about yourself — your personality, content style, what makes you unique..."
          className="w-full h-32 bg-muted border border-border rounded-lg p-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <p className="text-xs text-muted-foreground mt-1">{bio.length}/500 • AI Assist generates a detailed 3-5 sentence bio</p>
      </div>

      {/* Subscription Tiers */}
      <div className="border-t border-border pt-5 mt-2">
        <div className="flex items-center justify-between mb-3">
          <Label className="text-sm font-bold text-foreground flex items-center gap-2">
            <Crown className="h-4 w-4 text-accent" /> Subscription Tiers
          </Label>
        </div>
        {loadingTiers ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-3">
            {tiers.map((tier, i) => (
              <div key={tier.id} className="rounded-lg border border-border bg-muted/50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <input
                    value={tier.tier_name}
                    onChange={(e) => setTiers(tiers.map((t, idx) => idx === i ? { ...t, tier_name: e.target.value } : t))}
                    placeholder="Tier name"
                    className="bg-transparent font-bold text-sm text-foreground placeholder:text-muted-foreground focus:outline-none w-32"
                  />
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                      <input
                        type="number"
                        step="0.01"
                        min="4.99"
                        value={(tier.price_cents / 100).toFixed(2)}
                        onChange={(e) => {
                          const val = Math.max(499, Math.round(parseFloat(e.target.value || "0") * 100));
                          setTiers(tiers.map((t, idx) => idx === i ? { ...t, price_cents: val } : t));
                        }}
                        className="w-20 bg-muted border border-border rounded-md p-1.5 pl-6 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">/mo</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => {
                      if (!tier.isNew) {
                        supabase.from("creator_subscription_tiers").update({ is_active: false }).eq("id", tier.id);
                      }
                      setTiers(tiers.filter((_, idx) => idx !== i));
                    }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <input
                  value={tier.description}
                  onChange={(e) => setTiers(tiers.map((t, idx) => idx === i ? { ...t, description: e.target.value } : t))}
                  placeholder="What fans get with this tier..."
                  className="w-full bg-transparent text-xs text-muted-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </div>
            ))}
            {tiers.length < 5 && (
              <Button variant="outline" size="sm" onClick={() => setTiers([...tiers, { id: `new-${Date.now()}`, tier_name: "", price_cents: 499, description: "", is_active: true, isNew: true }])} className="w-full border-dashed text-xs">
                <Plus className="h-3 w-3 mr-1" /> Add Tier
              </Button>
            )}
            <p className="text-[10px] text-muted-foreground">Minimum price: $4.99/mo</p>
          </div>
        )}
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full bg-gradient-purple text-primary-foreground font-bold hover:opacity-90">
        <Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save Profile & Tiers"}
      </Button>
    </div>
  );
};

export default CreatorProfileEditor;
