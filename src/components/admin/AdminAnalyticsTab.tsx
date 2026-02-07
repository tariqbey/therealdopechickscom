import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
} from "recharts";
import { DollarSign, TrendingUp, Coins, Sparkles } from "lucide-react";

interface TimePoint {
  date: string;
  count: number;
}

interface CostData {
  totalApiCostCents: number;
  totalPlatformFeeCents: number;
  totalBreadCharged: number;
  totalGenerations: number;
  byType: Record<string, { count: number; apiCostCents: number; breadCharged: number }>;
}

const AdminAnalyticsTab = () => {
  const [signups, setSignups] = useState<TimePoint[]>([]);
  const [transactions, setTransactions] = useState<TimePoint[]>([]);
  const [generations, setGenerations] = useState<TimePoint[]>([]);
  const [costData, setCostData] = useState<CostData>({
    totalApiCostCents: 0, totalPlatformFeeCents: 0, totalBreadCharged: 0,
    totalGenerations: 0, byType: {},
  });
  const [revenueByDay, setRevenueByDay] = useState<{ date: string; revenue: number; cost: number; profit: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);

      const [profileRes, txRes, genRes, spendRes] = await Promise.all([
        supabase.from("profiles").select("created_at").order("created_at", { ascending: true }),
        supabase.from("wallet_transactions").select("created_at, amount, type").order("created_at", { ascending: true }),
        supabase.from("ai_generations").select("created_at, generation_type, cost, api_cost_cents, platform_fee_cents, status").order("created_at", { ascending: true }),
        supabase.from("wallet_transactions").select("created_at, amount").eq("type", "spend").order("created_at", { ascending: true }),
      ]);

      setSignups(aggregateByDay(profileRes.data || []));
      setTransactions(aggregateByDay(txRes.data || []));
      setGenerations(aggregateByDay(genRes.data || []));

      // Cost tracking
      const gens = genRes.data || [];
      let totalApiCost = 0;
      let totalFees = 0;
      let totalBread = 0;
      const byType: CostData["byType"] = {};

      gens.forEach((g: any) => {
        const apiCost = g.api_cost_cents || 0;
        const fee = g.platform_fee_cents || 15;
        totalApiCost += apiCost;
        totalFees += fee;
        totalBread += g.cost || 0;

        if (!byType[g.generation_type]) {
          byType[g.generation_type] = { count: 0, apiCostCents: 0, breadCharged: 0 };
        }
        byType[g.generation_type].count++;
        byType[g.generation_type].apiCostCents += apiCost;
        byType[g.generation_type].breadCharged += g.cost || 0;
      });

      setCostData({
        totalApiCostCents: totalApiCost,
        totalPlatformFeeCents: totalFees,
        totalBreadCharged: totalBread,
        totalGenerations: gens.length,
        byType,
      });

      // Revenue by day (BREAD spent by users)
      const spendTxs = spendRes.data || [];
      const dayMap: Record<string, { revenue: number; cost: number }> = {};

      spendTxs.forEach((tx: any) => {
        const day = tx.created_at.slice(0, 10);
        if (!dayMap[day]) dayMap[day] = { revenue: 0, cost: 0 };
        dayMap[day].revenue += Math.abs(tx.amount);
      });

      // Map API costs by day from generations
      gens.forEach((g: any) => {
        const day = g.created_at.slice(0, 10);
        if (!dayMap[day]) dayMap[day] = { revenue: 0, cost: 0 };
        dayMap[day].cost += ((g.api_cost_cents || 0) / 100);
      });

      setRevenueByDay(
        Object.entries(dayMap)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, d]) => ({
            date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            revenue: d.revenue,
            cost: parseFloat(d.cost.toFixed(2)),
            profit: parseFloat((d.revenue * 0.01 - d.cost).toFixed(2)), // BREAD to $ conversion
          }))
      );

      setLoading(false);
    };
    fetchAnalytics();
  }, []);

  const aggregateByDay = (rows: { created_at: string }[]): TimePoint[] => {
    const map: Record<string, number> = {};
    rows.forEach((r) => {
      const day = r.created_at.slice(0, 10);
      map[day] = (map[day] || 0) + 1;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({
        date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        count,
      }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading analytics…</div>
      </div>
    );
  }

  const chartStyle = { fontSize: 11, fill: "hsl(0, 0%, 55%)" };
  const tooltipStyle = {
    background: "hsl(0, 0%, 7%)", border: "1px solid hsl(0, 0%, 15%)",
    borderRadius: 8, fontSize: 12,
  };

  const totalRevenueDollars = (costData.totalBreadCharged * 0.01).toFixed(2);
  const totalApiCostDollars = (costData.totalApiCostCents / 100).toFixed(2);
  const totalProfitDollars = (costData.totalBreadCharged * 0.01 - costData.totalApiCostCents / 100).toFixed(2);

  const pieData = Object.entries(costData.byType).map(([type, data]) => ({
    name: type.charAt(0).toUpperCase() + type.slice(1),
    value: data.count,
  }));
  const PIE_COLORS = ["hsl(270, 60%, 55%)", "hsl(42, 80%, 55%)", "hsl(160, 60%, 45%)"];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard icon={DollarSign} label="Total Revenue" value={`$${totalRevenueDollars}`} sub={`${costData.totalBreadCharged} BREAD earned`} color="text-green-500" />
        <SummaryCard icon={TrendingUp} label="API Costs" value={`$${totalApiCostDollars}`} sub="Actual provider costs" color="text-destructive" />
        <SummaryCard icon={Coins} label="Net Profit" value={`$${totalProfitDollars}`} sub="Revenue minus API costs" color="text-accent" />
        <SummaryCard icon={Sparkles} label="Generations" value={`${costData.totalGenerations}`} sub={`${Object.keys(costData.byType).length} types used`} color="text-primary" />
      </div>

      {/* Revenue vs Cost Chart */}
      <div className="rounded-xl bg-gradient-card border border-border p-6">
        <h3 className="text-lg font-display font-bold text-foreground mb-4">Revenue vs API Costs (Daily)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 15%)" />
              <XAxis dataKey="date" tick={chartStyle} />
              <YAxis tick={chartStyle} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="profit" fill="hsl(160, 60%, 45%)" radius={[4, 4, 0, 0]} name="Profit ($)" />
              <Bar dataKey="cost" fill="hsl(0, 60%, 50%)" radius={[4, 4, 0, 0]} name="API Cost ($)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {revenueByDay.length === 0 && <p className="text-sm text-muted-foreground text-center mt-2">No revenue data yet</p>}
      </div>

      {/* Cost by Generation Type */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-xl bg-gradient-card border border-border p-6">
          <h3 className="text-lg font-display font-bold text-foreground mb-4">Generations by Type</h3>
          {pieData.length > 0 ? (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No generation data yet</p>
          )}
        </div>

        <div className="rounded-xl bg-gradient-card border border-border p-6">
          <h3 className="text-lg font-display font-bold text-foreground mb-4">Cost Breakdown by Type</h3>
          <div className="space-y-3">
            {Object.entries(costData.byType).map(([type, data]) => (
              <div key={type} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-bold capitalize">{type}</p>
                  <p className="text-xs text-muted-foreground">{data.count} generations</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gradient-gold">{data.breadCharged} BREAD</p>
                  <p className="text-xs text-muted-foreground">API: ${(data.apiCostCents / 100).toFixed(2)}</p>
                </div>
              </div>
            ))}
            {Object.keys(costData.byType).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No data yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Existing charts */}
      <div className="rounded-xl bg-gradient-card border border-border p-6">
        <h3 className="text-lg font-display font-bold text-foreground mb-4">User Signups</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={signups}>
              <defs>
                <linearGradient id="signupGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(270, 60%, 55%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(270, 60%, 55%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 15%)" />
              <XAxis dataKey="date" tick={chartStyle} />
              <YAxis tick={chartStyle} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="count" stroke="hsl(270, 60%, 55%)" fill="url(#signupGrad)" strokeWidth={2} name="Signups" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {signups.length === 0 && <p className="text-sm text-muted-foreground text-center mt-2">No signup data yet</p>}
      </div>

      <div className="rounded-xl bg-gradient-card border border-border p-6">
        <h3 className="text-lg font-display font-bold text-foreground mb-4">BREAD Transactions</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={transactions}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 15%)" />
              <XAxis dataKey="date" tick={chartStyle} />
              <YAxis tick={chartStyle} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="hsl(42, 80%, 55%)" radius={[4, 4, 0, 0]} name="Transactions" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {transactions.length === 0 && <p className="text-sm text-muted-foreground text-center mt-2">No transaction data yet</p>}
      </div>

      <div className="rounded-xl bg-gradient-card border border-border p-6">
        <h3 className="text-lg font-display font-bold text-foreground mb-4">AI Generation Trends</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={generations}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 15%)" />
              <XAxis dataKey="date" tick={chartStyle} />
              <YAxis tick={chartStyle} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="count" stroke="hsl(270, 80%, 65%)" strokeWidth={2} dot={{ fill: "hsl(270, 80%, 65%)", r: 3 }} name="Generations" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {generations.length === 0 && <p className="text-sm text-muted-foreground text-center mt-2">No generation data yet</p>}
      </div>
    </motion.div>
  );
};

const SummaryCard = ({
  icon: Icon, label, value, sub, color,
}: {
  icon: React.ElementType; label: string; value: string; sub: string; color: string;
}) => (
  <div className="rounded-xl bg-gradient-card border border-border p-4">
    <div className="flex items-center gap-2 mb-2">
      <Icon className={`h-4 w-4 ${color}`} />
      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
    <p className="text-2xl font-black text-foreground">{value}</p>
    <p className="text-xs text-muted-foreground mt-1">{sub}</p>
  </div>
);

export default AdminAnalyticsTab;
