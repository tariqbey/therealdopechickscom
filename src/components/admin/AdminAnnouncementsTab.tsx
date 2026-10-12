import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Megaphone, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

export interface Announcement { id: string; title: string; body: string; audience: "all" | "creators" | "members"; style: "info" | "success" | "warning"; link_url: string | null; is_active: boolean; starts_at: string; ends_at: string | null; created_at: string }

const toLocalInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");

const AdminAnnouncementsTab = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Announcement[]>([]);
  const [sel, setSel] = useState<Announcement | null>(null);
  const [draft, setDraft] = useState<Partial<Announcement> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await (supabase as any).from("announcements").select("*").order("created_at", { ascending: false });
    setRows((data as Announcement[]) || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const open = (a: Announcement | null) => { setSel(a); setDraft(a ? { ...a } : { title: "", body: "", audience: "all", style: "info", link_url: "", is_active: true, starts_at: new Date().toISOString(), ends_at: null }); };

  const save = async () => {
    if (!draft?.title?.trim()) return toast.error("Title is required");
    setSaving(true);
    const body = { title: draft.title.trim(), body: draft.body || "", audience: draft.audience || "all", style: draft.style || "info", link_url: draft.link_url || null, is_active: !!draft.is_active, starts_at: draft.starts_at || new Date().toISOString(), ends_at: draft.ends_at || null, created_by: user?.id };
    const { error } = sel ? await (supabase as any).from("announcements").update(body).eq("id", sel.id) : await (supabase as any).from("announcements").insert(body);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Announcement saved"); setSel(null); setDraft(null); load();
  };
  const remove = async (a: Announcement) => {
    if (!confirm(`Delete "${a.title}"?`)) return;
    await (supabase as any).from("announcements").delete().eq("id", a.id);
    if (sel?.id === a.id) { setSel(null); setDraft(null); }
    load();
  };
  const toggle = async (a: Announcement) => { await (supabase as any).from("announcements").update({ is_active: !a.is_active }).eq("id", a.id); load(); };

  const live = (a: Announcement) => a.is_active && new Date(a.starts_at) <= new Date() && (!a.ends_at || new Date(a.ends_at) > new Date());

  return (
    <div className="grid lg:grid-cols-[1fr_380px] gap-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Banners shown at the top of every page for the chosen audience.</p><Button size="sm" className="bg-gradient-purple text-primary-foreground font-bold" onClick={() => open(null)}><Plus className="h-4 w-4 mr-1.5" /> New announcement</Button></div>
        <div className="rounded-xl bg-gradient-card border border-border divide-y divide-border">
          {rows.length === 0 && <div className="p-6 text-sm text-muted-foreground text-center">No announcements yet</div>}
          {rows.map((a) => (
            <div key={a.id} className={`p-4 flex items-start gap-3 ${sel?.id === a.id ? "bg-muted/50" : ""}`}>
              <Megaphone className={`h-5 w-5 shrink-0 mt-0.5 ${live(a) ? "text-emerald-400" : "text-muted-foreground"}`} />
              <button className="flex-1 text-left min-w-0" onClick={() => open(a)}>
                <div className="font-medium truncate">{a.title}</div>
                <div className="text-xs text-muted-foreground truncate">{a.body}</div>
                <div className="text-[11px] text-muted-foreground mt-1 capitalize">{a.audience} · {a.style} · {live(a) ? "live now" : a.is_active ? "scheduled / expired" : "off"}{a.ends_at && ` · ends ${new Date(a.ends_at).toLocaleDateString()}`}</div>
              </button>
              <Switch checked={a.is_active} onCheckedChange={() => toggle(a)} />
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove(a)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-gradient-card border border-border p-4 md:p-5 h-fit">
        {!draft ? <div className="text-sm text-muted-foreground text-center py-10">Select an announcement or create one</div> : (
          <div className="space-y-3">
            <div><Label className="text-xs text-muted-foreground">Title</Label><Input value={draft.title || ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="bg-muted border-border mt-1" /></div>
            <div><Label className="text-xs text-muted-foreground">Message</Label><Textarea value={draft.body || ""} onChange={(e) => setDraft({ ...draft, body: e.target.value })} className="bg-muted border-border mt-1" rows={3} /></div>
            <div><Label className="text-xs text-muted-foreground">Link (optional)</Label><Input value={draft.link_url || ""} onChange={(e) => setDraft({ ...draft, link_url: e.target.value })} placeholder="https://… or /ai-studio" className="bg-muted border-border mt-1" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs text-muted-foreground">Audience</Label><Select value={draft.audience || "all"} onValueChange={(v) => setDraft({ ...draft, audience: v as Announcement["audience"] })}><SelectTrigger className="bg-muted border-border mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Everyone</SelectItem><SelectItem value="creators">Creators</SelectItem><SelectItem value="members">Members</SelectItem></SelectContent></Select></div>
              <div><Label className="text-xs text-muted-foreground">Style</Label><Select value={draft.style || "info"} onValueChange={(v) => setDraft({ ...draft, style: v as Announcement["style"] })}><SelectTrigger className="bg-muted border-border mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="info">Info (purple)</SelectItem><SelectItem value="success">Success (green)</SelectItem><SelectItem value="warning">Warning (amber)</SelectItem></SelectContent></Select></div>
              <div><Label className="text-xs text-muted-foreground">Starts</Label><Input type="datetime-local" value={toLocalInput(draft.starts_at || null)} onChange={(e) => setDraft({ ...draft, starts_at: e.target.value ? new Date(e.target.value).toISOString() : new Date().toISOString() })} className="bg-muted border-border mt-1" /></div>
              <div><Label className="text-xs text-muted-foreground">Ends (optional)</Label><Input type="datetime-local" value={toLocalInput(draft.ends_at || null)} onChange={(e) => setDraft({ ...draft, ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })} className="bg-muted border-border mt-1" /></div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2"><span className="text-sm">Active</span><Switch checked={!!draft.is_active} onCheckedChange={(v) => setDraft({ ...draft, is_active: v })} /></div>
            <div className="flex gap-2"><Button onClick={save} disabled={saving} className="flex-1 bg-gradient-purple text-primary-foreground font-bold">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1.5" /> Save</>}</Button><Button variant="outline" onClick={() => { setSel(null); setDraft(null); }}>Cancel</Button></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAnnouncementsTab;
