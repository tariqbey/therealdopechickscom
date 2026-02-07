import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Save, Loader2, Sparkles, ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
    } else {
      await refreshProfile();
      toast({ title: "Profile updated!" });
      onSaved();
    }
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
          placeholder="Tell fans about yourself..."
          className="w-full h-20 bg-muted border border-border rounded-lg p-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full bg-gradient-purple text-primary-foreground font-bold hover:opacity-90">
        <Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save Profile"}
      </Button>
    </div>
  );
};

export default CreatorProfileEditor;
