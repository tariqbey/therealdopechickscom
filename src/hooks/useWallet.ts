import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const BREAD_PACKAGES = [
  { id: "50", name: "50 BREAD", amount: 50, price: "$4.99", priceId: "price_1SyE9VKb1BapFa4iRNnwQbdY", popular: false },
  { id: "100", name: "100 BREAD", amount: 100, price: "$10.00", priceId: "price_1SyEAVKb1BapFa4iRdbLTQ7L", popular: false },
  { id: "250", name: "250 BREAD", amount: 250, price: "$20.00", priceId: "price_1SyEAlKb1BapFa4iQRsEOzVT", popular: false },
  { id: "500", name: "500 BREAD", amount: 500, price: "$40.00", priceId: "price_1SyEAvKb1BapFa4it4SG0KCJ", popular: true },
  { id: "1000", name: "1,000 BREAD", amount: 1000, price: "$75.00", priceId: "price_1SyEB7Kb1BapFa4iSthPX9Cb", popular: false },
  { id: "2500", name: "2,500 BREAD", amount: 2500, price: "$175.00", priceId: "price_1SyEBHKb1BapFa4iDE4O5ujE", popular: false },
] as const;

export const useWallet = () => {
  const { wallet, refreshWallet, session } = useAuth();
  const { toast } = useToast();

  const purchaseBread = async (priceId: string) => {
    if (!session) {
      toast({ title: "Please log in", description: "You need to be logged in to purchase BREAD.", variant: "destructive" });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("create-bread-checkout", {
        body: { priceId },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast({ title: "Purchase failed", description: err.message, variant: "destructive" });
    }
  };

  const verifySession = async (sessionId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("verify-session", {
        body: { sessionId },
      });
      if (error) throw error;
      if (data?.credited) {
        await refreshWallet();
        if (!data.already_processed) {
          toast({ title: "BREAD credited! 🍞", description: "Your BREAD balance has been updated." });
        }
      }
    } catch (err: any) {
      console.error("BREAD verify error:", err);
    }
  };

  const spendBread = async (amount: number, description: string): Promise<boolean> => {
    if (!wallet || wallet.balance < amount) {
      toast({ title: "Insufficient BREAD", description: `You need ${amount} BREAD but have ${wallet?.balance ?? 0}.`, variant: "destructive" });
      return false;
    }

    try {
      const { error } = await supabase.functions.invoke("spend-bread", {
        body: { amount, description },
      });

      if (error) throw error;
      await refreshWallet();
      return true;
    } catch (err: any) {
      toast({ title: "Spend failed", description: err.message, variant: "destructive" });
      return false;
    }
  };

  return {
    balance: wallet?.balance ?? 0,
    purchaseBread,
    spendBread,
    verifySession,
    refreshWallet,
  };
};
