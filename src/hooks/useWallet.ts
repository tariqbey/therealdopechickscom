import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const BREAD_PACKAGES = [
  { id: "500", name: "500 BREAD", amount: 500, price: "$4.99", priceId: "price_1SxpgwKb1BapFa4iMI5JpRC8", popular: false },
  { id: "1200", name: "1,200 BREAD", amount: 1200, price: "$9.99", priceId: "price_1SxphCKb1BapFa4ikZziXHOu", popular: true },
  { id: "3500", name: "3,500 BREAD", amount: 3500, price: "$24.99", priceId: "price_1SxphMKb1BapFa4iZWXgtr1n", popular: false },
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
    refreshWallet,
  };
};
