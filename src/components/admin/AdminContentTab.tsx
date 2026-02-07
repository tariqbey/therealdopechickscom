import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { DollarSign, TrendingUp, Activity, BarChart3, ToggleLeft } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface GenerationRow {
  api_cost_cents: number;
  platform_fee_cents: number;
  cost: number;
  generation_type: string;
  status: string;
  created_at: string;
}

const AdminContentTab = () => {
  const [generations, setGenerations] = useState<GenerationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDummy, setShowDummy] = useState(true);
  const [savingDummy, setSavingDummy] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const [genRes, settingRes] = await Promise.all([
        supabase
          .from("ai_generations")
          .select("api_cost_cents, platform_fee_cents, cost, generation_type, status, created_at")
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase
          .from("platform_settings")
          .select("*")
          .eq("key", "show_dummy_content")
          .maybeSingle(),
      ]);
      setGenerations((genRes.data as GenerationRow[]) || []);
      if (settingRes.data) {
        setShowDummy((settingRes.data as any).value?.enabled ?? true);
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const toggleDummy = async (enabled: boolean) => {
    setSavingDummy(true);
    setShowDummy(enabled);
    const { error } = await supabase
      .from("platform_settings")
      .update({ value: { enabled } as any, updated_at: new Date().toISOString() })
      .eq("key", "show_dummy_content");
    if (error) {
      toast.error("Failed to update");
      setShowDummy(!enabled);
    } else {
      toast.success(`Dummy content ${enabled ? "enabled" : "disabled"}`);
    }
    setSavingDummy(false);
  };

  const completed = generations.filter((g) => g.status === "completed");
  const totalApiCost = completed.reduce((s, g) => s + g.api_cost_cents, 0);
  const totalPlatformFee = completed.reduce((s, g) => s + g.platform_fee_cents, 0);
  const totalProfit = totalPlatformFee;
  const totalBreadSpent = completed.reduce((s, g) => s + g.cost, 0);

  // By type breakdown
  const byType: Record<string, { count: number; apiCost: number; fee: number; bread: number }> = {};
  completed.forEach((g) => {
    if (!byType[g.generation_type]) byType[g.generation_type] = { count: 0, apiCost: 0, fee: 0, bread: 0 };
    byType[g.generation_type].count++;
    byType[g.generation_type].apiCost += g.api_cost_cents;
    byType[g.generation_type].fee += g.platform_fee_cents;
    byType[g.generation_type].bread += g.cost;
  });

  // Last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recent = completed.filter((g) => new Date(g.created_at) >= thirtyDaysAgo);
  const recentApiCost = recent.reduce((s, g) => s + g.api_cost_cents, 0);
  const recentProfit = recent.reduce((s, g) => s + g.platform_fee_cents, 0);

  const cents = (v: number) => `$${(v / 100).toFixed(2)}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }

  const statCards = [
    { label: "Total API Cost", value: cents(totalApiCost), sub: `${completed.length} generations`, icon: Activity, color: "text-destructive" },
    { label: "Platform Fees (Profit)", value: cents(totalProfit), sub: `~$0.15/request`, icon: TrendingUp, color: "text-green-400" },
    { label: "BREAD Collected", value: `${totalBreadSpent.toLocaleString()} 🍞`, sub: "from users", icon: DollarSign, color: "text-accent" },
    { label: "30-Day Profit", value: cents(recentProfit), sub: `Cost: ${cents(recentApiCost)}`, icon: BarChart3, color: "text-primary" },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Dummy Content Toggle */}
      <div className="rounded-xl bg-gradient-card border border-border p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ToggleLeft className="h-5 w-5 text-primary" />
            <div>
              <Label className="text-sm font-medium text-foreground">Dummy / Placeholder Content</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Show sample content on profiles without real posts</p>
            </div>
          </div>
          <Switch checked={showDummy} onCheckedChange={toggleDummy} disabled={savingDummy} />
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="rounded-xl bg-gradient-card border border-border p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{card.label}</span>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
            <p className="text-2xl font-display font-bold text-foreground">{card.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Breakdown by Type */}
      <div className="rounded-xl bg-gradient-card border border-border p-6">
        <h3 className="text-lg font-display font-bold text-foreground mb-4">Breakdown by Generation Type</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground text-left border-b border-border">
                <th className="pb-3 font-medium">Type</th>
                <th className="pb-3 font-medium text-right">Count</th>
                <th className="pb-3 font-medium text-right">API Cost</th>
                <th className="pb-3 font-medium text-right">Platform Fee</th>
                <th className="pb-3 font-medium text-right">Net Profit</th>
                <th className="pb-3 font-medium text-right">BREAD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {Object.entries(byType)
                .sort((a, b) => b[1].count - a[1].count)
                .map(([type, data]) => (
                  <tr key={type} className="text-foreground">
                    <td className="py-3 capitalize font-medium">{type.replace(/_/g, " ")}</td>
                    <td className="py-3 text-right text-muted-foreground">{data.count}</td>
                    <td className="py-3 text-right text-destructive">{cents(data.apiCost)}</td>
                    <td className="py-3 text-right text-green-400">{cents(data.fee)}</td>
                    <td className="py-3 text-right font-semibold text-green-400">{cents(data.fee)}</td>
                    <td className="py-3 text-right text-muted-foreground">{data.bread} 🍞</td>
                  </tr>
                ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border font-bold text-foreground">
                <td className="pt-3">Total</td>
                <td className="pt-3 text-right">{completed.length}</td>
                <td className="pt-3 text-right text-destructive">{cents(totalApiCost)}</td>
                <td className="pt-3 text-right text-green-400">{cents(totalPlatformFee)}</td>
                <td className="pt-3 text-right text-green-400">{cents(totalProfit)}</td>
                <td className="pt-3 text-right">{totalBreadSpent} 🍞</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Margin info */}
      <div className="rounded-xl bg-gradient-card border border-border p-5">
        <h3 className="text-sm font-bold text-foreground mb-2">💡 Margin Notes</h3>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
          <li>Each AI request includes a ~$0.15 platform surcharge on top of API costs</li>
          <li>Platform Fee column = your net revenue per generation</li>
          <li>BREAD collected = total user currency spent (priced to cover cost + margin)</li>
        </ul>
      </div>
    </motion.div>
  );
};

export default AdminContentTab;
