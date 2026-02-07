import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet, BREAD_PACKAGES } from "@/hooks/useWallet";
import { Button } from "@/components/ui/button";
import { Coins, ShoppingCart, X } from "lucide-react";

interface BuyBreadModalProps {
  open: boolean;
  onClose: () => void;
}

const BuyBreadModal = ({ open, onClose }: BuyBreadModalProps) => {
  const { user } = useAuth();
  const { balance, purchaseBread } = useWallet();
  const [loading, setLoading] = useState<string | null>(null);

  if (!open) return null;

  const handlePurchase = async (priceId: string, packageId: string) => {
    setLoading(packageId);
    await purchaseBread(priceId);
    setLoading(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-4 rounded-xl bg-gradient-card border border-border p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-black">Buy BREAD Credits</h2>
            <p className="text-sm text-muted-foreground">Current balance: <span className="font-bold text-gradient-gold">{balance} BREAD</span></p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {BREAD_PACKAGES.map((pkg) => (
            <div
              key={pkg.id}
              className={`relative flex flex-col items-center p-4 rounded-xl border transition-colors ${
                pkg.popular ? "border-accent bg-accent/5" : "border-border hover:border-primary/30"
              }`}
            >
              {pkg.popular && (
                <span className="absolute -top-2.5 px-2 py-0.5 bg-accent text-accent-foreground text-[10px] font-bold uppercase rounded-full">
                  Best Value
                </span>
              )}
              <div className="text-xl font-black text-gradient-gold">{pkg.amount}</div>
              <div className="text-[10px] text-muted-foreground mb-1">BREAD</div>
              <div className="text-sm font-bold mb-2">{pkg.price}</div>
              <Button
                size="sm"
                disabled={loading === pkg.id || !user}
                onClick={() => handlePurchase(pkg.priceId, pkg.id)}
                className="w-full bg-gradient-purple text-primary-foreground font-bold hover:opacity-90 h-8 text-xs"
              >
                {loading === pkg.id ? "..." : <><ShoppingCart className="h-3 w-3 mr-1" /> Buy</>}
              </Button>
            </div>
          ))}
        </div>

        {!user && (
          <p className="text-xs text-destructive text-center mt-4">Please log in to purchase BREAD credits.</p>
        )}
      </div>
    </div>
  );
};

export default BuyBreadModal;
