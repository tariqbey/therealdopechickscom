import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Play, Sparkles } from "lucide-react";
import dopeVideo from "@/assets/dope.mp4";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Background video with overlay */}
      <div className="absolute inset-0">
        <video
          src={dopeVideo}
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/60" />
      </div>

      <div className="relative container mx-auto px-4 pt-24">
        <div className="max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium mb-6">
              <Sparkles className="h-3 w-3" />
              AI-Powered Creator Platform
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-5xl md:text-7xl font-black leading-[0.95] mb-6"
          >
            Where <span className="text-gradient-gold italic">Dope</span>{" "}
            <br />
            Creators{" "}
            <span className="text-gradient-purple">Thrive</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-lg text-muted-foreground max-w-lg mb-8 font-light"
          >
            The premium platform for exclusive content. Subscribe to your favorite
            creators, unlock AI-powered tools, and earn with{" "}
            <span className="text-gradient-gold font-semibold">BREAD</span> credits.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="flex flex-wrap gap-4"
          >
            <Button
              size="lg"
              className="bg-gradient-purple text-primary-foreground font-bold text-base px-8 glow-purple hover:opacity-90 transition-opacity"
            >
              Start Creating
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-accent/40 text-accent hover:bg-accent/10 font-semibold text-base px-8"
            >
              <Play className="h-4 w-4 mr-2" />
              Explore Creators
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.8 }}
            className="flex gap-8 mt-12 text-sm"
          >
            {[
              { value: "10K+", label: "Creators" },
              { value: "500K+", label: "Fans" },
              { value: "$2M+", label: "Earned" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl font-bold text-gradient-gold">{stat.value}</div>
                <div className="text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
