import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Camera, Save, Loader2, Sparkles, ImageIcon, Plus, Trash2, DollarSign,
  Crown, Eye, Wand2, MapPin, Briefcase, Heart, Ruler, User2,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import ImageCropModal from "@/components/ImageCropModal";

interface TierRow {
  id: string;
  tier_name: string;
  price_cents: number;
  description: string;
  is_active: boolean;
  isNew?: boolean;
  perks: string[];
}

interface CreatorProfileEditorProps {
  onSaved: () => void;
}

const buildOptions = ["Slim", "Petite", "Athletic", "Curvy", "Average", "Plus-size", "Muscular"];
const complexionOptions = ["Fair", "Light", "Medium", "Olive", "Tan", "Brown", "Dark"];
const eyeColorOptions = ["Brown", "Blue", "Green", "Hazel", "Gray", "Amber", "Black"];
const hairColorOptions = ["Black", "Brown", "Blonde", "Red", "Auburn", "Platinum", "Gray", "Pink", "Other"];
const zodiacOptions = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];

const tierTemplates = [
  { tier_name: "Bronze", price_cents: 499, description: "Basic access for new fans", perks: ["Access to basic posts", "Like & comment", "Monthly newsletter"] },
  { tier_name: "Silver", price_cents: 999, description: "Exclusive content & priority access", perks: ["Everything in Bronze", "Exclusive photo sets", "Behind-the-scenes content", "Priority DMs"] },
  { tier_name: "Gold", price_cents: 2499, description: "VIP all-access experience", perks: ["Everything in Silver", "Custom content requests", "1-on-1 video calls", "Early access to new drops", "Exclusive merch discounts"] },
];

const CreatorProfileEditor = ({ onSaved }: CreatorProfileEditorProps) => {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Basic profile
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || "");
  const [coverUrl, setCoverUrl] = useState(profile?.cover_url || "");

  // Extended profile
  const [height, setHeight] = useState("");
  const [build, setBuild] = useState("");
  const [complexion, setComplexion] = useState("");
  const [eyeColor, setEyeColor] = useState("");
  const [hairColor, setHairColor] = useState("");
  const [ethnicity, setEthnicity] = useState("");
  const [profession, setProfession] = useState("");
  const [interests, setInterests] = useState("");
  const [likes, setLikes] = useState("");
  const [measurements, setMeasurements] = useState("");
  const [location, setLocation] = useState("");
  const [zodiacSign, setZodiacSign] = useState("");

  // State
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [generatingBio, setGeneratingBio] = useState(false);
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [tiers, setTiers] = useState<TierRow[]>([]);
  const [loadingTiers, setLoadingTiers] = useState(true);
  const [activeSection, setActiveSection] = useState<"profile" | "details" | "tiers">("profile");

  // Crop modal state
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState("");
  const [cropTarget, setCropTarget] = useState<"avatar" | "cover">("avatar");

  // Load extended profile data
  useEffect(() => {
    if (!user) return;
    const loadExtended = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("height, build, complexion, eye_color, hair_color, ethnicity, profession, interests, likes, measurements, location, zodiac_sign" as any)
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        const d = data as any;
        setHeight(d.height || "");
        setBuild(d.build || "");
        setComplexion(d.complexion || "");
        setEyeColor(d.eye_color || "");
        setHairColor(d.hair_color || "");
        setEthnicity(d.ethnicity || "");
        setProfession(d.profession || "");
        setInterests((d.interests || []).join(", "));
        setLikes((d.likes || []).join(", "));
        setMeasurements(d.measurements || "");
        setLocation(d.location || "");
        setZodiacSign(d.zodiac_sign || "");
      }
    };
    loadExtended();
  }, [user]);

  // Load tiers
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
        setTiers(data.map((t) => ({
          ...t,
          description: t.description || "",
          perks: t.description?.includes("•") ? t.description.split("•").map((s: string) => s.trim()).filter(Boolean) : [t.description || ""],
        })));
      } else {
        setTiers(tierTemplates.map((t, i) => ({
          id: `new-${i}`,
          ...t,
          is_active: true,
          isNew: true,
        })));
      }
      setLoadingTiers(false);
    };
    loadTiers();
  }, [user]);

  if (!user) return null;

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast({ title: "File too large", description: "Max 10MB", variant: "destructive" }); return; }
    const objectUrl = URL.createObjectURL(file);
    setCropImageSrc(objectUrl);
    setCropTarget("cover");
    setCropModalOpen(true);
    if (coverInputRef.current) coverInputRef.current.value = "";
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast({ title: "File too large", description: "Max 5MB", variant: "destructive" }); return; }
    const objectUrl = URL.createObjectURL(file);
    setCropImageSrc(objectUrl);
    setCropTarget("avatar");
    setCropModalOpen(true);
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  };

  const handleCropComplete = async (blob: Blob) => {
    setCropModalOpen(false);
    const bucket = cropTarget === "avatar" ? "avatars" : "covers";
    const setUrl = cropTarget === "avatar" ? setAvatarUrl : setCoverUrl;
    const setUploading = cropTarget === "avatar" ? setUploadingAvatar : setUploadingCover;

    setUploading(true);
    const path = `${user.id}/${cropTarget}.jpg`;
    const file = new File([blob], `${cropTarget}.jpg`, { type: "image/jpeg" });
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } else {
      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
      // Add cache buster
      setUrl(`${publicUrl}?t=${Date.now()}`);
      toast({ title: `${cropTarget === "avatar" ? "Avatar" : "Cover"} uploaded!` });
    }
    setUploading(false);
  };

  const handleGenerateBio = async () => {
    setGeneratingBio(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-bio", {
        body: { displayName, currentBio: bio, isCreator: true },
      });
      if (error) throw error;
      if (data?.bio) { setBio(data.bio); toast({ title: "Bio generated!" }); }
    } catch (err: any) {
      toast({ title: "AI failed", description: err.message, variant: "destructive" });
    }
    setGeneratingBio(false);
  };

  const handleAnalyzeImage = async () => {
    const imageToAnalyze = avatarUrl || coverUrl;
    if (!imageToAnalyze) {
      toast({ title: "Upload a photo first", description: "Upload an avatar or cover photo so AI can analyze it.", variant: "destructive" });
      return;
    }
    setAnalyzingImage(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-profile-image", {
        body: { imageUrl: imageToAnalyze },
      });
      if (error) throw error;
      const attrs = data?.attributes;
      if (attrs) {
        if (attrs.height) setHeight(attrs.height);
        if (attrs.build) setBuild(attrs.build);
        if (attrs.complexion) setComplexion(attrs.complexion);
        if (attrs.eye_color) setEyeColor(attrs.eye_color);
        if (attrs.hair_color) setHairColor(attrs.hair_color);
        if (attrs.ethnicity) setEthnicity(attrs.ethnicity);
        toast({ title: "AI analysis complete!", description: "Review the auto-populated fields and adjust as needed." });
        setActiveSection("details");
      }
    } catch (err: any) {
      toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
    }
    setAnalyzingImage(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const interestsArr = interests.split(",").map((s) => s.trim()).filter(Boolean);
    const likesArr = likes.split(",").map((s) => s.trim()).filter(Boolean);

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim(),
        bio: bio.trim(),
        avatar_url: avatarUrl || null,
        cover_url: coverUrl || null,
        height: height || null,
        build: build || null,
        complexion: complexion || null,
        eye_color: eyeColor || null,
        hair_color: hairColor || null,
        ethnicity: ethnicity || null,
        profession: profession || null,
        interests: interestsArr.length > 0 ? interestsArr : null,
        likes: likesArr.length > 0 ? likesArr : null,
        measurements: measurements || null,
        location: location || null,
        zodiac_sign: zodiacSign || null,
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
        const descWithPerks = tier.perks.length > 1 ? tier.perks.join(" • ") : tier.description;
        if (tier.isNew) {
          await supabase.from("creator_subscription_tiers").insert({
            creator_id: user.id,
            tier_name: tier.tier_name,
            price_cents: tier.price_cents,
            description: descWithPerks,
            is_active: tier.is_active,
          });
        } else {
          await supabase.from("creator_subscription_tiers").update({
            tier_name: tier.tier_name,
            price_cents: tier.price_cents,
            description: descWithPerks,
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

  const sectionTabs = [
    { key: "profile" as const, label: "Profile", icon: User2 },
    { key: "details" as const, label: "Details & Stats", icon: Ruler },
    { key: "tiers" as const, label: "Subscription Tiers", icon: Crown },
  ];

  return (
    <div className="space-y-4">
      {/* Section Tabs */}
      <div className="flex gap-1 border-b border-border pb-2">
        {sectionTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveSection(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeSection === tab.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <tab.icon className="h-3 w-3" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Profile Section */}
      {activeSection === "profile" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
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

          {/* Avatar + AI Analyze */}
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
            <div className="flex flex-col gap-1">
              <Button variant="outline" size="sm" disabled={uploadingAvatar} onClick={() => avatarInputRef.current?.click()}>
                {uploadingAvatar ? "Uploading..." : "Change Avatar"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleAnalyzeImage}
                disabled={analyzingImage || (!avatarUrl && !coverUrl)}
                className="text-xs text-primary h-7"
              >
                {analyzingImage ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                AI Auto-Fill from Photo
              </Button>
            </div>
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
              className="w-full h-28 bg-muted border border-border rounded-lg p-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">{bio.length}/500</p>
          </div>

          {/* Location & Profession */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> Location</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Los Angeles, CA" className="bg-muted border-border mt-1" maxLength={50} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1"><Briefcase className="h-3 w-3" /> Profession</Label>
              <Input value={profession} onChange={(e) => setProfession(e.target.value)} placeholder="e.g. Model, Artist" className="bg-muted border-border mt-1" maxLength={50} />
            </div>
          </div>

          {/* Interests & Likes */}
          <div>
            <Label className="text-xs text-muted-foreground flex items-center gap-1"><Heart className="h-3 w-3" /> Interests (comma-separated)</Label>
            <Input value={interests} onChange={(e) => setInterests(e.target.value)} placeholder="e.g. Fitness, Travel, Music, Art" className="bg-muted border-border mt-1" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Likes (comma-separated)</Label>
            <Input value={likes} onChange={(e) => setLikes(e.target.value)} placeholder="e.g. Sunsets, Yoga, Good vibes" className="bg-muted border-border mt-1" />
          </div>
        </motion.div>
      )}

      {/* Details & Stats Section */}
      {activeSection === "details" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Ruler className="h-4 w-4 text-accent" /> Physical Details
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAnalyzeImage}
              disabled={analyzingImage || (!avatarUrl && !coverUrl)}
              className="text-xs text-primary h-7"
            >
              {analyzingImage ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Wand2 className="h-3 w-3 mr-1" />}
              AI Auto-Populate
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Height</Label>
              <Input value={height} onChange={(e) => setHeight(e.target.value)} placeholder={`e.g. 5'6"`} className="bg-muted border-border mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Build</Label>
              <Select value={build} onValueChange={setBuild}>
                <SelectTrigger className="bg-muted border-border mt-1 h-9 text-sm">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {buildOptions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Complexion</Label>
              <Select value={complexion} onValueChange={setComplexion}>
                <SelectTrigger className="bg-muted border-border mt-1 h-9 text-sm">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {complexionOptions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Eye Color</Label>
              <Select value={eyeColor} onValueChange={setEyeColor}>
                <SelectTrigger className="bg-muted border-border mt-1 h-9 text-sm">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {eyeColorOptions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Hair Color</Label>
              <Select value={hairColor} onValueChange={setHairColor}>
                <SelectTrigger className="bg-muted border-border mt-1 h-9 text-sm">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {hairColorOptions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Ethnicity</Label>
              <Input value={ethnicity} onChange={(e) => setEthnicity(e.target.value)} placeholder="e.g. Latina, African American" className="bg-muted border-border mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Measurements</Label>
              <Input value={measurements} onChange={(e) => setMeasurements(e.target.value)} placeholder="e.g. 34-26-36" className="bg-muted border-border mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Zodiac Sign</Label>
              <Select value={zodiacSign} onValueChange={setZodiacSign}>
                <SelectTrigger className="bg-muted border-border mt-1 h-9 text-sm">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {zodiacOptions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </motion.div>
      )}

      {/* Subscription Tiers Section */}
      {activeSection === "tiers" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Crown className="h-4 w-4 text-accent" /> Subscription Packages
            </h3>
          </div>

          {loadingTiers ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-4">
              {tiers.map((tier, i) => {
                const tierColor = tier.tier_name === "Gold"
                  ? "border-accent/40 bg-accent/5"
                  : tier.tier_name === "Silver"
                  ? "border-primary/40 bg-primary/5"
                  : "border-border bg-muted/30";

                return (
                  <div key={tier.id} className={`rounded-xl border p-4 space-y-3 ${tierColor}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          value={tier.tier_name}
                          onChange={(e) => setTiers(tiers.map((t, idx) => idx === i ? { ...t, tier_name: e.target.value } : t))}
                          placeholder="Tier name"
                          className="bg-transparent font-bold text-foreground placeholder:text-muted-foreground focus:outline-none w-28 text-sm"
                        />
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
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => {
                        if (!tier.isNew) {
                          supabase.from("creator_subscription_tiers").update({ is_active: false }).eq("id", tier.id);
                        }
                        setTiers(tiers.filter((_, idx) => idx !== i));
                      }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Description */}
                    <input
                      value={tier.description}
                      onChange={(e) => setTiers(tiers.map((t, idx) => idx === i ? { ...t, description: e.target.value } : t))}
                      placeholder="Package tagline..."
                      className="w-full bg-transparent text-xs text-muted-foreground placeholder:text-muted-foreground focus:outline-none"
                    />

                    {/* Perks List */}
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">What fans get:</Label>
                      {tier.perks.map((perk, pIdx) => (
                        <div key={pIdx} className="flex items-center gap-2">
                          <span className="text-primary text-xs">✓</span>
                          <input
                            value={perk}
                            onChange={(e) => {
                              const newPerks = [...tier.perks];
                              newPerks[pIdx] = e.target.value;
                              setTiers(tiers.map((t, idx) => idx === i ? { ...t, perks: newPerks } : t));
                            }}
                            placeholder="e.g. Exclusive photo sets"
                            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                          />
                          {tier.perks.length > 1 && (
                            <button
                              onClick={() => {
                                const newPerks = tier.perks.filter((_, pi) => pi !== pIdx);
                                setTiers(tiers.map((t, idx) => idx === i ? { ...t, perks: newPerks } : t));
                              }}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          const newPerks = [...tier.perks, ""];
                          setTiers(tiers.map((t, idx) => idx === i ? { ...t, perks: newPerks } : t));
                        }}
                        className="text-[10px] text-primary hover:underline flex items-center gap-1 mt-1"
                      >
                        <Plus className="h-2.5 w-2.5" /> Add perk
                      </button>
                    </div>
                  </div>
                );
              })}

              {tiers.length < 5 && (
                <Button variant="outline" size="sm" onClick={() => setTiers([...tiers, { id: `new-${Date.now()}`, tier_name: "", price_cents: 499, description: "", is_active: true, isNew: true, perks: [""] }])} className="w-full border-dashed text-xs">
                  <Plus className="h-3 w-3 mr-1" /> Add Tier
                </Button>
              )}
              <p className="text-[10px] text-muted-foreground">Minimum price: $4.99/mo</p>
            </div>
          )}
        </motion.div>
      )}

      {/* Save Button (always visible) */}
      <Button onClick={handleSave} disabled={saving} className="w-full bg-gradient-purple text-primary-foreground font-bold hover:opacity-90">
        <Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save Everything"}
      </Button>

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

export default CreatorProfileEditor;
