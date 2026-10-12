import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEFAULTS, loadSettings, saveSetting, useCategories, usePriceOptions, useSetting, type PriceOption, type SettingsKey } from "@/hooks/usePlatform";
import { toast } from "sonner";
import {
  Building2, Coins, CreditCard, Crown, Eye, Globe, Loader2, Mail, Palette, Plus, Save, Settings as SettingsIcon, Tags, ToggleLeft, Trash2, UserCircle, Wallet,
} from "lucide-react";

type Section = "general" | "pricing" | "payments" | "payouts" | "currencies" | "domain" | "smtp" | "categories" | "design" | "display";
const SECTIONS: { key: Section; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "general", label: "General", icon: Building2 },
  { key: "pricing", label: "Pricing", icon: Coins },
  { key: "payments", label: "Payment systems", icon: CreditCard },
  { key: "payouts", label: "Payout systems", icon: Wallet },
  { key: "currencies", label: "Currencies", icon: Globe },
  { key: "domain", label: "Domain name", icon: Globe },
  { key: "smtp", label: "Mailing, SMTP", icon: Mail },
  { key: "categories", label: "Categories", icon: Tags },
  { key: "design", label: "Design", icon: Palette },
  { key: "display", label: "Display & preview", icon: Eye },
];

const Card = ({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) => (
  <div className="rounded-xl bg-gradient-card border border-border p-5 space-y-4"><div><h3 className="text-sm font-bold">{title}</h3>{desc && <p className="text-xs text-muted-foreground mt-1">{desc}</p>}</div>{children}</div>
);
const Field = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
  <div><Label className="text-xs text-muted-foreground">{label}</Label><div className="mt-1">{children}</div>{hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}</div>
);

/** Generic editor for one platform_settings blob. */
function useBlob<K extends SettingsKey>(key: K) {
  const live = useSetting(key);
  const [draft, setDraft] = useState<(typeof DEFAULTS)[K]>(live);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (!dirty) setDraft(live); }, [live, dirty]);
  const set = (patch: Partial<(typeof DEFAULTS)[K]>) => { setDraft((d) => ({ ...d, ...patch })); setDirty(true); };
  const save = async () => { setSaving(true); try { await saveSetting(key, draft); setDirty(false); toast.success("Saved"); } catch (e: any) { toast.error(e.message); } setSaving(false); };
  return { draft, set, save, saving, dirty };
}
const SaveBar = ({ save, saving, dirty }: { save: () => void; saving: boolean; dirty: boolean }) => (
  <Button onClick={save} disabled={!dirty || saving} className="bg-gradient-purple text-primary-foreground font-bold">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1.5" /> Save</>}</Button>
);

// ---------------- sections ----------------
const GeneralSection = () => {
  const { draft, set, save, saving, dirty } = useBlob("site");
  const upload = async (file: File, field: "logo_url" | "favicon_url") => {
    const path = `site/${field}-${Date.now()}.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("covers").upload(path, file, { upsert: true });
    if (error) return toast.error(error.message);
    set({ [field]: supabase.storage.from("covers").getPublicUrl(path).data.publicUrl } as never);
  };
  return (
    <div className="space-y-4">
      <Card title="Company information">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Site name"><Input value={draft.site_name} onChange={(e) => set({ site_name: e.target.value })} className="bg-muted border-border" /></Field>
          <Field label="Support email"><Input type="email" value={draft.support_email} onChange={(e) => set({ support_email: e.target.value })} className="bg-muted border-border" /></Field>
          <Field label="Company name"><Input value={draft.company_name} onChange={(e) => set({ company_name: e.target.value })} className="bg-muted border-border" /></Field>
          <Field label="Company address"><Input value={draft.company_address} onChange={(e) => set({ company_address: e.target.value })} className="bg-muted border-border" /></Field>
        </div>
        <Field label="Meta description" hint="Shown in search results and link previews."><Textarea value={draft.meta_description} onChange={(e) => set({ meta_description: e.target.value })} className="bg-muted border-border" rows={2} /></Field>
      </Card>
      <Card title="Logo and favicon" desc="Leave empty to keep the built-in gold Dope logo.">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Logo (PNG or SVG)"><div className="flex items-center gap-3">{draft.logo_url && <img src={draft.logo_url} alt="" className="h-10 w-auto rounded bg-black/40 p-1" />}<Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], "logo_url")} className="bg-muted border-border" /></div></Field>
          <Field label="Favicon (square PNG, 512px)"><div className="flex items-center gap-3">{draft.favicon_url && <img src={draft.favicon_url} alt="" className="h-8 w-8 rounded" />}<Input type="file" accept="image/png" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], "favicon_url")} className="bg-muted border-border" /></div></Field>
        </div>
      </Card>
      <Card title="Watermark" desc="Overlays the site name or the creator's @username on media so screenshots are traceable.">
        <div className="flex items-center gap-4"><Switch checked={draft.watermark_enabled} onCheckedChange={(v) => set({ watermark_enabled: v })} /><Select value={draft.watermark_format} onValueChange={(v) => set({ watermark_format: v as "site_name" | "username" })}><SelectTrigger className="w-44 bg-muted border-border"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="site_name">Site name</SelectItem><SelectItem value="username">@username</SelectItem></SelectContent></Select></div>
      </Card>
      <Card title="Google Analytics"><Field label="Measurement ID" hint="e.g. G-XXXXXXXXXX. Injected on every page once saved."><Input value={draft.ga_code} onChange={(e) => set({ ga_code: e.target.value })} placeholder="G-…" className="bg-muted border-border font-mono" /></Field></Card>
      <SaveBar save={save} saving={saving} dirty={dirty} />
    </div>
  );
};

const PRICE_KINDS: { kind: string; title: string; desc: string; hasUsd?: boolean }[] = [
  { kind: "deposit", title: "Deposits (BREAD packages)", desc: "What members can buy to top up their balance. Each needs a Stripe price ID.", hasUsd: true },
  { kind: "post", title: "Posts", desc: "Price options creators can pick for pay-per-view posts." },
  { kind: "message", title: "Pay per message", desc: "Price options for paid messages." },
  { kind: "attachment", title: "Message attachments", desc: "Price options for paid media sent in chat." },
  { kind: "subscription", title: "Subscription price", desc: "Monthly subscription options (in BREAD) creators can choose." },
  { kind: "video_call", title: "Video call", desc: "Suggested prices for a FaceTime-style call." },
  { kind: "call_minute", title: "Pay per minute call", desc: "Per-minute rates for live sessions." },
  { kind: "vr_video", title: "VR videos", desc: "Suggested unlock prices for VR180 / 360 videos." },
];
const PriceKindEditor = ({ kind, title, desc, hasUsd }: (typeof PRICE_KINDS)[number]) => {
  const { allOptions, reload } = usePriceOptions(kind);
  const currency = useSetting("currency");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Partial<PriceOption>>({ label: "", credits: 0, price_cents: null, stripe_price_id: "" });
  const save = async (o: Partial<PriceOption>, id?: string) => {
    const body = { kind, label: o.label || null, credits: Number(o.credits) || 0, price_cents: hasUsd ? (o.price_cents ?? Math.round(Number(o.credits) * currency.rate_per_credit * 100)) : null, stripe_price_id: o.stripe_price_id || null, is_popular: !!o.is_popular, is_active: o.is_active ?? true, sort: o.sort ?? allOptions.length + 1 };
    const { error } = id ? await (supabase as any).from("price_options").update(body).eq("id", id) : await (supabase as any).from("price_options").insert(body);
    if (error) return toast.error(error.message);
    toast.success("Saved"); setAdding(false); reload();
  };
  const remove = async (id: string) => { await (supabase as any).from("price_options").delete().eq("id", id); reload(); };
  return (
    <Card title={title} desc={desc}>
      <div className="flex flex-wrap gap-2">
        {allOptions.map((o) => (
          <div key={o.id} className={`rounded-lg border px-3 py-2 text-sm flex items-center gap-3 ${o.is_active ? "border-border bg-muted/40" : "border-border/50 opacity-50"}`}>
            <div><div className="font-bold">{o.credits} {currency.credit_name}{o.label && <span className="font-normal text-muted-foreground"> · {o.label}</span>}{o.is_popular && <span className="ml-1 text-[10px] text-accent">popular</span>}</div>{hasUsd && <div className="text-[11px] text-muted-foreground">{currency.symbol}{((o.price_cents || 0) / 100).toFixed(2)}{o.stripe_price_id ? "" : " · no Stripe price"}</div>}</div>
            <Switch checked={o.is_active} onCheckedChange={(v) => save({ ...o, is_active: v }, o.id)} />
            <button onClick={() => remove(o.id)} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}><Plus className="h-4 w-4 mr-1" /> Add</Button>
      </div>
      {adding && (
        <div className="grid sm:grid-cols-5 gap-2 items-end rounded-lg border border-border bg-muted/30 p-3">
          <Field label={`${currency.credit_name}`}><Input type="number" value={draft.credits ?? 0} onChange={(e) => setDraft({ ...draft, credits: Number(e.target.value) })} className="bg-muted border-border" /></Field>
          <Field label="Label"><Input value={draft.label || ""} onChange={(e) => setDraft({ ...draft, label: e.target.value })} className="bg-muted border-border" /></Field>
          {hasUsd && <Field label={`Price (${currency.main})`}><Input type="number" step="0.01" value={draft.price_cents != null ? draft.price_cents / 100 : ""} onChange={(e) => setDraft({ ...draft, price_cents: Math.round(Number(e.target.value) * 100) })} className="bg-muted border-border" /></Field>}
          {hasUsd && <Field label="Stripe price ID"><Input value={draft.stripe_price_id || ""} onChange={(e) => setDraft({ ...draft, stripe_price_id: e.target.value })} placeholder="price_…" className="bg-muted border-border font-mono" /></Field>}
          <div className="flex gap-2"><Button size="sm" onClick={() => save(draft)} className="bg-gradient-purple text-primary-foreground">Save</Button><Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button></div>
        </div>
      )}
    </Card>
  );
};
const PricingSection = () => <div className="space-y-4">{PRICE_KINDS.map((k) => <PriceKindEditor key={k.kind} {...k} />)}</div>;

const PaymentsSection = () => (
  <div className="space-y-4">
    <Card title="Payment systems" desc="How members pay for BREAD and subscriptions.">
      <div className="rounded-lg border border-border bg-muted/40 p-4 flex items-start gap-3">
        <CreditCard className="h-5 w-5 text-primary mt-0.5" />
        <div className="flex-1"><div className="font-bold text-sm">Stripe</div><p className="text-xs text-muted-foreground mt-1">Cards, Apple Pay and Google Pay through Stripe Checkout. BREAD packages map to Stripe price IDs (see Pricing). Subscriptions use Stripe recurring prices created per tier.</p>
          <p className="text-xs text-muted-foreground mt-2">Keys live in Supabase → Edge Functions → Secrets as <span className="font-mono">STRIPE_SECRET_KEY</span> and <span className="font-mono">STRIPE_WEBHOOK_SECRET</span>. Adult content note: Stripe prohibits adult content on standard accounts. For explicit content use CCBill, Segpay or NETbilling and ask to wire one in.</p></div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">Active</span>
      </div>
      <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">Second payment gateway (CCBill / Segpay / NETbilling / crypto): on the roadmap. Toggle it in Features once built.</div>
    </Card>
  </div>
);

const PayoutsSection = () => {
  const { draft, set, save, saving, dirty } = useBlob("payouts");
  const currency = useSetting("currency");
  const methods = ["paypal", "bank", "crypto", "cashapp", "zelle", "wise"];
  return (
    <div className="space-y-4">
      <Card title="Default payout settings" desc="Applied to every sale: VR unlocks, calls, tips.">
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Creator reward (%)" hint="Creator keeps this share; the platform keeps the rest."><Input type="number" min={0} max={100} value={draft.creator_share_pct} onChange={(e) => set({ creator_share_pct: Number(e.target.value) })} className="bg-muted border-border" /></Field>
          <Field label="Referral commission (%)" hint="Lifetime share for whoever referred a creator (referral links on the roadmap)."><Input type="number" min={0} max={100} value={draft.referral_pct} onChange={(e) => set({ referral_pct: Number(e.target.value) })} className="bg-muted border-border" /></Field>
        </div>
      </Card>
      <Card title="Payout requests" desc="Creators request payouts from Settings → Payouts. You approve and pay them from Admin → Payouts.">
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Payout commission (%)"><Input type="number" min={0} max={100} value={draft.payout_commission_pct} onChange={(e) => set({ payout_commission_pct: Number(e.target.value) })} className="bg-muted border-border" /></Field>
          <Field label={`Request fee (${currency.credit_name})`}><Input type="number" min={0} value={draft.request_fee_credits} onChange={(e) => set({ request_fee_credits: Number(e.target.value) })} className="bg-muted border-border" /></Field>
          <Field label={`Minimum request (${currency.credit_name})`} hint={`≈ ${currency.symbol}${(draft.min_request_credits * currency.rate_per_credit).toFixed(2)}`}><Input type="number" min={1} value={draft.min_request_credits} onChange={(e) => set({ min_request_credits: Number(e.target.value) })} className="bg-muted border-border" /></Field>
        </div>
        <Field label="Payout methods creators can choose">
          <div className="flex flex-wrap gap-2">{methods.map((m) => { const on = draft.methods.includes(m); return <button key={m} onClick={() => set({ methods: on ? draft.methods.filter((x) => x !== m) : [...draft.methods, m] })} className={`px-3 py-1.5 rounded-full text-xs font-medium border capitalize ${on ? "bg-primary/15 border-primary/50 text-primary" : "border-border text-muted-foreground"}`}>{m}</button>; })}</div>
        </Field>
      </Card>
      <SaveBar save={save} saving={saving} dirty={dirty} />
    </div>
  );
};

const CurrenciesSection = () => {
  const { draft, set, save, saving, dirty } = useBlob("currency");
  return (
    <div className="space-y-4">
      <Card title="Main currency" desc="Everything on the platform is priced in credits; this is how credits convert to money.">
        <div className="grid sm:grid-cols-4 gap-3">
          <Field label="Currency code"><Input value={draft.main} onChange={(e) => set({ main: e.target.value.toUpperCase() })} className="bg-muted border-border" /></Field>
          <Field label="Symbol"><Input value={draft.symbol} onChange={(e) => set({ symbol: e.target.value })} className="bg-muted border-border" /></Field>
          <Field label="Credit name"><Input value={draft.credit_name} onChange={(e) => set({ credit_name: e.target.value })} className="bg-muted border-border" /></Field>
          <Field label={`Rate per 1 ${draft.credit_name}`} hint="Used for payouts and the dashboard's money figures."><Input type="number" step="0.01" value={draft.rate_per_credit} onChange={(e) => set({ rate_per_credit: Number(e.target.value) })} className="bg-muted border-border" /></Field>
        </div>
      </Card>
      <SaveBar save={save} saving={saving} dirty={dirty} />
    </div>
  );
};

const DomainSection = () => {
  const { draft, set, save, saving, dirty } = useBlob("domain");
  return (
    <div className="space-y-4">
      <Card title="Domain name" desc={`Your site currently answers at ${window.location.host}.`}>
        <ol className="text-xs text-muted-foreground space-y-1 list-decimal pl-4">
          <li>In Vercel → Project → Settings → Domains, add your domain.</li>
          <li>At your DNS host (Cloudflare recommended), add the CNAME / A records Vercel shows.</li>
          <li>Wait for the certificate, then enter the final URL below so emails and links use it.</li>
        </ol>
        <Field label="Custom domain URL"><Input value={draft.custom_domain} onChange={(e) => set({ custom_domain: e.target.value })} placeholder="https://therealdopechicks.com" className="bg-muted border-border" /></Field>
      </Card>
      <SaveBar save={save} saving={saving} dirty={dirty} />
    </div>
  );
};

const SmtpSection = () => {
  const { draft, set, save, saving, dirty } = useBlob("smtp");
  return (
    <div className="space-y-4">
      <Card title="Mailing lists, SMTP" desc="Transactional email (sign-up, password reset) is sent by Supabase Auth. Enter your SMTP details here, then mirror them in Supabase → Authentication → SMTP so mail comes from your domain.">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Server"><Input value={draft.host} onChange={(e) => set({ host: e.target.value })} placeholder="smtp.resend.com" className="bg-muted border-border" /></Field>
          <Field label="Port (587 for most)"><Input type="number" value={draft.port} onChange={(e) => set({ port: Number(e.target.value) })} className="bg-muted border-border" /></Field>
          <Field label="Login"><Input value={draft.login} onChange={(e) => set({ login: e.target.value })} className="bg-muted border-border" /></Field>
          <Field label="Password"><Input type="password" value={draft.password} onChange={(e) => set({ password: e.target.value })} className="bg-muted border-border" /></Field>
          <Field label="From email address"><Input type="email" value={draft.from_email} onChange={(e) => set({ from_email: e.target.value })} className="bg-muted border-border" /></Field>
        </div>
      </Card>
      <div className="flex gap-2"><SaveBar save={save} saving={saving} dirty={dirty} /><Button variant="outline" onClick={() => { set({ host: "", port: 587, login: "", password: "", from_email: "" }); }}>Clear all</Button></div>
    </div>
  );
};

const CategoriesSection = () => {
  const { allCategories, reload } = useCategories();
  const [name, setName] = useState("");
  const add = async () => {
    const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    if (!slug) return;
    const { error } = await (supabase as any).from("categories").insert({ name: name.trim(), slug, sort: allCategories.length + 1 });
    if (error) return toast.error(error.message);
    setName(""); reload();
  };
  const rename = async (id: string, n: string) => { await (supabase as any).from("categories").update({ name: n }).eq("id", id); reload(); };
  const toggle = async (id: string, v: boolean) => { await (supabase as any).from("categories").update({ is_active: v }).eq("id", id); reload(); };
  const remove = async (id: string) => { await (supabase as any).from("categories").delete().eq("id", id); reload(); };
  return (
    <Card title="Categories" desc="Creators pick one on their profile; fans browse by category on the home page.">
      <div className="flex gap-2"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category" className="bg-muted border-border" onKeyDown={(e) => e.key === "Enter" && add()} /><Button onClick={add} className="bg-gradient-purple text-primary-foreground"><Plus className="h-4 w-4" /></Button></div>
      <div className="divide-y divide-border rounded-lg border border-border">
        {allCategories.map((c) => (
          <div key={c.id} className="flex items-center gap-3 px-3 py-2">
            <Input defaultValue={c.name} onBlur={(e) => e.target.value !== c.name && rename(c.id, e.target.value)} className="bg-transparent border-0 h-8 px-0 focus-visible:ring-0" />
            <span className="text-[11px] text-muted-foreground font-mono">{c.slug}</span>
            <Switch checked={c.is_active} onCheckedChange={(v) => toggle(c.id, v)} />
            <button onClick={() => remove(c.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </Card>
  );
};

const DesignSection = () => {
  const { draft, set, save, saving, dirty } = useBlob("design");
  const videoCall = usePriceOptions("video_call");
  return (
    <div className="space-y-4">
      <Card title="Customizing color palette" desc="Applied live across the site. Primary = buttons and highlights, secondary = gold accents.">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Primary color"><div className="flex gap-2"><input type="color" value={draft.primary} onChange={(e) => set({ primary: e.target.value })} className="h-10 w-14 rounded border border-border bg-transparent" /><Input value={draft.primary} onChange={(e) => set({ primary: e.target.value })} className="bg-muted border-border font-mono" /></div></Field>
          <Field label="Secondary color"><div className="flex gap-2"><input type="color" value={draft.secondary} onChange={(e) => set({ secondary: e.target.value })} className="h-10 w-14 rounded border border-border bg-transparent" /><Input value={draft.secondary} onChange={(e) => set({ secondary: e.target.value })} className="bg-muted border-border font-mono" /></div></Field>
        </div>
        <div className="flex gap-2"><div className="h-8 flex-1 rounded" style={{ background: draft.primary }} /><div className="h-8 flex-1 rounded" style={{ background: draft.secondary }} /><Button variant="ghost" size="sm" onClick={() => set({ primary: DEFAULTS.design.primary, secondary: DEFAULTS.design.secondary })}>Reset</Button></div>
      </Card>
      <Card title="Layout settings">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Menu type"><Select value={draft.menu_type} onValueChange={(v) => set({ menu_type: v as "popup" | "full" })}><SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="popup">Pop-up window</SelectItem><SelectItem value="full">Full page menu</SelectItem></SelectContent></Select></Field>
          <Field label="Desktop sidebar position (admin)"><Select value={draft.sidebar} onValueChange={(v) => set({ sidebar: v as "left" | "right" })}><SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="left">Left side</SelectItem><SelectItem value="right">Right side</SelectItem></SelectContent></Select></Field>
        </div>
      </Card>
      <Card title="Price settings" desc="Video-call defaults for new creators come from Pricing → Video call."><p className="text-xs text-muted-foreground">Current options: {videoCall.options.map((o) => o.credits).join(", ") || "none"} BREAD. Creators set their own price and call length in Edit profile → Calls & Video.</p></Card>
      <SaveBar save={save} saving={saving} dirty={dirty} />
    </div>
  );
};

const DisplaySection = () => {
  const navigate = useNavigate();
  const [showDummy, setShowDummy] = useState(true);
  useEffect(() => { (supabase as any).from("platform_settings").select("value").eq("key", "show_dummy_content").maybeSingle().then(({ data }: any) => setShowDummy(data?.value?.enabled ?? true)); }, []);
  const toggle = async (v: boolean) => { setShowDummy(v); const { error } = await (supabase as any).from("platform_settings").upsert({ key: "show_dummy_content", value: { enabled: v }, updated_at: new Date().toISOString() }, { onConflict: "key" }); if (error) toast.error(error.message); else toast.success(`Demo content ${v ? "on" : "off"}`); loadSettings(true); };
  return (
    <div className="space-y-4">
      <Card title="Content display"><div className="flex items-center justify-between rounded-lg bg-muted/50 border border-border p-4"><div><div className="text-sm font-medium flex items-center gap-2"><ToggleLeft className="h-4 w-4 text-primary" /> Show demo creators on the homepage</div><p className="text-xs text-muted-foreground mt-1">Sample creator cards until you have real ones featured.</p></div><Switch checked={showDummy} onCheckedChange={toggle} /></div></Card>
      <Card title="View platform as" desc="Open the site from another perspective while keeping your admin session.">
        <div className="grid sm:grid-cols-2 gap-3">
          <Button variant="outline" className="h-auto py-4 flex flex-col gap-1 border-primary/30 hover:bg-primary/10" onClick={() => navigate("/?viewAs=fan")}><UserCircle className="h-6 w-6 text-primary" /><span className="font-medium">View as fan</span></Button>
          <Button variant="outline" className="h-auto py-4 flex flex-col gap-1 border-accent/30 hover:bg-accent/10" onClick={() => navigate("/?viewAs=creator")}><Crown className="h-6 w-6 text-accent" /><span className="font-medium">View as creator</span></Button>
        </div>
      </Card>
    </div>
  );
};

const AdminSettingsTab = ({ initial = "general" }: { initial?: Section }) => {
  const [section, setSection] = useState<Section>(initial);
  const Body = { general: GeneralSection, pricing: PricingSection, payments: PaymentsSection, payouts: PayoutsSection, currencies: CurrenciesSection, domain: DomainSection, smtp: SmtpSection, categories: CategoriesSection, design: DesignSection, display: DisplaySection }[section];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid lg:grid-cols-[220px_1fr] gap-4">
      <nav className="rounded-xl bg-gradient-card border border-border p-2 h-fit flex lg:flex-col gap-1 overflow-x-auto">
        {SECTIONS.map((s) => (
          <button key={s.key} onClick={() => setSection(s.key)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap ${section === s.key ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground hover:bg-muted/50"}`}><s.icon className="h-4 w-4" />{s.label}</button>
        ))}
      </nav>
      <div className="min-w-0"><Body /></div>
    </motion.div>
  );
};

export { SettingsIcon };
export default AdminSettingsTab;
