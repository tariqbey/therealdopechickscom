import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSetting } from "@/hooks/usePlatform";
import { Download, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

interface Tx { id: string; ledger: "bread" | "earnings"; user_id: string; display_name: string | null; amount: number; type: string; description: string | null; reference_id: string | null; created_at: string; total_count: number }

const KINDS = [["all", "All transactions"], ["bread", "BREAD wallet (fans)"], ["earnings", "Creator earnings"], ["purchase", "Purchases"], ["spend", "Spends"], ["refund", "Refunds"], ["earning", "Earnings"], ["payout", "Payouts"], ["bonus", "Bonuses"]];

const AdminTransactionsTab = () => {
  const currency = useSetting("currency");
  const [rows, setRows] = useState<Tx[]>([]);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const PAGE = 100;

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("admin_transactions", {
      p_search: search || null, p_kind: kind,
      p_from: from ? new Date(from).toISOString() : null,
      p_to: to ? new Date(to + "T23:59:59").toISOString() : null,
      p_limit: PAGE, p_offset: page * PAGE,
    });
    if (error) toast.error(error.message);
    setRows((data as Tx[]) || []);
    setLoading(false);
  }, [search, kind, from, to, page]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const total = rows[0]?.total_count ?? 0;
  const usd = (c: number) => `${currency.symbol}${(Math.abs(c) * currency.rate_per_credit).toFixed(2)}`;

  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = ["id,date,user,user_id,ledger,type,credits,usd,description,reference", ...rows.map((t) => [t.id, t.created_at, t.display_name, t.user_id, t.ledger, t.type, t.amount, (t.amount * currency.rate_per_credit).toFixed(2), t.description, t.reference_id].map(esc).join(","))].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-4 gap-3">
        <div className="relative"><Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="User, ID or description" className="pl-9 bg-muted border-border" /></div>
        <Select value={kind} onValueChange={(v) => { setKind(v); setPage(0); }}><SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger><SelectContent>{KINDS.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
        <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} className="bg-muted border-border" />
        <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} className="bg-muted border-border" />
      </div>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span><span className="font-bold text-foreground">{total.toLocaleString()}</span> transactions</span>
        <Button variant="outline" size="sm" className="ml-auto" onClick={exportCsv} disabled={!rows.length}><Download className="h-4 w-4 mr-1.5" /> Export CSV</Button>
      </div>
      <div className="rounded-xl bg-gradient-card border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead><tr className="text-muted-foreground text-left border-b border-border text-xs"><th className="p-3 font-medium">Date</th><th className="p-3 font-medium">User</th><th className="p-3 font-medium">Ledger</th><th className="p-3 font-medium">Type</th><th className="p-3 font-medium">Description</th><th className="p-3 font-medium text-right">Credits</th><th className="p-3 font-medium text-right">{currency.main}</th></tr></thead>
            <tbody className="divide-y divide-border">
              {loading && rows.length === 0 ? <tr><td colSpan={7} className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin inline text-muted-foreground" /></td></tr>
              : rows.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No matching results found</td></tr>
              : rows.map((t) => (
                <tr key={t.ledger + t.id}>
                  <td className="p-3 text-muted-foreground whitespace-nowrap">{new Date(t.created_at).toLocaleString()}</td>
                  <td className="p-3"><div className="font-medium truncate max-w-[160px]">{t.display_name || "Unknown"}</div><div className="text-[10px] font-mono text-muted-foreground">{t.user_id.slice(0, 8)}</div></td>
                  <td className="p-3"><span className={`text-[11px] px-2 py-0.5 rounded-full ${t.ledger === "bread" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"}`}>{t.ledger === "bread" ? "BREAD" : "Earnings"}</span></td>
                  <td className="p-3 capitalize">{t.type}</td>
                  <td className="p-3 text-muted-foreground truncate max-w-[280px]">{t.description || "—"}</td>
                  <td className={`p-3 text-right tabular-nums font-semibold ${t.amount >= 0 ? "text-emerald-400" : "text-red-400"}`}>{t.amount >= 0 ? "+" : ""}{Number(t.amount).toLocaleString()}</td>
                  <td className="p-3 text-right tabular-nums text-muted-foreground">{usd(Number(t.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {total > PAGE && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="text-xs text-muted-foreground">Page {page + 1} of {Math.ceil(total / PAGE)}</span>
          <Button variant="outline" size="sm" disabled={(page + 1) * PAGE >= total} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
};

export default AdminTransactionsTab;
