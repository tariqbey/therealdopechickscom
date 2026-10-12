import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Coins, Crown, DollarSign, HardDrive, Inbox, ShieldCheck, TrendingDown, TrendingUp, Users, Wallet } from "lucide-react";
import { useSetting } from "@/hooks/usePlatform";

interface Dash {
  rate_per_credit: number;
  total_purchased_credits: number;
  month_purchased_credits: number;
  prev_month_purchased_credits: number;
  period_spent_credits: number;
  period_purchased_credits: number;
  circulating_credits: number;
  creator_earnings_credits: number;
  pending_payouts: number;
  pending_posts: number;
  users: { total: number; creators: number; admins: number; moderators: number; members: number; new_period: number; new_prev_period: number; new_month: number };
  daily: { day: string; purchased: number; spent: number; signups: number }[];
  monthly: { month: string; purchased: number }[];
  content_sales: { kind: string; credits: number }[];
  top_sellers: { user_id: string; name: string | null; avatar: string | null; credits: number }[];
  top_spenders: { user_id: string; name: string | null; avatar: string | null; credits: number }[];
}

interface StorageInfo { total_bytes: number; videos: number; by_creator: { creator_id: string; name: string | null; bytes: number }[]; limit_bytes: number }

const RANGES = [
  { key: "7", label: "Last 7 days" },
  { key: "30", label: "Last 30 days" },
  { key: "90", label: "Last 90 days" },
  { key: "365", label: "Last 12 months" },
];
const PIE = ["#a855f7", "#ec4899", "#e6b422", "#22c55e", "#38bdf8"];

const fmtBytes = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(2)} GB` : b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${(b / 1e3).toFixed(0)} KB`);
const growth = (cur: number, prev: number) => (prev === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - prev) / prev) * 100));

const Growth = ({ value, label }: { value: number; label: string }) => (
  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded ${value >= 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
    {value >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{value >= 0 ? "+" : ""}{value}% <span className="font-normal text-muted-foreground">{label}</span>
  </span>
);

const Card = ({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) => (
  <div className={`rounded-xl bg-gradient-card border border-border p-4 md:p-5 ${className}`}>
    <h3 className="text-sm font-bold text-foreground mb-3">{title}</h3>
    {children}
  </div>
);

const AdminOverviewTab = ({ onNavigate }: { onNavigate: (tab: string) => void }) => {
  const [range, setRange] = useState("7");
  const [d, setD] = useState<Dash | null>(null);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const currency = useSetting("currency");
  const sym = currency.symbol || "$";
  const credit = currency.credit_name || "BREAD";

  useEffect(() => {
    const to = new Date();
    const from = new Date(Date.now() - Number(range) * 86400000);
    (supabase as any).rpc("admin_dashboard", { p_from: from.toISOString(), p_to: to.toISOString() })
      .then(({ data }: { data: Dash | null }) => setD(data));
  }, [range]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      try {
        const r = await fetch("/api/admin-storage", { headers: { Authorization: `Bearer ${session.access_token}` } });
        if (r.ok) setStorage(await r.json());
      } catch { /* storage card stays empty */ }
    })();
  }, []);

  if (!d) return <div className="animate-pulse text-muted-foreground">Loading dashboard…</div>;

  const usd = (credits: number) => `${sym}${(credits * (d.rate_per_credit || 0.1)).toFixed(2)}`;
  const monthGrowth = growth(d.month_purchased_credits, d.prev_month_purchased_credits);
  const newUsersGrowth = growth(d.users.new_period, d.users.new_prev_period);
  const salesTotal = d.content_sales.reduce((a, s) => a + Number(s.credits), 0);
  const daily = d.daily.map((x) => ({ ...x, label: new Date(x.day).toLocaleDateString("en-US", { month: "short", day: "numeric" }), purchasedUsd: Number(x.purchased) * d.rate_per_credit, spentUsd: Number(x.spent) * d.rate_per_credit }));
  const monthly = d.monthly.map((m) => ({ ...m, usd: Number(m.purchased) * d.rate_per_credit }));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Headline numbers */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Total earnings">
          <div className="text-3xl font-display font-bold">{usd(d.total_purchased_credits)}</div>
          <div className="mt-1"><Growth value={monthGrowth} label="this month" /></div>
          <div className="h-36 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthly}>
                <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a855f7" stopOpacity={0.5} /><stop offset="100%" stopColor="#a855f7" stopOpacity={0} /></linearGradient></defs>
                <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={36} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} formatter={(v: number) => [`${sym}${v.toFixed(2)}`, "Purchases"]} />
                <Area type="monotone" dataKey="usd" stroke="#a855f7" fill="url(#g1)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Platform value">
          <div className="grid grid-cols-2 gap-3">
            <div><div className="text-[11px] uppercase tracking-wider text-muted-foreground">{credit} in circulation</div><div className="text-2xl font-bold">{Number(d.circulating_credits).toLocaleString()}</div><div className="text-xs text-muted-foreground">{usd(d.circulating_credits)} liability</div></div>
            <div><div className="text-[11px] uppercase tracking-wider text-muted-foreground">Creator earnings held</div><div className="text-2xl font-bold">{Number(d.creator_earnings_credits).toLocaleString()}</div><div className="text-xs text-muted-foreground">{usd(d.creator_earnings_credits)} owed</div></div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <button onClick={() => onNavigate("payouts")} className="rounded-lg border border-border bg-muted/40 p-3 text-left hover:border-primary/50">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Inbox className="h-3.5 w-3.5" /> Pending payouts</div>
              <div className="text-xl font-bold">{d.pending_payouts}</div>
            </button>
            <button onClick={() => onNavigate("contentwall")} className="rounded-lg border border-border bg-muted/40 p-3 text-left hover:border-primary/50">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> Posts awaiting review</div>
              <div className="text-xl font-bold">{d.pending_posts}</div>
            </button>
          </div>
        </Card>
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">Show</span>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-44 bg-muted border-border h-9"><SelectValue /></SelectTrigger>
          <SelectContent>{RANGES.map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <Card title={`Period earnings · ${usd(d.period_purchased_credits)} purchased · ${usd(d.period_spent_credits)} spent`}>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={40} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} formatter={(v: number, n: string) => [`${sym}${v.toFixed(2)}`, n === "purchasedUsd" ? "Purchased" : "Spent"]} />
              <Area type="monotone" dataKey="purchasedUsd" stroke="#a855f7" fill="#a855f7" fillOpacity={0.2} />
              <Area type="monotone" dataKey="spentUsd" stroke="#ec4899" fill="#ec4899" fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Users */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card title="Total users">
          <div className="text-3xl font-bold">{d.users.total}</div>
          <div className="mt-1"><Growth value={growth(d.users.new_month, Math.max(0, d.users.total - d.users.new_month))} label="this month" /></div>
          <div className="grid grid-cols-2 gap-2 mt-4 text-sm">
            {[["Creators", d.users.creators, Crown], ["Members", d.users.members, Users], ["Moderators", d.users.moderators, ShieldCheck], ["Admins", d.users.admins, ShieldCheck]].map(([l, v, I]: any) => (
              <div key={l} className="flex items-center justify-between rounded-lg bg-muted/40 border border-border px-3 py-2"><span className="flex items-center gap-1.5 text-muted-foreground text-xs"><I className="h-3.5 w-3.5" />{l}</span><span className="font-bold">{v}</span></div>
            ))}
          </div>
        </Card>
        <Card title="New users">
          <div className="text-3xl font-bold">{d.users.new_period}</div>
          <div className="mt-1"><Growth value={newUsersGrowth} label="vs previous period" /></div>
          <div className="h-28 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily}><XAxis dataKey="label" hide /><Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} /><Bar dataKey="signups" fill="#e6b422" radius={[3, 3, 0, 0]} /></BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Content sales">
          <div className="text-3xl font-bold">{usd(salesTotal)}</div>
          <div className="text-xs text-muted-foreground mt-1">{salesTotal.toLocaleString()} {credit} spent on content</div>
          {d.content_sales.length > 0 ? (
            <div className="h-32 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={d.content_sales.map((s) => ({ ...s, credits: Number(s.credits) }))} dataKey="credits" nameKey="kind" innerRadius={28} outerRadius={48} paddingAngle={2}>
                    {d.content_sales.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                  </Pie>
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="text-xs text-muted-foreground mt-6">No sales in this period</div>}
        </Card>
      </div>

      {/* Top lists */}
      <div className="grid md:grid-cols-2 gap-4">
        {[["Top 10 best-selling creators", d.top_sellers, "earned"], ["Top 10 spending users", d.top_spenders, "spent"]].map(([title, list, verb]: any) => (
          <Card key={title} title={`${title} · all time`}>
            {list.length === 0 ? <div className="text-xs text-muted-foreground">No data</div> : (
              <ol className="space-y-2">
                {list.map((u: any, i: number) => (
                  <li key={u.user_id} className="flex items-center gap-3 text-sm">
                    <span className="w-5 text-xs text-muted-foreground">{i + 1}.</span>
                    <div className="h-7 w-7 rounded-full bg-muted overflow-hidden flex items-center justify-center text-xs font-bold">{u.avatar ? <img src={u.avatar} alt="" className="w-full h-full object-cover" /> : (u.name || "?")[0]?.toUpperCase()}</div>
                    <span className="flex-1 truncate">{u.name || "Unknown"}</span>
                    <span className="font-semibold tabular-nums">{Number(u.credits).toLocaleString()} {credit}</span>
                    <span className="text-xs text-muted-foreground w-16 text-right">{usd(Number(u.credits))} {verb}</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        ))}
      </div>

      {/* Storage */}
      <Card title="Storage">
        {!storage ? <div className="text-xs text-muted-foreground">Storage stats unavailable</div> : (
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center gap-2 text-sm"><HardDrive className="h-4 w-4 text-primary" /> Used space <span className="ml-auto font-bold">{fmtBytes(storage.total_bytes)}</span></div>
              <div className="h-2 rounded-full bg-muted mt-2 overflow-hidden"><div className="h-full bg-gradient-to-r from-[#a855f7] to-[#ec4899]" style={{ width: `${Math.min(100, (storage.total_bytes / storage.limit_bytes) * 100)}%` }} /></div>
              <div className="flex justify-between text-[11px] text-muted-foreground mt-1"><span>0</span><span>{fmtBytes(storage.limit_bytes)} free tier</span></div>
              <div className="text-xs text-muted-foreground mt-3">{storage.videos} VR videos in Cloudflare R2 (zero egress fees). Supabase buckets hold thumbnails, avatars and video messages.</div>
            </div>
            <div>
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Top users by storage</div>
              {storage.by_creator.length === 0 ? <div className="text-xs text-muted-foreground">No data</div> : (
                <ul className="space-y-1.5 text-sm">{storage.by_creator.slice(0, 10).map((c) => <li key={c.creator_id} className="flex justify-between"><span className="truncate">{c.name || c.creator_id.slice(0, 8)}</span><span className="font-semibold tabular-nums">{fmtBytes(c.bytes)}</span></li>)}</ul>
              )}
            </div>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[["Purchases (period)", usd(d.period_purchased_credits), DollarSign], ["Spent (period)", usd(d.period_spent_credits), Coins], ["Wallets", `${Number(d.circulating_credits).toLocaleString()} ${credit}`, Wallet], ["Creators", d.users.creators, Crown]].map(([l, v, I]: any) => (
          <div key={l} className="rounded-xl bg-gradient-card border border-border p-4"><div className="flex items-center justify-between mb-2"><span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{l}</span><I className="h-4 w-4 text-primary" /></div><div className="text-xl font-bold">{v}</div></div>
        ))}
      </div>
    </motion.div>
  );
};

export default AdminOverviewTab;
