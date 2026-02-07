import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Download, Share, Plus, Smartphone, CheckCircle2, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import logo from "@/assets/logo.png";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isiOS, setIsiOS] = useState(false);

  useEffect(() => {
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsiOS(isIOSDevice);

    const isPWA = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
    setIsInstalled(isPWA);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 pt-28 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto text-center"
        >
          <img
            src={logo}
            alt="Dope Chicks"
            className="w-[320px] h-[320px] object-contain mx-auto mb-8 mix-blend-screen drop-shadow-[0_0_25px_hsl(42,80%,55%,0.4)]"
          />

          {isInstalled ? (
            <div className="flex flex-col items-center gap-4">
              <CheckCircle2 className="h-12 w-12 text-accent" />
              <h1 className="text-3xl font-black">Already Installed!</h1>
              <p className="text-muted-foreground">Dope Chicks is installed on your device.</p>
            </div>
          ) : (
            <>
              <h1 className="text-4xl md:text-5xl font-black mb-4">
                Install <span className="text-gradient-gold">Dope Chicks</span>
              </h1>
              <p className="text-muted-foreground text-lg mb-10">
                Get the full app experience — offline access, push notifications, and more.
              </p>

              {deferredPrompt && (
                <Button
                  size="lg"
                  onClick={handleInstall}
                  className="bg-gradient-purple text-primary-foreground font-bold text-lg px-10 py-6 glow-purple hover:opacity-90 mb-12"
                >
                  <Download className="h-5 w-5 mr-2" />
                  Install App
                </Button>
              )}

              {/* iOS Instructions */}
              {isiOS && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="rounded-2xl bg-gradient-card border border-border p-6 text-left mb-8"
                >
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Smartphone className="h-5 w-5 text-accent" />
                    Install on iPhone / iPad
                  </h2>
                  <ol className="space-y-4">
                    <li className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center font-bold text-sm">1</span>
                      <div>
                        <p className="font-semibold">Tap the Share button</p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Share className="h-4 w-4" /> at the bottom of Safari
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center font-bold text-sm">2</span>
                      <div>
                        <p className="font-semibold">Scroll down & tap "Add to Home Screen"</p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Plus className="h-4 w-4" /> Look for the plus icon
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center font-bold text-sm">3</span>
                      <div>
                        <p className="font-semibold">Tap "Add"</p>
                        <p className="text-sm text-muted-foreground">The app will appear on your home screen</p>
                      </div>
                    </li>
                  </ol>
                </motion.div>
              )}

              {/* Android / Desktop instructions */}
              {!isiOS && !deferredPrompt && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="rounded-2xl bg-gradient-card border border-border p-6 text-left"
                >
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Download className="h-5 w-5 text-accent" />
                    How to Install
                  </h2>
                  <ol className="space-y-3 text-sm text-muted-foreground">
                    <li className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-accent/20 text-accent flex items-center justify-center font-bold text-xs">1</span>
                      <p>Open Chrome's menu (⋮) or your browser's menu</p>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-accent/20 text-accent flex items-center justify-center font-bold text-xs">2</span>
                      <p>Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong></p>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-accent/20 text-accent flex items-center justify-center font-bold text-xs">3</span>
                      <p>Confirm to install</p>
                    </li>
                  </ol>
                </motion.div>
              )}
            </>
          )}
        </motion.div>
      </main>
      <Footer />
    </div>
  );
};

export default Install;
