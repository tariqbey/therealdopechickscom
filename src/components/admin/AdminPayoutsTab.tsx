import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useSetting } from "@/hooks/usePlatform";
import { Check, CheckCheck, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";

interface Payout {
  id: string; creator_id: string; amount_credits: number; fee_credits: number; commission_pct: number; payout_amount_cents: number;
  method: string; details: Record<string, string>; status: string; admin_note: string | null; created_at: string; processed_at: string | null;
  profiles?: { display_name: string | null; avatar_url: string | null } | null;
}

const STATUSES = [["all", "All"], ["pending", "Pending"], ["approved", "Approved"], ["paid", "Paid"], ["rejected", "Rejected"], ["cancelled", "Cancelled"]];
const badge: Record<string, string> = { pending: "bg-amber-500/15 text-amber-400", approved: "bg-sky-500/15 text-sky-400", paid: "bg-emerald-500/15 text-emerald-400", rejected: "bg-red-500/15 text-red-400", cancelled: "bg-muted text-muted-foreground" };

const AdminPayoutsTab = () => {
  const currency = useSetting("currency");
  const [rows, setRows] = useState<Payout[]>([]);
  const [status, setStatus] = useState("pending");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<{ p: Payout; to: "approved" | "paid" | "rejected" } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    let q = (supabase as any).from("payout_requests").select("*").order("created_at", { ascending: false }).limit(300);
    if (status !== "all") q = q.eq("status", status);
    const { data } = await q;
    const list = (data as Payout[]) || [];
    const ids = [...new Set(list.map((p) => p.creator_id))];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", ids);
      const map = new Map((profs || []).map((p) => [p.user_id, p]));
      for (const p of list) p.profiles = map.get(p.creator_id) || null;
    }
    setRows(list);
    setLoading(false);
  }, [status]);
  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter((p) => !search || (p.profiles?.display_name || "").toLowerCase().includes(search.toLowerCase()) || p.creator_id === search || p.id === search);

  const process = async () => {
    if (!acting) return;
    setBusy(true);
    const { data, error } = await (supabase as any).rpc("admin_process_payout", { p_id: acting.p.id, p_status: acting.to, p_note: note || null });
    setBusy(false);
    if (error || !data?.success) return toast.error(error?.message || data?.error || "Failed");
    toast.success(`Payout ${acting.to}`);
    setActing(null); setNote("");
    load();
  };

  const money = (cents: number) => `${currency.symbol}${(cents / 100).toFixed(2)}`;

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="relative"><Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Creator name or ID" className="pl-9 bg-muted border-border" /></div>
        <Select value={status} onValueChange={setStatus}><SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
        <div className="text-sm text-muted-foreground self-center">{filtered.length} request{filtered.length === 1 ? "" : "s"}</div>
      </div>

      <div className="rounded-xl bg-gradient-card border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead><tr className="text-muted-foreground text-left border-b border-border text-xs"><th className="p-3 font-medium">Requested</th><th className="p-3 font-medium">Creator</th><th className="p-3 font-medium">Method</th><th className="p-3 font-medium">Payout details</th><th className="p-3 font-medium text-right">Credits</th><th className="p-3 font-medium text-right">Pay out</th><th className="p-3 font-medium">Status</th><th className="p-3"></th></tr></thead>
            <tbody className="divide-y divide-border">
              {loading ? <tr><td colSpan={8} className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin inline text-muted-foreground" /></td></tr>
              : filtered.length === 0 ? <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No matching results found</td></tr>
              : filtered.map((p) => (
                <tr key={p.id}>
                  <td className="p-3 text-muted-foreground whitespace-nowrap">{new Date(p.created_at).toLocaleString()}</td>
                  <td className="p-3"><div className="flex items-center gap-2"><div className="h-7 w-7 rounded-full bg-muted overflow-hidden flex items-center justify-center text-xs font-bold">{p.profiles?.avatar_url ? <img src={p.profiles.avatar_url} alt="" className="w-full h-full object-cover" /> : (p.profiles?.display_name || "?")[0]?.toUpperCase()}</div><span className="truncate max-w-[140px]">{p.profiles?.display_name || p.creator_id.slice(0, 8)}</span></div></td>
                  <td className="p-3 capitalize">{p.method}</td>
                  <td className="p-3 text-xs text-muted-foreground max-w-[220px]">{Object.entries(p.details || {}).map(([k, v]) => <div key={k} className="truncate"><span className="text-foreground/70">{k}:</span> {v}</div>)}{p.admin_note && <div className="text-amber-400 mt-1">note: {p.admin_note}</div>}</td>
                  <td className="p-3 text-right tabular-nums">{p.amount_credits.toLocaleString()}{p.fee_credits > 0 && <div className="text-[10px] text-muted-foreground">+{p.fee_credits} fee</div>}</td>
                  <td className="p-3 text-right tabular-nums font-semibold">{money(p.payout_amount_cents)}{p.commission_pct > 0 && <div className="text-[10px] text-muted-foreground">after {p.commission_pct}%</div>}</td>
                  <td className="p-3"><span className={`text-[11px] px-2 py-0.5 rounded-full capitalize ${badge[p.status] || ""}`}>{p.status}</span></td>
                  <td className="p-3 text-right whitespace-nowrap">
                    {p.status === "pending" && <><Button size="sm" variant="ghost" className="h-7 text-sky-400" onClick={() => setActing({ p, to: "approved" })}><Check className="h-4 w-4 mr-1" /> Approve</Button><Button size="sm" variant="ghost" className="h-7 text-red-400" onClick={() => setActing({ p, to: "rejected" })}><X className="h-4 w-4 mr-1" /> Reject</Button></>}
                    {(p.status === "pending" || p.status === "approved") && <Button size="sm" variant="ghost" className="h-7 text-emerald-400" onClick={() => setActing({ p, to: "paid" })}><CheckCheck className="h-4 w-4 mr-1" /> Mark paid</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!acting} onOpenChange={(o) => !o && setActing(null)}>
        <DialogContent className="sm:max-w-md bg-gradient-card border-border">
          <DialogHeader><DialogTitle className="capitalize">{acting?.to === "paid" ? "Mark as paid" : acting?.to} payout</DialogTitle>
            <DialogDescription>{acting && <>{acting.p.profiles?.display_name || "Creator"} · {acting.p.amount_credits} credits → {money(acting.p.payout_amount_cents)} via {acting.p.method}.{acting.to === "rejected" && " The credits return to their earnings balance."}{acting.to === "paid" && " Only mark paid after you've actually sent the money."}</>}</DialogDescription></DialogHeader>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={acting?.to === "rejected" ? "Reason (shown to the creator)" : "Internal note / payment reference (optional)"} className="bg-muted border-border" />
          <div className="flex gap-2"><Button onClick={process} disabled={busy} className={acting?.to === "rejected" ? "flex-1 bg-destructive text-destructive-foreground" : "flex-1 bg-gradient-purple text-primary-foreground font-bold"}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}</Button><Button variant="outline" onClick={() => setActing(null)}>Cancel</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPayoutsTab;
