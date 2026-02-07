import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BuyBreadModal from "@/components/BuyBreadModal";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/hooks/useWallet";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Sparkles, Image as ImageIcon, Video, Wand2, User,
  Settings2, Coins, History, Download, Upload, Layers, X,
} from "lucide-react";

type StudioTab = "image" | "character" | "video";

const stylePresets = ["Glamour", "Artistic", "Realistic", "Fantasy", "Cinematic", "Noir", "Pop Art", "Ethereal"];
const aspectRatios = ["1:1", "4:5", "9:16", "16:9"];

const AIStudioPage = () => {
  const [activeTab, setActiveTab] = useState<StudioTab>("image");
  const [prompt, setPrompt] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("Glamour");
  const [selectedRatio, setSelectedRatio] = useState("1:1");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedResults, setGeneratedResults] = useState<string[]>([]);
  const [showBuyModal, setShowBuyModal] = useState(false);

  // Character state
  const [characterName, setCharacterName] = useState("");
  const [characterStyle, setCharacterStyle] = useState("Realistic");
  const [characterDesc, setCharacterDesc] = useState("");

  // Video state
  const [motionPreset, setMotionPreset] = useState("Slow Pan");
  const [videoDuration, setVideoDuration] = useState("3 seconds");
  const [videoQuality, setVideoQuality] = useState("Standard");
  const [motionDescription, setMotionDescription] = useState("");
  const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null);
  const [sourceImagePreview, setSourceImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { user, profile } = useAuth();
  const { balance, spendBread } = useWallet();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Admin gets unlimited access
  const isAdmin = user?.email === "drpaydex@gmail.com";

  const costs: Record<StudioTab, number> = { image: 25, character: 30, video: 75 };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image file.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("ai-studio").upload(path, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("ai-studio").getPublicUrl(path);
      setSourceImageUrl(urlData.publicUrl);
      setSourceImagePreview(URL.createObjectURL(file));
      toast({ title: "Image uploaded!", description: "Ready to generate video." });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleGenerate = async () => {
    if (!user) {
      toast({ title: "Please log in", description: "You need an account to use AI Studio.", variant: "destructive" });
      navigate("/auth");
      return;
    }

    if (!isAdmin && balance < costs[activeTab]) {
      toast({ title: "Not enough BREAD", description: `You need ${costs[activeTab]} BREAD.`, variant: "destructive" });
      setShowBuyModal(true);
      return;
    }

    setIsGenerating(true);

    try {
      let body: Record<string, unknown> = { type: activeTab };

      if (activeTab === "image") {
        body = { ...body, prompt, style: selectedStyle, aspectRatio: selectedRatio };
      } else if (activeTab === "character") {
        body = { ...body, characterName, characterStyle, characterDescription: characterDesc };
      } else {
        body = { ...body, sourceImageUrl, motionPreset, duration: videoDuration, quality: videoQuality, motionDescription };
      }

      const { data, error } = await supabase.functions.invoke("generate-ai", { body });

      if (error) throw error;

      if (data?.error) {
        toast({ title: "Generation failed", description: data.error, variant: "destructive" });
      } else {
        toast({ title: "Generation complete!", description: `Cost: ${costs[activeTab]} BREAD` });
        if (data?.result?.images) {
          setGeneratedResults(data.result.images.map((img: any) => img.url));
        } else if (data?.result?.video?.url) {
          setGeneratedResults([data.result.video.url]);
        } else if (data?.result?.character?.thumbnail_url) {
          setGeneratedResults([data.result.character.thumbnail_url]);
        }
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const tabs: { id: StudioTab; label: string; icon: React.ElementType; desc: string }[] = [
    { id: "image", label: "Image Gen", icon: ImageIcon, desc: "Create stunning images from text prompts" },
    { id: "character", label: "Characters", icon: User, desc: "Build consistent AI personas" },
    { id: "video", label: "Video", icon: Video, desc: "Transform images into videos" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 pt-24 pb-12">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="text-xs font-bold uppercase tracking-widest text-primary">Creator Tools</span>
          </div>
          <h1 className="text-4xl font-black mb-2">AI Studio</h1>
          <p className="text-muted-foreground max-w-lg">Generate stunning content with cutting-edge AI. Every generation costs BREAD.</p>
        </motion.div>

        {/* BREAD Balance Banner */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-card border border-accent/20 glow-gold mb-8">
          <div className="flex items-center gap-3">
            <Coins className="h-6 w-6 text-accent" />
            <div>
              <p className="text-xs text-muted-foreground">Your Balance</p>
              <p className="text-2xl font-black text-gradient-gold">{user ? `${balance} BREAD` : "Log in to see balance"}</p>
            </div>
          </div>
          <Button onClick={() => user ? setShowBuyModal(true) : navigate("/auth")} className="bg-gradient-purple text-primary-foreground font-bold hover:opacity-90" size="sm">
            {user ? "Buy More" : "Log In"}
          </Button>
        </div>

        <div className="grid lg:grid-cols-[280px_1fr] gap-6">
          {/* Sidebar */}
          <div className="space-y-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
                  activeTab === tab.id ? "bg-primary/10 border border-primary/30 text-foreground" : "hover:bg-muted border border-transparent text-muted-foreground"
                }`}
              >
                <tab.icon className={`h-5 w-5 ${activeTab === tab.id ? "text-primary" : ""}`} />
                <div>
                  <div className="text-sm font-semibold">{tab.label}</div>
                  <div className="text-xs text-muted-foreground">{tab.desc}</div>
                </div>
              </button>
            ))}
            <div className="border-t border-border my-4" />
            <button className="w-full flex items-center gap-3 p-3 rounded-xl text-left text-muted-foreground hover:bg-muted transition-colors">
              <History className="h-5 w-5" /><span className="text-sm">Generation History</span>
            </button>
            <button className="w-full flex items-center gap-3 p-3 rounded-xl text-left text-muted-foreground hover:bg-muted transition-colors">
              <Layers className="h-5 w-5" /><span className="text-sm">Content Library</span>
            </button>
          </div>

          {/* Main workspace */}
          <div className="space-y-6">
            {activeTab === "image" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="rounded-xl bg-gradient-card border border-border p-5">
                  <label className="text-sm font-bold mb-2 block">Describe your image</label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="A glamorous portrait with golden hour lighting, soft bokeh, studio quality..."
                    className="w-full h-28 bg-muted border border-border rounded-lg p-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <div className="mt-4">
                    <label className="text-xs font-bold text-muted-foreground mb-2 block">Style Preset</label>
                    <div className="flex flex-wrap gap-2">
                      {stylePresets.map((s) => (
                        <button key={s} onClick={() => setSelectedStyle(s)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedStyle === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="text-xs font-bold text-muted-foreground mb-2 block">Aspect Ratio</label>
                    <div className="flex gap-2">
                      {aspectRatios.map((r) => (
                        <button key={r} onClick={() => setSelectedRatio(r)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${selectedRatio === r ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:border-primary/30"}`}>
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-5 pt-4 border-t border-border">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Cost: </span>
                      <span className="font-bold text-gradient-gold">25 BREAD</span>
                    </div>
                    <Button onClick={handleGenerate} disabled={isGenerating || !prompt} className="bg-gradient-purple text-primary-foreground font-bold hover:opacity-90" size="sm">
                      <Sparkles className="h-4 w-4 mr-1" /> {isGenerating ? "Generating..." : "Generate"}
                    </Button>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold mb-3">Generated Results</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {generatedResults.length > 0 ? generatedResults.map((url, i) => (
                      <div key={i} className="aspect-square rounded-xl border border-border overflow-hidden">
                        <img src={url} alt={`Generated ${i + 1}`} className="w-full h-full object-cover" />
                      </div>
                    )) : [1, 2, 3, 4].map((i) => (
                      <div key={i} className="aspect-square rounded-xl bg-gradient-card border border-border flex items-center justify-center group hover:border-primary/30 transition-colors cursor-pointer">
                        <div className="text-center">
                          <Sparkles className="h-8 w-8 text-primary/20 mx-auto mb-2 animate-pulse" />
                          <span className="text-xs text-muted-foreground">Generate to see results</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "character" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="rounded-xl bg-gradient-card border border-border p-5">
                  <h3 className="font-bold mb-4 flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" /> Create AI Character
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-muted-foreground mb-1 block">Character Name</label>
                      <input value={characterName} onChange={(e) => setCharacterName(e.target.value)} placeholder="e.g., Luna Starlight" className="w-full bg-muted border border-border rounded-lg p-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-muted-foreground mb-1 block">Style</label>
                      <select value={characterStyle} onChange={(e) => setCharacterStyle(e.target.value)} className="w-full bg-muted border border-border rounded-lg p-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                        <option>Realistic</option><option>Anime</option><option>3D Render</option><option>Artistic</option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">Physical Description</label>
                    <textarea value={characterDesc} onChange={(e) => setCharacterDesc(e.target.value)} placeholder="Describe your character's appearance..." className="w-full h-24 bg-muted border border-border rounded-lg p-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                  <div className="flex items-center justify-between mt-5 pt-4 border-t border-border">
                    <span className="text-sm"><span className="text-muted-foreground">Cost: </span><span className="font-bold text-gradient-gold">30 BREAD</span></span>
                    <Button onClick={handleGenerate} disabled={isGenerating || !characterDesc} className="bg-gradient-purple text-primary-foreground font-bold hover:opacity-90" size="sm">
                      <Wand2 className="h-4 w-4 mr-1" /> {isGenerating ? "Creating..." : "Create Character"}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "video" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="rounded-xl bg-gradient-card border border-border p-5">
                  <h3 className="font-bold mb-4 flex items-center gap-2">
                    <Video className="h-4 w-4 text-primary" /> Image to Video
                  </h3>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                  {sourceImagePreview ? (
                    <div className="relative rounded-xl overflow-hidden mb-4 max-h-64 flex items-center justify-center bg-muted">
                      <img src={sourceImagePreview} alt="Source" className="max-h-64 object-contain" />
                      <button
                        onClick={() => { setSourceImageUrl(null); setSourceImagePreview(null); }}
                        className="absolute top-2 right-2 p-1 rounded-full bg-background/80 hover:bg-background text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/30 transition-colors cursor-pointer mb-4"
                    >
                      {isUploading ? (
                        <div className="animate-pulse">
                          <Upload className="h-10 w-10 text-primary mx-auto mb-3" />
                          <p className="text-sm font-medium mb-1">Uploading...</p>
                        </div>
                      ) : (
                        <>
                          <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                          <p className="text-sm font-medium mb-1">Click to upload a source image</p>
                          <p className="text-xs text-muted-foreground">JPG, PNG, or WebP</p>
                        </>
                      )}
                    </div>
                  )}
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-bold text-muted-foreground mb-1 block">Duration</label>
                      <select value={videoDuration} onChange={(e) => setVideoDuration(e.target.value)} className="w-full bg-muted border border-border rounded-lg p-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                        <option>3 seconds</option><option>5 seconds</option><option>10 seconds</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-muted-foreground mb-1 block">Motion Preset</label>
                      <select value={motionPreset} onChange={(e) => setMotionPreset(e.target.value)} className="w-full bg-muted border border-border rounded-lg p-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                        <option>Slow Pan</option><option>Zoom In</option><option>Gentle Sway</option><option>Dynamic</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-muted-foreground mb-1 block">Quality</label>
                      <select value={videoQuality} onChange={(e) => setVideoQuality(e.target.value)} className="w-full bg-muted border border-border rounded-lg p-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                        <option>Standard</option><option>HD</option><option>4K</option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">Motion Description</label>
                    <input value={motionDescription} onChange={(e) => setMotionDescription(e.target.value)} placeholder="Describe desired movement..." className="w-full bg-muted border border-border rounded-lg p-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                  <div className="flex items-center justify-between mt-5 pt-4 border-t border-border">
                    <span className="text-sm"><span className="text-muted-foreground">Cost: </span><span className="font-bold text-gradient-gold">{isAdmin ? "FREE (Admin)" : "75 BREAD"}</span></span>
                    <Button onClick={handleGenerate} disabled={isGenerating || !sourceImageUrl} className="bg-gradient-purple text-primary-foreground font-bold hover:opacity-90" size="sm">
                      <Video className="h-4 w-4 mr-1" /> {isGenerating ? "Generating..." : "Generate Video"}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      <Footer />
      <BuyBreadModal open={showBuyModal} onClose={() => setShowBuyModal(false)} />
    </div>
  );
};

export default AIStudioPage;
