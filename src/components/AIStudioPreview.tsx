import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sparkles, Image, Video, Wand2 } from "lucide-react";

const features = [
  { icon: Image, title: "AI Image Generation", desc: "Create stunning visuals with text prompts" },
  { icon: Wand2, title: "Character Creator", desc: "Build consistent AI personas for your content" },
  { icon: Video, title: "AI Video", desc: "Transform images into captivating video clips" },
];

const AIStudioPreview = () => {
  return (
    <section id="ai-studio" className="py-20 border-t border-border">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="text-xs font-bold uppercase tracking-widest text-primary">
                Creator Tools
              </span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black mb-4">
              AI-Powered{" "}
              <span className="text-gradient-purple">Studio</span>
            </h2>
            <p className="text-muted-foreground mb-8 max-w-lg">
              Unlock next-level content creation with our integrated AI tools. Generate images, create characters, and produce videos — all powered by cutting-edge AI.
            </p>

            <div className="space-y-4">
              {features.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary mt-0.5">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">{title}</h3>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <Button
              size="lg"
              className="mt-8 bg-gradient-purple text-primary-foreground font-bold hover:opacity-90"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Try AI Studio
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative"
          >
            {/* Mockup of AI studio interface */}
            <div className="rounded-xl border border-border bg-gradient-card p-6 glow-purple">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-destructive/60" />
                <div className="w-3 h-3 rounded-full bg-accent/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
                <span className="ml-2 text-xs text-muted-foreground">AI Studio</span>
              </div>

              <div className="space-y-3">
                <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                  <span className="text-primary font-semibold">Prompt: </span>
                  "Glamorous portrait, golden hour lighting, artistic composition..."
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="aspect-square rounded-lg bg-gradient-to-br from-primary/20 to-purple-deep/30 flex items-center justify-center border border-primary/10"
                    >
                      <Sparkles className="h-6 w-6 text-primary/40 animate-pulse-glow" />
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Cost: <span className="text-gradient-gold font-bold">25 BREAD</span></span>
                  <Button size="sm" className="h-7 text-xs bg-gradient-purple text-primary-foreground">
                    Generate
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default AIStudioPreview;
