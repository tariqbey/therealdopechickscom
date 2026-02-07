import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits, CREDIT_PACKAGES } from "@/hooks/useCredits";
import { Button } from "@/components/ui/button";
import { Sparkles, ShoppingCart, X } from "lucide-react";

interface BuyCreditsModalProps {
  open: boolean;
  onClose: () => void;
}

const BuyCreditsModal = ({ open, onClose }: BuyCreditsModalProps) => {
  const { user } = useAuth();
  const { creditBalance, purchaseCredits } = useCredits();
  const [loading, setLoading] = useState<string | null>(null);

  if (!open) return null;

  const handlePurchase = async (priceId: string, packageId: string) => {
    setLoading(packageId);
    await purchaseCredits(priceId);
    setLoading(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 rounded-xl bg-gradient-card border border-border p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-black">Buy Creator Credits</h2>
            <p className="text-sm text-muted-foreground">Current balance: <span className="font-bold text-primary">{creditBalance} Credits</span></p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground mb-4">Credits are used for AI content generation — images, characters, and videos in AI Studio.</p>

        <div className="grid gap-3">
          {CREDIT_PACKAGES.map((pkg) => (
            <div
              key={pkg.id}
              className={`relative flex items-center justify-between p-4 rounded-xl border transition-colors ${
                pkg.popular ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
              }`}
            >
              {pkg.popular && (
                <span className="absolute -top-2.5 left-4 px-2 py-0.5 bg-primary text-primary-foreground text-[10px] font-bold uppercase rounded-full">
                  Best Value
                </span>
              )}
              <div className="flex items-center gap-3">
                <Sparkles className="h-6 w-6 text-primary" />
                <div>
                  <p className="font-bold">{pkg.name}</p>
                  <p className="text-sm text-muted-foreground">{pkg.price}</p>
                </div>
              </div>
              <Button
                size="sm"
                disabled={loading === pkg.id || !user}
                onClick={() => handlePurchase(pkg.priceId, pkg.id)}
                className="bg-gradient-purple text-primary-foreground font-bold hover:opacity-90"
              >
                {loading === pkg.id ? "..." : <><ShoppingCart className="h-4 w-4 mr-1" /> Buy</>}
              </Button>
            </div>
          ))}
        </div>

        {!user && (
          <p className="text-xs text-destructive text-center mt-4">Please log in to purchase credits.</p>
        )}
      </div>
    </div>
  );
};

export default BuyCreditsModal;
