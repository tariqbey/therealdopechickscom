import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Share, Plus, Download, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "pwa-install-dismissed";

const PWAInstallBanner = () => {
  const [show, setShow] = useState(false);
  const [isiOS, setIsiOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Don't show if already installed as PWA
    const isPWA = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
    if (isPWA) return;

    // Don't show if user dismissed recently (24 hours)
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed && Date.now() - parseInt(dismissed) < 24 * 60 * 60 * 1000) return;

    // Only show on mobile
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (!isMobile) return;

    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsiOS(isIOSDevice);

    // For iOS, show immediately
    if (isIOSDevice) {
      setTimeout(() => setShow(true), 2000);
      return;
    }

    // For Android, wait for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShow(true), 2000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") dismiss();
    setDeferredPrompt(null);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed bottom-0 left-0 right-0 z-[100] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          <div className="max-w-md mx-auto rounded-2xl bg-card border border-border shadow-2xl shadow-black/50 p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <img src={logo} alt="Dope Chicks" className="w-12 h-12 object-contain mix-blend-screen" />
                <div>
                  <h3 className="font-bold text-sm">Add Dope Chicks to Home Screen</h3>
                  <p className="text-xs text-muted-foreground">Get the full app experience</p>
                </div>
              </div>
              <button onClick={dismiss} className="text-muted-foreground hover:text-foreground p-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            {isiOS ? (
              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-3 text-sm">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center font-bold text-xs">1</span>
                  <span className="text-muted-foreground">Tap <Share className="inline h-4 w-4 text-foreground mx-0.5" /> <strong className="text-foreground">Share</strong> at the bottom</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center font-bold text-xs">2</span>
                  <span className="text-muted-foreground">Scroll down, tap <Plus className="inline h-4 w-4 text-foreground mx-0.5" /> <strong className="text-foreground">Add to Home Screen</strong></span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center font-bold text-xs">3</span>
                  <span className="text-muted-foreground">Tap <strong className="text-foreground">Add</strong> to confirm</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-4">
                Install Dope Chicks for offline access, push notifications, and a native app feel.
              </p>
            )}

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={dismiss} className="flex-1 text-xs">
                Not now
              </Button>
              {deferredPrompt ? (
                <Button size="sm" onClick={handleInstall} className="flex-1 text-xs bg-gradient-purple text-primary-foreground font-bold hover:opacity-90">
                  <Download className="h-3.5 w-3.5 mr-1" /> Install
                </Button>
              ) : isiOS ? (
                <Button size="sm" onClick={dismiss} className="flex-1 text-xs bg-gradient-purple text-primary-foreground font-bold hover:opacity-90">
                  <Smartphone className="h-3.5 w-3.5 mr-1" /> Got it
                </Button>
              ) : null}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PWAInstallBanner;
