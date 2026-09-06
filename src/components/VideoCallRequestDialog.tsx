import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { CREATOR_SHARE, notifyUser, requestVideoCall, type CallProfile } from "@/lib/videoCalls";
import BuyBreadModal from "@/components/BuyBreadModal";
import { Clock, Loader2, Video, Wallet } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creator: CallProfile;
}

/** Confirm-and-pay sheet shown before a fan requests a video call. */
const VideoCallRequestDialog = ({ open, onOpenChange, creator }: Props) => {
  const { user, profile, wallet, refreshWallet } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [requesting, setRequesting] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);

  const price = creator.video_call_price_bread ?? 0;
  const minutes = creator.video_call_minutes ?? 15;
  const balance = wallet?.balance ?? 0;
  const enough = balance >= price;
  const name = creator.display_name || "this creator";

  const confirm = async () => {
    if (!user) { navigate("/auth"); return; }
    setRequesting(true);
    try {
      const res = await requestVideoCall(creator.user_id);
      await refreshWallet();
      if (!res.existing) {
        notifyUser(
          creator.user_id,
          "📞 Video call request",
          `${profile?.display_name || "A fan"} wants a ${minutes}-minute video call${price ? ` · ${price} BREAD` : ""}`,
          `/call/${res.call_id}`
        );
      }
      onOpenChange(false);
      navigate(`/call/${res.call_id}`);
    } catch (e: any) {
      toast({ title: "Couldn't request the call", description: e.message, variant: "destructive" });
    }
    setRequesting(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md bg-gradient-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-black">
              <Video className="h-5 w-5 text-primary" /> Video call with {name}
            </DialogTitle>
            <DialogDescription>
              A private, two-way video call. {name} gets notified and you'll be connected as soon as they accept.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 my-2">
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Length
              </div>
              <div className="text-lg font-black">{minutes} min</div>
            </div>
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Wallet className="h-3 w-3" /> Price
              </div>
              <div className="text-lg font-black text-gradient-gold">{price ? `${price} BREAD` : "Free"}</div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Your balance: <span className="font-semibold text-foreground">{balance} BREAD</span>.
            {price > 0 && " You're charged now and fully refunded if the call is declined, cancelled, expires, or never connects."}
            {price > 0 && ` ${name} earns ${Math.floor(price * CREATOR_SHARE)} BREAD.`}
          </p>

          <div className="flex gap-2 mt-2">
            {enough ? (
              <Button onClick={confirm} disabled={requesting} className="flex-1 bg-gradient-purple text-primary-foreground font-bold glow-purple">
                {requesting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Video className="h-4 w-4 mr-2" />}
                {price ? `Pay ${price} BREAD & request call` : "Request call"}
              </Button>
            ) : (
              <Button onClick={() => setBuyOpen(true)} className="flex-1 bg-gradient-purple text-primary-foreground font-bold">
                <Wallet className="h-4 w-4 mr-2" /> Need {price - balance} more BREAD — buy now
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={requesting}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
      <BuyBreadModal open={buyOpen} onClose={() => setBuyOpen(false)} />
    </>
  );
};

export default VideoCallRequestDialog;
