import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, Loader2, Receipt } from "lucide-react";
import { format } from "date-fns";

interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  created_at: string;
}

const TransactionHistory = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [breadTxns, setBreadTxns] = useState<Transaction[]>([]);
  const [creditTxns, setCreditTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    const load = async () => {
      setLoading(true);
      const [b, c] = await Promise.all([
        supabase.from("wallet_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
        supabase.from("credit_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
      ]);
      setBreadTxns((b.data as Transaction[]) || []);
      setCreditTxns((c.data as Transaction[]) || []);
      setLoading(false);
    };
    load();
  }, [user]);

  const renderList = (txns: Transaction[], currency: string) => {
    if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
    if (txns.length === 0) return (
      <div className="text-center py-12 text-muted-foreground">
        <Receipt className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm">No {currency} transactions yet.</p>
      </div>
    );

    return (
      <div className="space-y-2">
        {txns.map((tx) => {
          const isCredit = tx.amount > 0;
          return (
            <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl bg-card border border-border">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isCredit ? "bg-green-500/10" : "bg-red-500/10"}`}>
                  {isCredit ? <ArrowDownLeft className="h-4 w-4 text-green-500" /> : <ArrowUpRight className="h-4 w-4 text-red-500" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{tx.description || tx.type}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(tx.created_at), "MMM d, yyyy • h:mm a")}</p>
                </div>
              </div>
              <span className={`text-sm font-bold ${isCredit ? "text-green-500" : "text-red-500"}`}>
                {isCredit ? "+" : ""}{tx.amount} {currency}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12 max-w-2xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <h1 className="text-3xl font-black mb-6">Transaction History</h1>

          <Tabs defaultValue="bread">
            <TabsList className="w-full mb-4">
              <TabsTrigger value="bread" className="flex-1">🍞 BREAD</TabsTrigger>
              <TabsTrigger value="credits" className="flex-1">✨ Credits</TabsTrigger>
            </TabsList>
            <TabsContent value="bread">{renderList(breadTxns, "BREAD")}</TabsContent>
            <TabsContent value="credits">{renderList(creditTxns, "Credits")}</TabsContent>
          </Tabs>
        </motion.div>
      </div>
      <Footer />
    </div>
  );
};

export default TransactionHistory;
