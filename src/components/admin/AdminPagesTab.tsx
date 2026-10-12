import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { renderMarkdown } from "@/lib/markdown";
import { ExternalLink, FileText, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

export interface SitePage { id: string; slug: string; title: string; content: string; is_published: boolean; footer_group: "platform" | "company" | "legal" | null; sort: number; updated_at: string }

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const AdminPagesTab = () => {
  const [pages, setPages] = useState<SitePage[]>([]);
  const [sel, setSel] = useState<SitePage | null>(null);
  const [draft, setDraft] = useState<Partial<SitePage>>({});
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);

  const load = useCallback(async () => {
    const { data } = await (supabase as any).from("site_pages").select("*").order("footer_group").order("sort");
    setPages((data as SitePage[]) || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const open = (p: SitePage | null) => { setSel(p); setDraft(p ? { ...p } : { title: "", slug: "", content: "# New page\n", is_published: false, footer_group: null, sort: 0 }); setPreview(false); };

  const save = async () => {
    if (!draft.title?.trim()) return toast.error("Title is required");
    const slug = slugify(draft.slug || draft.title);
    if (!slug) return toast.error("Slug is required");
    setSaving(true);
    const body = { slug, title: draft.title.trim(), content: draft.content || "", is_published: !!draft.is_published, footer_group: draft.footer_group || null, sort: Number(draft.sort) || 0 };
    const { error } = sel
      ? await (supabase as any).from("site_pages").update(body).eq("id", sel.id)
      : await (supabase as any).from("site_pages").insert(body);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Page saved");
    await load();
    if (!sel) setSel(null);
  };

  const remove = async () => {
    if (!sel) return;
    if (!confirm(`Delete "${sel.title}"?`)) return;
    const { error } = await (supabase as any).from("site_pages").delete().eq("id", sel.id);
    if (error) return toast.error(error.message);
    toast.success("Page deleted"); setSel(null); setDraft({}); load();
  };

  const editing = sel !== null || Object.keys(draft).length > 0;

  return (
    <div className="grid lg:grid-cols-[280px_1fr] gap-4">
      <div className="space-y-2">
        <Button className="w-full bg-gradient-purple text-primary-foreground font-bold" onClick={() => open(null)}><Plus className="h-4 w-4 mr-1.5" /> Add page</Button>
        <div className="rounded-xl bg-gradient-card border border-border divide-y divide-border">
          {pages.length === 0 && <div className="p-4 text-xs text-muted-foreground">No pages yet</div>}
          {pages.map((p) => (
            <button key={p.id} onClick={() => open(p)} className={`w-full text-left p-3 hover:bg-muted/40 ${sel?.id === p.id ? "bg-muted/60" : ""}`}>
              <div className="flex items-center gap-2 text-sm"><FileText className="h-4 w-4 text-primary shrink-0" /><span className="truncate font-medium">{p.title}</span>{!p.is_published && <span className="ml-auto text-[10px] text-amber-400">draft</span>}</div>
              <div className="text-[11px] text-muted-foreground font-mono">/p/{p.slug}{p.footer_group && <span className="ml-2 capitalize">· {p.footer_group}</span>}</div>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground px-1">Pages render at <span className="font-mono">/p/slug</span>. Pick a footer group to link them from the site footer. Content is Markdown.</p>
      </div>

      <div className="rounded-xl bg-gradient-card border border-border p-4 md:p-5">
        {!editing ? <div className="text-sm text-muted-foreground py-12 text-center">Select a page or add a new one</div> : (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div><Label className="text-xs text-muted-foreground">Title</Label><Input value={draft.title || ""} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value, slug: sel ? d.slug : slugify(e.target.value) }))} className="bg-muted border-border mt-1" /></div>
              <div><Label className="text-xs text-muted-foreground">Slug</Label><Input value={draft.slug || ""} onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value }))} className="bg-muted border-border mt-1 font-mono" /></div>
              <div><Label className="text-xs text-muted-foreground">Footer group</Label>
                <Select value={draft.footer_group || "none"} onValueChange={(v) => setDraft((d) => ({ ...d, footer_group: v === "none" ? null : (v as SitePage["footer_group"]) }))}><SelectTrigger className="bg-muted border-border mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Not in footer</SelectItem><SelectItem value="platform">Platform</SelectItem><SelectItem value="company">Company</SelectItem><SelectItem value="legal">Legal</SelectItem></SelectContent></Select></div>
              <div><Label className="text-xs text-muted-foreground">Sort order</Label><Input type="number" value={draft.sort ?? 0} onChange={(e) => setDraft((d) => ({ ...d, sort: Number(e.target.value) }))} className="bg-muted border-border mt-1" /></div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2"><div className="text-sm">Published</div><Switch checked={!!draft.is_published} onCheckedChange={(v) => setDraft((d) => ({ ...d, is_published: v }))} /></div>
            <div>
              <div className="flex items-center justify-between mb-1"><Label className="text-xs text-muted-foreground">Content (Markdown)</Label><button className="text-xs text-primary" onClick={() => setPreview((p) => !p)}>{preview ? "Edit" : "Preview"}</button></div>
              {preview ? <div className="prose prose-invert prose-sm max-w-none rounded-lg border border-border bg-muted/30 p-4 min-h-[320px]" dangerouslySetInnerHTML={{ __html: renderMarkdown(draft.content || "") }} />
                : <Textarea value={draft.content || ""} onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))} className="bg-muted border-border font-mono text-xs min-h-[320px]" />}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={save} disabled={saving} className="bg-gradient-purple text-primary-foreground font-bold">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1.5" /> Save page</>}</Button>
              {sel && <Button variant="outline" onClick={() => window.open(`/p/${sel.slug}`, "_blank")}><ExternalLink className="h-4 w-4 mr-1.5" /> View</Button>}
              {sel && <Button variant="outline" className="ml-auto border-destructive/50 text-destructive hover:bg-destructive/10" onClick={remove}><Trash2 className="h-4 w-4 mr-1.5" /> Delete</Button>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPagesTab;
