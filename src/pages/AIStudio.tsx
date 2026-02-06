import { useState } from "react";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import {
  Sparkles, Image as ImageIcon, Video, Wand2, User,
  Settings2, Coins, History, Download, Upload, Layers,
} from "lucide-react";

type StudioTab = "image" | "character" | "video";

const stylePresets = ["Glamour", "Artistic", "Realistic", "Fantasy", "Cinematic", "Noir", "Pop Art", "Ethereal"];
const aspectRatios = ["1:1", "4:5", "9:16", "16:9"];

const AIStudioPage = () => {
  const [activeTab, setActiveTab] = useState<StudioTab>("image");
  const [prompt, setPrompt] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("Glamour");
  const [selectedRatio, setSelectedRatio] = useState("1:1");

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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="text-xs font-bold uppercase tracking-widest text-primary">Creator Tools</span>
          </div>
          <h1 className="text-4xl font-black mb-2">AI Studio</h1>
          <p className="text-muted-foreground max-w-lg">
            Generate stunning content with cutting-edge AI. Every generation costs BREAD.
          </p>
        </motion.div>

        {/* BREAD Balance Banner */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-card border border-accent/20 glow-gold mb-8">
          <div className="flex items-center gap-3">
            <Coins className="h-6 w-6 text-accent" />
            <div>
              <p className="text-xs text-muted-foreground">Your Balance</p>
              <p className="text-2xl font-black text-gradient-gold">1,250 BREAD</p>
            </div>
          </div>
          <Button className="bg-gradient-purple text-primary-foreground font-bold hover:opacity-90" size="sm">
            Buy More
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
                  activeTab === tab.id
                    ? "bg-primary/10 border border-primary/30 text-foreground"
                    : "hover:bg-muted border border-transparent text-muted-foreground"
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
              <History className="h-5 w-5" />
              <span className="text-sm">Generation History</span>
            </button>
            <button className="w-full flex items-center gap-3 p-3 rounded-xl text-left text-muted-foreground hover:bg-muted transition-colors">
              <Layers className="h-5 w-5" />
              <span className="text-sm">Content Library</span>
            </button>
          </div>

          {/* Main workspace */}
          <div className="space-y-6">
            {activeTab === "image" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                {/* Prompt */}
                <div className="rounded-xl bg-gradient-card border border-border p-5">
                  <label className="text-sm font-bold mb-2 block">Describe your image</label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="A glamorous portrait with golden hour lighting, soft bokeh, studio quality..."
                    className="w-full h-28 bg-muted border border-border rounded-lg p-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                  />

                  {/* Style Presets */}
                  <div className="mt-4">
                    <label className="text-xs font-bold text-muted-foreground mb-2 block">Style Preset</label>
                    <div className="flex flex-wrap gap-2">
                      {stylePresets.map((s) => (
                        <button
                          key={s}
                          onClick={() => setSelectedStyle(s)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                            selectedStyle === s
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Aspect Ratio */}
                  <div className="mt-4">
                    <label className="text-xs font-bold text-muted-foreground mb-2 block">Aspect Ratio</label>
                    <div className="flex gap-2">
                      {aspectRatios.map((r) => (
                        <button
                          key={r}
                          onClick={() => setSelectedRatio(r)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            selectedRatio === r
                              ? "border-primary text-primary bg-primary/10"
                              : "border-border text-muted-foreground hover:border-primary/30"
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center justify-between mt-5 pt-4 border-t border-border">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Estimated cost: </span>
                      <span className="font-bold text-gradient-gold">25 BREAD</span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="border-border text-muted-foreground">
                        <Settings2 className="h-4 w-4 mr-1" /> Advanced
                      </Button>
                      <Button className="bg-gradient-purple text-primary-foreground font-bold hover:opacity-90" size="sm">
                        <Sparkles className="h-4 w-4 mr-1" /> Generate
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Preview grid */}
                <div>
                  <h3 className="text-sm font-bold mb-3">Generated Results</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="aspect-square rounded-xl bg-gradient-card border border-border flex items-center justify-center group hover:border-primary/30 transition-colors cursor-pointer"
                      >
                        <div className="text-center">
                          <Sparkles className="h-8 w-8 text-primary/20 mx-auto mb-2 animate-pulse-glow" />
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
                      <input
                        placeholder="e.g., Luna Starlight"
                        className="w-full bg-muted border border-border rounded-lg p-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-muted-foreground mb-1 block">Style</label>
                      <select className="w-full bg-muted border border-border rounded-lg p-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                        <option>Realistic</option>
                        <option>Anime</option>
                        <option>3D Render</option>
                        <option>Artistic</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">Physical Description</label>
                    <textarea
                      placeholder="Describe your character's appearance, features, hairstyle, expressions..."
                      className="w-full h-24 bg-muted border border-border rounded-lg p-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="flex items-center justify-between mt-5 pt-4 border-t border-border">
                    <span className="text-sm"><span className="text-muted-foreground">Cost: </span><span className="font-bold text-gradient-gold">30 BREAD</span></span>
                    <Button className="bg-gradient-purple text-primary-foreground font-bold hover:opacity-90" size="sm">
                      <Wand2 className="h-4 w-4 mr-1" /> Create Character
                    </Button>
                  </div>
                </div>

                {/* Saved characters */}
                <div>
                  <h3 className="text-sm font-bold mb-3">Your Characters</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { name: "Luna", img: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=300&fit=crop&crop=face" },
                      { name: "Aria", img: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&h=300&fit=crop&crop=face" },
                    ].map((char) => (
                      <div key={char.name} className="rounded-xl bg-gradient-card border border-border p-3 flex items-center gap-3 hover:border-primary/30 transition-colors cursor-pointer">
                        <div className="w-12 h-12 rounded-full overflow-hidden shrink-0">
                          <img src={char.img} alt={char.name} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">{char.name}</p>
                          <p className="text-xs text-muted-foreground">AI Character</p>
                        </div>
                      </div>
                    ))}
                    <div className="rounded-xl border border-dashed border-border p-3 flex items-center justify-center cursor-pointer hover:border-primary/30 transition-colors min-h-[72px]">
                      <span className="text-xs text-muted-foreground">+ New Character</span>
                    </div>
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

                  {/* Upload zone */}
                  <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/30 transition-colors cursor-pointer mb-4">
                    <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm font-medium mb-1">Upload a source image</p>
                    <p className="text-xs text-muted-foreground">Or use an image from your AI library</p>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-bold text-muted-foreground mb-1 block">Duration</label>
                      <select className="w-full bg-muted border border-border rounded-lg p-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                        <option>3 seconds</option>
                        <option>5 seconds</option>
                        <option>10 seconds</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-muted-foreground mb-1 block">Motion Preset</label>
                      <select className="w-full bg-muted border border-border rounded-lg p-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                        <option>Slow Pan</option>
                        <option>Zoom In</option>
                        <option>Gentle Sway</option>
                        <option>Dynamic</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-muted-foreground mb-1 block">Quality</label>
                      <select className="w-full bg-muted border border-border rounded-lg p-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                        <option>Standard</option>
                        <option>HD</option>
                        <option>4K</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">Motion Description</label>
                    <input
                      placeholder="Describe desired movement, e.g., 'hair flowing in wind, soft smile'"
                      className="w-full bg-muted border border-border rounded-lg p-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="flex items-center justify-between mt-5 pt-4 border-t border-border">
                    <span className="text-sm"><span className="text-muted-foreground">Cost: </span><span className="font-bold text-gradient-gold">75 BREAD</span></span>
                    <Button className="bg-gradient-purple text-primary-foreground font-bold hover:opacity-90" size="sm">
                      <Video className="h-4 w-4 mr-1" /> Generate Video
                    </Button>
                  </div>
                </div>

                {/* Generated videos */}
                <div>
                  <h3 className="text-sm font-bold mb-3">Recent Videos</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="aspect-video rounded-xl bg-gradient-card border border-border flex items-center justify-center">
                        <div className="text-center">
                          <Video className="h-8 w-8 text-primary/20 mx-auto mb-1" />
                          <span className="text-xs text-muted-foreground">No videos yet</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default AIStudioPage;
