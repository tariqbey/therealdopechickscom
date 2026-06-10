import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Headset, Trash2, Eye, EyeOff, DollarSign, Unlock, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { VRVideo } from "@/components/VRVideoManager";

interface VRVideoRow extends VRVideo {
  creator_name: string;
}

const AdminVRTab = () => {
  const { toast } = useToast();
  const [videos, setVideos] = useState<VRVideoRow[]>([]);
  const [totalUnlocks, setTotalUnlocks] = useState(0);
  const [totalBread, setTotalBread] = useState(0);
  const [deleting, setDeleting] = useState<VRVideoRow | null>(null);

  const load = async () => {
    const { data: vids } = await supabase
      .from("vr_videos" as any)
      .select("*")
      .order("created_at", { ascending: false });

    const rows = (vids as unknown as VRVideo[]) || [];

    // attach creator names
    const creatorIds = [...new Set(rows.map((v) => v.creator_id))];
    let names: Record<string, string> = {};
    if (creatorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", creatorIds);
      names = Object.fromEntries((profiles || []).map((p) => [p.user_id, p.display_name || "Unknown"]));
    }
    setVideos(rows.map((v) => ({ ...v, creator_name: names[v.creator_id] || "Unknown" })));

    const { data: unlocks } = await supabase
      .from("vr_video_unlocks" as any)
      .select("bread_paid");
    const unlockRows = (unlocks as any[]) || [];
    setTotalUnlocks(unlockRows.length);
    setTotalBread(unlockRows.reduce((s, u) => s + (u.bread_paid || 0), 0));
  };

  useEffect(() => { load(); }, []);

  const togglePublished = async (v: VRVideoRow) => {
    const { error } = await supabase
      .from("vr_videos" as any)
      .update({ is_published: !v.is_published } as any)
      .eq("id", v.id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: v.is_published ? "Video unpublished" : "Video published" });
      load();
    }
  };

  const updatePrice = async (v: VRVideoRow, price: number) => {
    const { error } = await supabase
      .from("vr_videos" as any)
      .update({ price_bread: Math.max(0, price) } as any)
      .eq("id", v.id);
    if (error) {
      toast({ title: "Price update failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Price set to ${Math.max(0, price)} BREAD` });
      load();
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    // Admin owns the cleanup via the API route (verified by their token); row
    // delete cascades to vr_video_sources.
    fetch("/api/vr-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId: deleting.id, token: (await supabase.auth.getSession()).data.session?.access_token }),
    }).catch(() => {});
    const { error } = await supabase.from("vr_videos" as any).delete().eq("id", deleting.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "VR video deleted" });
      load();
    }
    setDeleting(null);
  };

  const statCards = [
    { label: "VR Videos", value: videos.length, icon: Headset },
    { label: "Total Unlocks", value: totalUnlocks, icon: Unlock },
    { label: "BREAD Earned", value: totalBread.toLocaleString(), icon: DollarSign },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="rounded-xl bg-gradient-card border border-border p-4 md:p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] md:text-xs font-bold text-muted-foreground uppercase tracking-wide">{card.label}</span>
              <card.icon className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl md:text-3xl font-display font-bold text-foreground">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-gradient-card border border-border p-4 md:p-6">
        <h3 className="text-lg font-display font-bold text-foreground mb-4">All VR Videos</h3>
        {videos.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No VR videos uploaded yet.</p>
        ) : (
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="text-muted-foreground text-left border-b border-border">
                  <th className="pb-3 font-medium px-4 md:px-0">Video</th>
                  <th className="pb-3 font-medium">Creator</th>
                  <th className="pb-3 font-medium">Price (🍞)</th>
                  <th className="pb-3 font-medium">Unlocks</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {videos.map((v) => (
                  <tr key={v.id} className="text-foreground">
                    <td className="py-3 px-4 md:px-0">
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-10 rounded-lg overflow-hidden bg-muted shrink-0">
                          {v.thumbnail_url ? (
                            <img src={v.thumbnail_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Headset className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <span className="truncate max-w-[180px] font-medium">{v.title}</span>
                      </div>
                    </td>
                    <td className="py-3 text-muted-foreground">{v.creator_name}</td>
                    <td className="py-3">
                      <Input
                        type="number"
                        min={0}
                        defaultValue={v.price_bread}
                        onBlur={(e) => {
                          const p = parseInt(e.target.value, 10) || 0;
                          if (p !== v.price_bread) updatePrice(v, p);
                        }}
                        className="w-20 h-8 text-xs bg-muted border-border"
                      />
                    </td>
                    <td className="py-3">{v.unlocks_count}</td>
                    <td className="py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        v.is_published ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground"
                      }`}>
                        {v.is_published ? "Live" : "Hidden"}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="Watch" onClick={() => window.open(`/vr/${v.id}`, "_blank")}>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" title={v.is_published ? "Unpublish" : "Publish"} onClick={() => togglePublished(v)}>
                          {v.is_published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Delete" onClick={() => setDeleting(v)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete VR video?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleting?.title}" by {deleting?.creator_name} will be permanently removed,
              including the video file. Fans who paid will lose access. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
};

export default AdminVRTab;
