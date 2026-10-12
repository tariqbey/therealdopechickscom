import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFeature, useSetting } from "@/hooks/usePlatform";
import { ArrowLeft, Banknote, Crown, Loader2, Wallet } from "lucide-react";

interface Req { id: string; amount_credits: number; fee_credits: number; payout_amount_cents: number; method: string; status: string; admin_note: string | null; created_at: string; processed_at: string | null }
const METHOD_FIELDS: Record<string, { key: string; label: string; placeholder?: string }[]> = {
  paypal: [{ key: "email", label: "PayPal email" }],
  bank: [{ key: "account_name", label: "Account holder name" }, { key: "bank_name", label: "Bank" }, { key: "account_number", label: "Account number / IBAN" }, { key: "routing", label: "Routing / SWIFT" }],
  crypto: [{ key: "network", label: "Network", placeholder: "USDT TRC20, BTC…" }, { key: "address", label: "Wallet address" }],
  cashapp: [{ key: "cashtag", label: "$Cashtag" }],
  zelle: [{ key: "contact", label: "Zelle email or phone" }],
  wise: [{ key: "email", label: "Wise email" }],
};
const badge: Record<string, string> = { pending: "text-amber-400", approved: "text-sky-400", paid: "text-emerald-400", rejected: "text-red-400", cancelled: "text-muted-foreground" };

const CreatorPayouts = () => {
  const { user, profile, creditWallet, refreshCreditWallet, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const payouts = useSetting("payouts");
  const currency = useSetting("currency");
  const enabled = useFeature("payout_request_tool");
  const [reqs, setReqs] = useState<Req[]>([]);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState(payouts.methods[0] || "paypal");
  const [details, setDetails] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const balance = (creditWallet as { balance?: number } | null)?.balance ?? 0;

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase as any).from("payout_requests").select("*").eq("creator_id", user.id).order("created_at", { ascending: false });
    setReqs((data as Req[]) || []);
  }, [user?.id]);
  useEffect(() => { if (!loading && !user) navigate("/auth"); load(); refreshCreditWallet(); }, [user, loading, navigate, load, refreshCreditWallet]);
  useEffect(() => { if (!payouts.methods.includes(method)) setMethod(payouts.methods[0] || "paypal"); }, [payouts.methods, method]);
  useEffect(() => { if (amount === 0 && balance > 0) setAmount(balance); }, [balance, amount]);

  const net = Math.floor(amount * (100 - payouts.payout_commission_pct) / 100) * currency.rate_per_credit;
  const pending = reqs.find((r) => r.status === "pending");
  const fields = METHOD_FIELDS[method] || [{ key: "details", label: "Payout details" }];
  const missing = fields.some((f) => !details[f.key]?.trim());

  const submit = async () => {
    setBusy(true);
    const { data, error } = await (supabase as any).rpc("request_payout", { p_amount: Math.round(amount), p_method: method, p_details: details });
    setBusy(false);
    if (error || !data?.success) return toast({ title: "Couldn't request payout", description: error?.message || data?.error, variant: "destructive" });
    toast({ title: "Payout requested 🍞", description: `≈ ${currency.symbol}${(data.payout_amount_cents / 100).toFixed(2)} via ${method}. You'll hear back once it's reviewed.` });
    setDetails({}); load(); refreshCreditWallet();
  };
  const cancel = async (id: string) => {
    const { data, error } = await (supabase as any).rpc("cancel_payout_request", { p_id: id });
    if (error || !data?.success) return toast({ title: "Couldn't cancel", description: error?.message || data?.error, variant: "destructive" });
    toast({ title: "Request cancelled", description: "Credits returned to your balance." }); load(); refreshCreditWallet();
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12 max-w-2xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <button onClick={() => navigate("/settings")} className="text-sm text-muted-foreground flex items-center gap-1"><ArrowLeft className="h-4 w-4" /> Settings</button>
          <h1 className="text-3xl font-black flex items-center gap-2"><Banknote className="h-7 w-7 text-accent" /> Payouts</h1>

          <div className="rounded-xl bg-gradient-card border border-border p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-accent/15 flex items-center justify-center"><Crown className="h-6 w-6 text-accent" /></div>
            <div><div className="text-xs uppercase tracking-wider text-muted-foreground">Earnings balance</div><div className="text-2xl font-black">{balance.toLocaleString()} {currency.credit_name}</div><div className="text-xs text-muted-foreground">≈ {currency.symbol}{(balance * currency.rate_per_credit).toFixed(2)} · you keep {payouts.creator_share_pct}% of every sale</div></div>
          </div>

          {!profile?.is_creator ? <div className="rounded-xl border border-border p-5 text-sm text-muted-foreground">Payouts are for creator accounts.</div>
          : !enabled ? <div className="rounded-xl border border-border p-5 text-sm text-muted-foreground">Payout requests are handled by the team right now. Message support to cash out.</div>
          : pending ? (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-5">
              <div className="font-bold text-sm">Request pending review</div>
              <p className="text-xs text-muted-foreground mt-1">{pending.amount_credits} {currency.credit_name} → {currency.symbol}{(pending.payout_amount_cents / 100).toFixed(2)} via {pending.method}, requested {new Date(pending.created_at).toLocaleDateString()}.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => cancel(pending.id)}>Cancel request</Button>
            </div>
          ) : (
            <div className="rounded-xl bg-gradient-card border border-border p-5 space-y-4">
              <h2 className="font-bold">Request a payout</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <div><Label className="text-xs text-muted-foreground">Amount ({currency.credit_name})</Label><Input type="number" min={payouts.min_request_credits} max={balance} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="bg-muted border-border mt-1" /><p className="text-[11px] text-muted-foreground mt-1">Minimum {payouts.min_request_credits}{payouts.request_fee_credits > 0 && ` · ${payouts.request_fee_credits} fee`}{payouts.payout_commission_pct > 0 && ` · ${payouts.payout_commission_pct}% commission`}</p></div>
                <div><Label className="text-xs text-muted-foreground">Method</Label><Select value={method} onValueChange={setMethod}><SelectTrigger className="bg-muted border-border mt-1 capitalize"><SelectValue /></SelectTrigger><SelectContent>{payouts.methods.map((m) => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}</SelectContent></Select></div>
                {fields.map((f) => <div key={f.key} className={fields.length === 1 ? "sm:col-span-2" : ""}><Label className="text-xs text-muted-foreground">{f.label}</Label><Input value={details[f.key] || ""} onChange={(e) => setDetails((d) => ({ ...d, [f.key]: e.target.value }))} placeholder={f.placeholder} className="bg-muted border-border mt-1" /></div>)}
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/40 border border-border px-4 py-3"><span className="text-sm text-muted-foreground">You'll receive</span><span className="text-lg font-black text-gradient-gold">{currency.symbol}{Math.max(0, net).toFixed(2)}</span></div>
              <Button onClick={submit} disabled={busy || missing || amount < payouts.min_request_credits || amount + payouts.request_fee_credits > balance} className="w-full bg-gradient-purple text-primary-foreground font-bold">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Wallet className="h-4 w-4 mr-2" /> Request payout</>}</Button>
            </div>
          )}

          <div className="rounded-xl bg-gradient-card border border-border">
            <div className="p-4 border-b border-border font-bold text-sm">History</div>
            {reqs.length === 0 ? <div className="p-6 text-sm text-muted-foreground text-center">No payout requests yet</div> : (
              <div className="divide-y divide-border">{reqs.map((r) => (
                <div key={r.id} className="p-4 flex items-center gap-3 text-sm">
                  <div className="flex-1"><div className="font-medium">{r.amount_credits} {currency.credit_name} → {currency.symbol}{(r.payout_amount_cents / 100).toFixed(2)} <span className="text-muted-foreground capitalize">· {r.method}</span></div><div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}{r.admin_note && <span className="text-amber-400"> · {r.admin_note}</span>}</div></div>
                  <span className={`text-xs font-semibold capitalize ${badge[r.status]}`}>{r.status}</span>
                </div>
              ))}</div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default CreatorPayouts;
