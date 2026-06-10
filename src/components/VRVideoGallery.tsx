import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/hooks/useWallet";
import { Button } from "@/components/ui/button";
import { Headset, Lock, Loader2, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import type { VRVideo } from "@/components/VRVideoManager";

interface VRVideoGalleryProps {
  creatorId: string;
  isOwnerOrAdmin: boolean;
}

const VRVideoGallery = ({ creatorId, isOwnerOrAdmin }: VRVideoGalleryProps) => {
  const { user } = useAuth();
  const { balance, refreshWallet } = useWallet();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [videos, setVideos] = useState<VRVideo[]>([]);
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const [unlockTarget, setUnlockTarget] = useState<VRVideo | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("vr_videos" as any)
        .select("*")
        .eq("creator_id", creatorId)
        .eq("is_published", true)
        .order("created_at", { ascending: false });
      setVideos((data as unknown as VRVideo[]) || []);

      if (user) {
        const { data: unlocks } = await supabase
          .from("vr_video_unlocks" as any)
          .select("video_id")
          .eq("fan_user_id", user.id);
        setUnlockedIds(new Set(((unlocks as any[]) || []).map((u) => u.video_id)));
      }
    };
    load();
  }, [creatorId, user?.id]);

  if (videos.length === 0) return null;

  const hasAccess = (v: VRVideo) =>
    isOwnerOrAdmin || v.price_bread === 0 || unlockedIds.has(v.id);

  const handleClick = (v: VRVideo) => {
    if (hasAccess(v)) {
      navigate(`/vr/${v.id}`);
    } else if (!user) {
      navigate("/auth");
    } else {
      setUnlockTarget(v);
    }
  };

  const handleUnlock = async () => {
    if (!unlockTarget) return;
    setUnlocking(true);
    try {
      const { data, error } = await supabase.rpc("unlock_vr_video" as any, {
        p_video_id: unlockTarget.id,
      } as any);
      if (error) throw error;
      const result = data as any;
      if (!result?.success) {
        if (result?.error === "Insufficient BREAD") {
          toast({
            title: "Not enough BREAD 🍞",
            description: `You need ${result.needed} BREAD but have ${result.balance}. Top up in the AI Studio.`,
            variant: "destructive",
          });
        } else {
          throw new Error(result?.error || "Unlock failed");
        }
        return;
      }
      await refreshWallet();
      setUnlockedIds((prev) => new Set(prev).add(unlockTarget.id));
      toast({ title: "Unlocked! 🥽", description: "Enjoy the experience." });
      const id = unlockTarget.id;
      setUnlockTarget(null);
      navigate(`/vr/${id}`);
    } catch (err: any) {
      toast({ title: "Unlock failed", description: err.message, variant: "destructive" });
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
      <h2 className="text-xl font-black flex items-center gap-2 mb-4">
        <Headset className="h-5 w-5 text-primary" /> VR Experiences
        <span className="text-[10px] font-bold uppercase tracking-wider bg-gradient-purple text-primary-foreground px-2 py-0.5 rounded-full">
          VR180
        </span>
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {videos.map((v) => {
          const unlocked = hasAccess(v);
          return (
            <motion.div
              key={v.id}
              whileHover={{ scale: 1.02 }}
              className="relative aspect-video rounded-xl overflow-hidden cursor-pointer group border border-border bg-muted"
              onClick={() => handleClick(v)}
            >
              {v.thumbnail_url ? (
                <img
                  src={v.thumbnail_url}
                  alt={v.title}
                  className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${!unlocked ? "blur-md scale-110" : ""}`}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-muted via-muted/80 to-muted/60 flex items-center justify-center">
                  <Headset className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-background/20" />

              <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-primary/90 text-primary-foreground text-[10px] font-bold flex items-center gap-1">
                <Headset className="h-3 w-3" /> VR
              </div>

              {!unlocked && (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Lock className="h-7 w-7 text-accent mb-1.5 drop-shadow-lg" />
                  <span className="text-xs font-bold text-accent drop-shadow">
                    {v.price_bread} BREAD 🍞
                  </span>
                </div>
              )}
              {unlocked && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center">
                    <Play className="h-5 w-5 text-primary-foreground ml-0.5" />
                  </div>
                </div>
              )}

              <div className="absolute bottom-2 left-2 right-2">
                <p className="text-xs font-bold text-foreground truncate drop-shadow">{v.title}</p>
                <p className="text-[10px] text-muted-foreground">
                  {v.price_bread === 0 ? "Free" : unlocked ? "Unlocked" : `${v.price_bread} BREAD`}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Unlock dialog */}
      <Dialog open={!!unlockTarget} onOpenChange={(open) => !open && !unlocking && setUnlockTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Headset className="h-5 w-5 text-primary" /> Unlock VR Experience
            </DialogTitle>
            <DialogDescription>
              "{unlockTarget?.title}" — watch in full immersive VR180, forever.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl bg-muted/60 border border-border p-4 flex items-center justify-between">
            <div>
              <p className="text-2xl font-black text-gradient-gold">{unlockTarget?.price_bread} 🍞</p>
              <p className="text-[11px] text-muted-foreground">one-time unlock</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold">{balance} 🍞</p>
              <p className="text-[11px] text-muted-foreground">your balance</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnlockTarget(null)} disabled={unlocking}>
              Cancel
            </Button>
            <Button
              onClick={handleUnlock}
              disabled={unlocking}
              className="bg-gradient-purple text-primary-foreground font-bold hover:opacity-90"
            >
              {unlocking ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Unlocking…</>
              ) : (
                <>Unlock for {unlockTarget?.price_bread} BREAD</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default VRVideoGallery;
