import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";

interface TimePoint {
  date: string;
  count: number;
}

const AdminAnalyticsTab = () => {
  const [signups, setSignups] = useState<TimePoint[]>([]);
  const [transactions, setTransactions] = useState<TimePoint[]>([]);
  const [generations, setGenerations] = useState<TimePoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);

      // Signups over time (from profiles.created_at)
      const { data: profileData } = await supabase
        .from("profiles")
        .select("created_at")
        .order("created_at", { ascending: true });

      // Wallet transactions over time
      const { data: txData } = await supabase
        .from("wallet_transactions")
        .select("created_at, amount")
        .order("created_at", { ascending: true });

      // AI generations over time
      const { data: genData } = await supabase
        .from("ai_generations")
        .select("created_at")
        .order("created_at", { ascending: true });

      setSignups(aggregateByDay(profileData || []));
      setTransactions(aggregateByDay(txData || []));
      setGenerations(aggregateByDay(genData || []));
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

  const chartStyle = {
    fontSize: 11,
    fill: "hsl(0, 0%, 55%)",
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Signups */}
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
              <Tooltip
                contentStyle={{
                  background: "hsl(0, 0%, 7%)",
                  border: "1px solid hsl(0, 0%, 15%)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="hsl(270, 60%, 55%)"
                fill="url(#signupGrad)"
                strokeWidth={2}
                name="Signups"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {signups.length === 0 && (
          <p className="text-sm text-muted-foreground text-center mt-2">No signup data yet</p>
        )}
      </div>

      {/* BREAD Transactions */}
      <div className="rounded-xl bg-gradient-card border border-border p-6">
        <h3 className="text-lg font-display font-bold text-foreground mb-4">BREAD Transactions</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={transactions}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 15%)" />
              <XAxis dataKey="date" tick={chartStyle} />
              <YAxis tick={chartStyle} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "hsl(0, 0%, 7%)",
                  border: "1px solid hsl(0, 0%, 15%)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="count" fill="hsl(42, 80%, 55%)" radius={[4, 4, 0, 0]} name="Transactions" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {transactions.length === 0 && (
          <p className="text-sm text-muted-foreground text-center mt-2">No transaction data yet</p>
        )}
      </div>

      {/* AI Generations */}
      <div className="rounded-xl bg-gradient-card border border-border p-6">
        <h3 className="text-lg font-display font-bold text-foreground mb-4">AI Generation Trends</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={generations}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 15%)" />
              <XAxis dataKey="date" tick={chartStyle} />
              <YAxis tick={chartStyle} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "hsl(0, 0%, 7%)",
                  border: "1px solid hsl(0, 0%, 15%)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="hsl(270, 80%, 65%)"
                strokeWidth={2}
                dot={{ fill: "hsl(270, 80%, 65%)", r: 3 }}
                name="Generations"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {generations.length === 0 && (
          <p className="text-sm text-muted-foreground text-center mt-2">No generation data yet</p>
        )}
      </div>
    </motion.div>
  );
};

export default AdminAnalyticsTab;
