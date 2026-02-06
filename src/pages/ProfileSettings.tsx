import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { User, Camera, Save, ArrowLeft } from "lucide-react";

const ProfileSettings = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [isCreator, setIsCreator] = useState(profile?.is_creator || false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || "");

  if (!user) {
    navigate("/auth");
    return null;
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 5MB", variant: "destructive" });
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });

    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
    } else {
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(publicUrl);
      toast({ title: "Avatar uploaded!" });
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      toast({ title: "Display name required", variant: "destructive" });
      return;
    }
    if (displayName.length > 50) {
      toast({ title: "Display name too long", description: "Max 50 characters", variant: "destructive" });
      return;
    }
    if (bio.length > 500) {
      toast({ title: "Bio too long", description: "Max 500 characters", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim(),
        bio: bio.trim(),
        is_creator: isCreator,
        avatar_url: avatarUrl || null,
      })
      .eq("user_id", user.id);

    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      await refreshProfile();
      toast({ title: "Profile updated!" });
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12 max-w-2xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>

          <h1 className="text-3xl font-black mb-6">Profile Settings</h1>

          <div className="rounded-xl bg-gradient-card border border-border p-6 space-y-6">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 rounded-full bg-muted border-2 border-border flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary/30 transition-colors"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div>
                <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                  {uploading ? "Uploading..." : "Change Avatar"}
                </Button>
                <p className="text-xs text-muted-foreground mt-1">JPG, PNG. Max 5MB.</p>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>

            {/* Display Name */}
            <div>
              <Label className="text-xs font-bold text-muted-foreground">Display Name</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={50} className="bg-muted border-border mt-1" />
              <p className="text-xs text-muted-foreground mt-1">{displayName.length}/50</p>
            </div>

            {/* Bio */}
            <div>
              <Label className="text-xs font-bold text-muted-foreground">Bio</Label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={500}
                placeholder="Tell the world about yourself..."
                className="w-full h-24 bg-muted border border-border rounded-lg p-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">{bio.length}/500</p>
            </div>

            {/* Account Type */}
            <div>
              <Label className="text-xs font-bold text-muted-foreground">Account Type</Label>
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => setIsCreator(false)}
                  className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors ${
                    !isCreator ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"
                  }`}
                >
                  <User className="h-4 w-4" /> Fan
                </button>
                <button
                  onClick={() => setIsCreator(true)}
                  className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors ${
                    isCreator ? "border-accent bg-accent/10 text-foreground" : "border-border text-muted-foreground"
                  }`}
                >
                  <Camera className="h-4 w-4" /> Creator
                </button>
              </div>
            </div>

            {/* Email (read-only) */}
            <div>
              <Label className="text-xs font-bold text-muted-foreground">Email</Label>
              <Input value={user.email || ""} disabled className="bg-muted border-border mt-1 opacity-60" />
              <p className="text-xs text-muted-foreground mt-1">Email cannot be changed here.</p>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full bg-gradient-purple text-primary-foreground font-bold hover:opacity-90">
              <Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </motion.div>
      </div>
      <Footer />
    </div>
  );
};

export default ProfileSettings;
