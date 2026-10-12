import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FEATURES, FEATURE_GROUPS, resolveFeature, type FeatureGroup } from "@/lib/features";
import { saveSetting, useSetting } from "@/hooks/usePlatform";
import { Check, Clock, Search } from "lucide-react";
import { toast } from "sonner";

/** The Scrile "Addons" screen, except every implemented feature is already yours and free. */
const AdminFeaturesTab = () => {
  const map = useSetting("features");
  const [group, setGroup] = useState<FeatureGroup>("admin");
  const [q, setQ] = useState("");
  const [show, setShow] = useState<"all" | "enabled" | "disabled" | "coming">("all");
  const [busy, setBusy] = useState<string | null>(null);

  const enabledCount = FEATURES.filter((f) => resolveFeature(map, f.key)).length;
  const list = useMemo(() => FEATURES.filter((f) => f.group === group)
    .filter((f) => !q || f.name.toLowerCase().includes(q.toLowerCase()) || f.description.toLowerCase().includes(q.toLowerCase()))
    .filter((f) => {
      const on = resolveFeature(map, f.key);
      if (show === "enabled") return f.implemented && on;
      if (show === "disabled") return f.implemented && !on;
      if (show === "coming") return !f.implemented;
      return true;
    }), [group, q, show, map]);

  const toggle = async (key: string, value: boolean) => {
    setBusy(key);
    try { await saveSetting("features", { ...map, [key]: value }); toast.success(value ? "Feature enabled" : "Feature disabled"); }
    catch (e: any) { toast.error(e.message); }
    setBusy(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-sm text-muted-foreground"><span className="font-bold text-foreground">{enabledCount}</span> of {FEATURES.filter((f) => f.implemented).length} built features enabled · {FEATURES.filter((f) => !f.implemented).length} on the roadmap</div>
        <div className="ml-auto flex gap-2">
          <div className="relative"><Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search features" className="pl-9 bg-muted border-border w-52" /></div>
          <Select value={show} onValueChange={(v) => setShow(v as typeof show)}><SelectTrigger className="w-40 bg-muted border-border"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All features</SelectItem><SelectItem value="enabled">Enabled</SelectItem><SelectItem value="disabled">Disabled</SelectItem><SelectItem value="coming">Not built yet</SelectItem></SelectContent></Select>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border">
        {FEATURE_GROUPS.map((g) => (
          <button key={g.key} onClick={() => setGroup(g.key)} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 -mb-px ${group === g.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{g.label} <span className="ml-1 text-[10px] font-normal">{FEATURES.filter((f) => f.group === g.key).length}</span></button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {list.map((f) => {
          const on = resolveFeature(map, f.key);
          return (
            <div key={f.key} className={`rounded-xl border p-4 flex flex-col gap-2 ${f.implemented ? "bg-gradient-card border-border" : "bg-muted/20 border-border/60 opacity-75"}`}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0"><div className="font-bold text-sm">{f.name}</div><p className="text-xs text-muted-foreground mt-1">{f.description}</p></div>
                {f.implemented ? <Switch checked={on} disabled={busy === f.key} onCheckedChange={(v) => toggle(f.key, v)} /> : <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Roadmap</span>}
              </div>
              <div className="mt-auto flex items-center justify-between text-[11px]">
                {f.implemented ? <span className="text-emerald-400 flex items-center gap-1"><Check className="h-3 w-3" /> Built in · free</span> : <span className="text-muted-foreground">Ask to build it</span>}
                {f.where && <span className="text-muted-foreground truncate ml-2">{f.where}</span>}
              </div>
            </div>
          );
        })}
        {list.length === 0 && <div className="text-sm text-muted-foreground p-6">Nothing matches</div>}
      </div>
    </div>
  );
};

export default AdminFeaturesTab;
