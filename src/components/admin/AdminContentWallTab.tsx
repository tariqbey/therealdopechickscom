import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { saveSetting, useSetting } from "@/hooks/usePlatform";
import { resolveFeature } from "@/lib/features";
import { Switch } from "@/components/ui/switch";
import { Check, Loader2, Lock, Pin, ShieldCheck, Trash2, X } from "lucide-react";
import { toast } from "sonner";

interface Post { id: string; creator_id: string; title: string | null; description: string | null; media_url: string; media_type: string; is_locked: boolean; status: "pending" | "approved" | "rejected"; review_note: string | null; is_pinned: boolean; created_at: string; creator?: { display_name: string | null } | null }

/** Scrile's "Admin Content Wall (Post Verification)": review creator posts before they go live. */
const AdminContentWallTab = () => {
  const features = useSetting("features");
  const verifyOn = resolveFeature(features, "post_verification");
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [rows, setRows] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    let q = (supabase as any).from("creator_posts").select("*").order("created_at", { ascending: false }).limit(200);
    if (status !== "all") q = q.eq("status", status);
    const { data } = await q;
    const list = (data as Post[]) || [];
    const ids = [...new Set(list.map((p) => p.creator_id))];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, display_name").in("user_id", ids);
      const m = new Map((profs || []).map((p) => [p.user_id, p]));
      for (const p of list) p.creator = m.get(p.creator_id) || null;
    }
    setRows(list); setLoading(false);
  }, [status]);
  useEffect(() => { load(); }, [load]);

  const act = async (p: Post, patch: Partial<Post>, msg: string) => {
    setBusy(p.id);
    const { error } = await (supabase as any).from("creator_posts").update(patch).eq("id", p.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(msg); load();
  };
  const remove = async (p: Post) => {
    if (!confirm("Delete this post permanently?")) return;
    const { error } = await (supabase as any).from("creator_posts").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Post deleted"); load();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-gradient-card border border-border p-4 flex items-start gap-4">
        <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
        <div className="flex-1"><div className="font-bold text-sm">Post verification</div><p className="text-xs text-muted-foreground mt-1">When on, every new creator post waits here until you approve it. Rejected posts stay hidden with your note visible to the creator.</p></div>
        <Switch checked={verifyOn} onCheckedChange={async (v) => { await saveSetting("features", { ...features, post_verification: v }); toast.success(v ? "Posts now require approval" : "Posts publish instantly"); }} />
      </div>

      <div className="flex items-center gap-3">
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}><SelectTrigger className="w-44 bg-muted border-border"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">Awaiting review</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="rejected">Rejected</SelectItem><SelectItem value="all">All posts</SelectItem></SelectContent></Select>
        <span className="text-sm text-muted-foreground">{rows.length} post{rows.length === 1 ? "" : "s"}</span>
      </div>

      {loading ? <div className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin inline text-muted-foreground" /></div>
      : rows.length === 0 ? <div className="rounded-xl bg-gradient-card border border-border p-10 text-center text-sm text-muted-foreground">Nothing here</div>
      : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map((p) => (
            <div key={p.id} className="rounded-xl bg-gradient-card border border-border overflow-hidden flex flex-col">
              <div className="relative aspect-video bg-black">
                {p.media_type === "video" ? <video src={p.media_url} className="w-full h-full object-cover" muted controls preload="metadata" /> : <img src={p.media_url} alt="" className="w-full h-full object-cover" />}
                <div className="absolute top-2 left-2 flex gap-1">
                  {p.is_locked && <span className="px-1.5 py-0.5 rounded bg-black/60 text-[10px] text-white flex items-center gap-1"><Lock className="h-3 w-3" /> locked</span>}
                  {p.is_pinned && <span className="px-1.5 py-0.5 rounded bg-black/60 text-[10px] text-white flex items-center gap-1"><Pin className="h-3 w-3" /> pinned</span>}
                </div>
                <span className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${p.status === "approved" ? "bg-emerald-500/80 text-white" : p.status === "rejected" ? "bg-red-500/80 text-white" : "bg-amber-500/80 text-black"}`}>{p.status}</span>
              </div>
              <div className="p-3 flex-1 flex flex-col gap-2">
                <div className="text-xs text-muted-foreground">{p.creator?.display_name || p.creator_id.slice(0, 8)} · {new Date(p.created_at).toLocaleDateString()}</div>
                {p.title && <div className="text-sm font-medium truncate">{p.title}</div>}
                {p.description && <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>}
                {p.review_note && <div className="text-[11px] text-amber-400">Note: {p.review_note}</div>}
                <Input value={notes[p.id] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [p.id]: e.target.value }))} placeholder="Note to creator (optional)" className="bg-muted border-border h-8 text-xs" />
                <div className="flex gap-1 mt-auto">
                  {p.status !== "approved" && <Button size="sm" className="h-8 flex-1 bg-emerald-600 hover:bg-emerald-500 text-white" disabled={busy === p.id} onClick={() => act(p, { status: "approved", review_note: notes[p.id] || null }, "Approved")}><Check className="h-4 w-4 mr-1" /> Approve</Button>}
                  {p.status !== "rejected" && <Button size="sm" variant="outline" className="h-8 flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10" disabled={busy === p.id} onClick={() => act(p, { status: "rejected", review_note: notes[p.id] || null }, "Rejected")}><X className="h-4 w-4 mr-1" /> Reject</Button>}
                  <Button size="icon" variant="ghost" className="h-8 w-8" title={p.is_pinned ? "Unpin" : "Pin"} onClick={() => act(p, { is_pinned: !p.is_pinned }, p.is_pinned ? "Unpinned" : "Pinned")}><Pin className={`h-4 w-4 ${p.is_pinned ? "text-primary" : ""}`} /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove(p)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminContentWallTab;
