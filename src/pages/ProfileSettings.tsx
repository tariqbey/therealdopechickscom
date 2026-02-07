import { useState, useRef, useEffect } from "react";
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
import { useFormPersist } from "@/hooks/useFormPersist";
import { User, Camera, Save, ArrowLeft, Crown, ExternalLink, Sparkles, ImageIcon, Loader2, Shield } from "lucide-react";
import { PushNotificationSettings } from "@/components/PushNotificationSettings";
import ImageCropModal from "@/components/ImageCropModal";

const ProfileSettings = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useFormPersist("profile_displayName", profile?.display_name || "");
  const [bio, setBio] = useFormPersist("profile_bio", profile?.bio || "");
  const [isCreator, setIsCreator] = useFormPersist("profile_isCreator", profile?.is_creator || false);
  const [category, setCategory] = useFormPersist("profile_category", (profile as any)?.category || "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [generatingBio, setGeneratingBio] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [avatarUrl, setAvatarUrl] = useFormPersist("profile_avatarUrl", profile?.avatar_url || "");
  const [coverUrl, setCoverUrl] = useFormPersist("profile_coverUrl", (profile as any)?.cover_url || "");

  // Check admin role
  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  // Sync from profile when it loads/changes
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setBio(profile.bio || "");
      setIsCreator(profile.is_creator || false);
      setCategory((profile as any)?.category || "");
      setAvatarUrl(profile.avatar_url || "");
      setCoverUrl((profile as any)?.cover_url || "");
    }
  }, [profile]);

  // Crop modal state
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState("");
  const [cropTarget, setCropTarget] = useState<"avatar" | "cover">("avatar");

  if (!user) {
    navigate("/auth");
    return null;
  }

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast({ title: "File too large", description: "Max 5MB", variant: "destructive" }); return; }
    setCropImageSrc(URL.createObjectURL(file));
    setCropTarget("avatar");
    setCropModalOpen(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast({ title: "File too large", description: "Max 10MB", variant: "destructive" }); return; }
    setCropImageSrc(URL.createObjectURL(file));
    setCropTarget("cover");
    setCropModalOpen(true);
    if (coverInputRef.current) coverInputRef.current.value = "";
  };

  const handleCropComplete = async (blob: Blob) => {
    setCropModalOpen(false);
    const bucket = cropTarget === "avatar" ? "avatars" : "covers";
    const setUrl = cropTarget === "avatar" ? setAvatarUrl : setCoverUrl;
    const setUploadingFn = cropTarget === "avatar" ? setUploading : setUploadingCover;

    setUploadingFn(true);
    const path = `${user.id}/${cropTarget}.jpg`;
    const file = new File([blob], `${cropTarget}.jpg`, { type: "image/jpeg" });
    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
    } else {
      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
      setUrl(`${publicUrl}?t=${Date.now()}`);
      toast({ title: `${cropTarget === "avatar" ? "Avatar" : "Cover"} uploaded!` });
    }
    setUploadingFn(false);
  };

  const handleGenerateBio = async () => {
    setGeneratingBio(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-bio", {
        body: { displayName, currentBio: bio, isCreator },
      });
      if (error) throw error;
      if (data?.bio) {
        setBio(data.bio);
        toast({ title: "Bio generated!", description: "Review and edit if needed before saving." });
      }
    } catch (err: any) {
      toast({ title: "AI generation failed", description: err.message || "Try again later", variant: "destructive" });
    } finally {
      setGeneratingBio(false);
    }
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
        cover_url: coverUrl || null,
        category: isCreator && category ? category : null,
      } as any)
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
            {/* Cover / Banner Image */}
            <div>
              <Label className="text-xs font-bold text-muted-foreground mb-2 block">Cover / Banner Image</Label>
              <div
                onClick={() => coverInputRef.current?.click()}
                className="relative w-full h-36 md:h-48 rounded-xl border-2 border-dashed border-border bg-muted overflow-hidden cursor-pointer hover:border-primary/30 transition-colors group"
              >
                {coverUrl ? (
                  <>
                    <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-sm font-medium text-foreground">Change Cover</span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <ImageIcon className="h-8 w-8 mb-2" />
                    <span className="text-sm">Click to upload a banner image</span>
                    <span className="text-xs mt-1">Recommended: 1500 × 500px • Max 10MB</span>
                  </div>
                )}
                {uploadingCover && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )}
              </div>
              <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
            </div>

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
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs font-bold text-muted-foreground">Bio</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleGenerateBio}
                  disabled={generatingBio}
                  className="text-xs text-primary hover:text-primary/80 h-7 px-2"
                >
                  {generatingBio ? (
                    <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Generating...</>
                  ) : (
                    <><Sparkles className="h-3 w-3 mr-1" /> AI Assist</>
                  )}
                </Button>
              </div>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={500}
                placeholder="Tell the world about yourself — your personality, interests, what makes you unique..."
                className="w-full h-32 bg-muted border border-border rounded-lg p-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">{bio.length}/500 • AI Assist generates a detailed bio</p>
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

            {/* Category (Creators) */}
            {isCreator && (
              <div>
                <Label className="text-xs font-bold text-muted-foreground">Category <span className="text-destructive">*</span></Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {["Glamour", "Fitness", "Cosplay", "Fantasy", "Artistic", "Lifestyle", "AI Generated", "Exclusive"].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      className={`px-4 py-2 rounded-full text-xs font-medium border transition-colors ${
                        category === cat
                          ? "bg-primary/10 border-primary text-primary"
                          : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                {!category && <p className="text-xs text-destructive mt-1">Please select a category</p>}
              </div>
            )}

            {/* Email (read-only) */}
            <div>
              <Label className="text-xs font-bold text-muted-foreground">Email</Label>
              <Input value={user.email || ""} disabled className="bg-muted border-border mt-1 opacity-60" />
              <p className="text-xs text-muted-foreground mt-1">Email cannot be changed here.</p>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full bg-gradient-purple text-primary-foreground font-bold hover:opacity-90">
              <Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save Changes"}
            </Button>

            {/* Creator Links */}
            {isCreator && (
              <div className="flex flex-col gap-2 mt-2">
                <Button
                  variant="outline"
                  onClick={() => navigate("/settings/tiers")}
                  className="w-full border-accent/30 text-accent hover:bg-accent/10"
                >
                  <Crown className="h-4 w-4 mr-2" /> Manage Subscription Tiers
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate(`/creator/${(displayName || "").toLowerCase().replace(/\s+/g, "")}`)}
                  className="w-full border-primary/30 text-primary hover:bg-primary/10"
                >
                  <ExternalLink className="h-4 w-4 mr-2" /> View My Creator Profile
                </Button>
              </div>
            )}

            {/* Admin Link */}
            {isAdmin && (
              <div className="mt-2">
                <Button
                  variant="outline"
                  onClick={() => navigate("/admin")}
                  className="w-full border-destructive/30 text-destructive hover:bg-destructive/10"
                >
                  <Shield className="h-4 w-4 mr-2" /> Admin Panel
                </Button>
              </div>
            )}
          </div>

          {/* Push Notifications */}
          <PushNotificationSettings />
        </motion.div>
      </div>
      <Footer />

      {/* Image Crop Modal */}
      <ImageCropModal
        open={cropModalOpen}
        imageSrc={cropImageSrc}
        aspect={cropTarget === "avatar" ? 1 : 3}
        cropShape={cropTarget === "avatar" ? "round" : "rect"}
        title={cropTarget === "avatar" ? "Crop Avatar" : "Crop Cover Image"}
        onClose={() => setCropModalOpen(false)}
        onCropComplete={handleCropComplete}
      />
    </div>
  );
};

export default ProfileSettings;
