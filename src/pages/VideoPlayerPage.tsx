import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import VideoPlayer from "@/components/VideoPlayer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MonitorPlay, Globe, Eye } from "lucide-react";
import dopeVideo from "@/assets/dope.mp4";

type VideoMode = "standard" | "360" | "vr180";

const modeInfo: Record<VideoMode, { icon: typeof MonitorPlay; label: string; description: string }> = {
  standard: {
    icon: MonitorPlay,
    label: "Standard",
    description: "Regular flat video playback",
  },
  "360": {
    icon: Globe,
    label: "360°",
    description: "Drag to look around in full spherical view",
  },
  vr180: {
    icon: Eye,
    label: "VR 180°",
    description: "Stereoscopic 3D — drag to explore the front hemisphere",
  },
};

const VideoPlayerPage = () => {
  const [mode, setMode] = useState<VideoMode>("standard");
  const [videoSrc, setVideoSrc] = useState(dopeVideo);
  const [customUrl, setCustomUrl] = useState("");

  const handleLoadCustom = () => {
    if (customUrl.trim()) {
      setVideoSrc(customUrl.trim());
    }
  };

  const ActiveIcon = modeInfo[mode].icon;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 pt-28 pb-16">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl md:text-4xl font-display font-bold">
              <span className="text-gradient-purple">Immersive</span> Video Player
            </h1>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Play standard videos or explore 360° and VR 180° content with interactive controls.
            </p>
          </div>

          {/* Mode selector */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {(Object.keys(modeInfo) as VideoMode[]).map((m) => {
              const info = modeInfo[m];
              const Icon = info.icon;
              const active = mode === m;
              return (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                    active
                      ? "border-primary bg-primary/10 text-foreground glow-purple"
                      : "border-border bg-card text-muted-foreground hover:border-muted-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {info.label}
                </button>
              );
            })}
          </div>

          {/* Player */}
          <Card className="bg-gradient-card border-border overflow-hidden">
            <CardContent className="p-0">
              <VideoPlayer src={videoSrc} mode={mode} />
            </CardContent>
          </Card>

          {/* Mode description */}
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted border border-border text-sm">
              <ActiveIcon className="h-4 w-4 text-accent" />
              <span className="text-muted-foreground">{modeInfo[mode].description}</span>
            </div>
          </div>

          {/* Custom URL input */}
          <Card className="bg-gradient-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">Load Custom Video</CardTitle>
              <CardDescription>
                Paste a URL to a video file (.mp4, .webm) to play it in any mode.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="https://example.com/video.mp4"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  className="bg-background"
                />
                <Button onClick={handleLoadCustom} className="bg-gradient-purple text-primary-foreground">
                  Load
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default VideoPlayerPage;
