import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const CREDIT_PACKAGES = [
  { id: "500c", name: "500 Credits", amount: 500, price: "$4.99", priceId: "price_1SxpgwKb1BapFa4iMI5JpRC8", popular: false },
  { id: "1200c", name: "1,200 Credits", amount: 1200, price: "$9.99", priceId: "price_1SxphCKb1BapFa4ikZziXHOu", popular: true },
  { id: "3500c", name: "3,500 Credits", amount: 3500, price: "$24.99", priceId: "price_1SxphMKb1BapFa4iZWXgtr1n", popular: false },
] as const;

export const useCredits = () => {
  const { creditWallet, refreshCreditWallet, session } = useAuth();
  const { toast } = useToast();

  const purchaseCredits = async (priceId: string) => {
    if (!session) {
      toast({ title: "Please log in", description: "You need to be logged in to purchase credits.", variant: "destructive" });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("create-credits-checkout", {
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

  const spendCredits = async (amount: number, description: string): Promise<boolean> => {
    if (!creditWallet || creditWallet.balance < amount) {
      toast({ title: "Insufficient Credits", description: `You need ${amount} credits but have ${creditWallet?.balance ?? 0}.`, variant: "destructive" });
      return false;
    }

    try {
      const { error } = await supabase.functions.invoke("spend-credits", {
        body: { amount, description },
      });

      if (error) throw error;
      await refreshCreditWallet();
      return true;
    } catch (err: any) {
      toast({ title: "Spend failed", description: err.message, variant: "destructive" });
      return false;
    }
  };

  return {
    creditBalance: creditWallet?.balance ?? 0,
    purchaseCredits,
    spendCredits,
    refreshCreditWallet,
  };
};
