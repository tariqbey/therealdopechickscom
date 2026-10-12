import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSetting } from "@/hooks/usePlatform";
import BuyBreadModal from "@/components/BuyBreadModal";
import { Gift, Loader2, Wallet } from "lucide-react";

interface Props { open: boolean; onOpenChange: (o: boolean) => void; creatorId: string; creatorName: string; postId?: string }
const PRESETS = [5, 10, 25, 50, 100];

/** Tip a creator in BREAD (profile or a specific post). */
const TipDialog = ({ open, onOpenChange, creatorId, creatorName, postId }: Props) => {
  const { user, wallet, refreshWallet } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const payouts = useSetting("payouts");
  const [amount, setAmount] = useState(10);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const balance = wallet?.balance ?? 0;

  const send = async () => {
    if (!user) { navigate("/auth"); return; }
    if (amount < 1) return;
    setSending(true);
    const { data, error } = await (supabase as any).rpc("send_tip", { p_to: creatorId, p_amount: Math.round(amount), p_post_id: postId || null, p_message: message || null });
    setSending(false);
    if (error || !data?.success) { toast({ title: "Tip failed", description: error?.message || data?.error, variant: "destructive" }); return; }
    await refreshWallet();
    toast({ title: `Tipped ${amount} BREAD 🍞`, description: `${creatorName} just got your love.` });
    onOpenChange(false); setMessage("");
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm bg-gradient-card border-border">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Gift className="h-5 w-5 text-accent" /> Tip {creatorName}</DialogTitle><DialogDescription>{creatorName} keeps {payouts.creator_share_pct}% of every tip.</DialogDescription></DialogHeader>
          <div className="grid grid-cols-5 gap-2">{PRESETS.map((p) => <button key={p} onClick={() => setAmount(p)} className={`rounded-lg border py-2 text-sm font-bold ${amount === p ? "border-primary bg-primary/15 text-primary" : "border-border bg-muted/40"}`}>{p}</button>)}</div>
          <Input type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="bg-muted border-border" />
          <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Say something nice (optional)" maxLength={140} className="bg-muted border-border" />
          <p className="text-xs text-muted-foreground">Balance: <span className="text-foreground font-semibold">{balance} BREAD</span></p>
          {balance >= amount
            ? <Button onClick={send} disabled={sending || amount < 1} className="bg-gradient-purple text-primary-foreground font-bold">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : `Send ${amount} BREAD`}</Button>
            : <Button onClick={() => setBuyOpen(true)} className="bg-gradient-purple text-primary-foreground font-bold"><Wallet className="h-4 w-4 mr-2" /> Need {amount - balance} more BREAD</Button>}
        </DialogContent>
      </Dialog>
      <BuyBreadModal open={buyOpen} onClose={() => setBuyOpen(false)} />
    </>
  );
};

export default TipDialog;
