import { useCallback, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Crown, Download, Eye, KeyRound, Loader2, LogIn, Plus, Search, Shield, Trash2, UserCircle, Wallet } from "lucide-react";
import { startImpersonation } from "@/lib/impersonation";
import { useFeature } from "@/hooks/usePlatform";

export interface AdminUser {
  user_id: string; email: string | null; email_confirmed: boolean; display_name: string | null; avatar_url: string | null;
  is_creator: boolean; approval_status: string; role: string; created_at: string; last_sign_in_at: string | null;
  last_seen_at: string | null; bread_balance: number; credit_balance: number; timezone: string | null; referral_url: string | null; total_count: number;
}

const ROLE_FILTERS = [
  ["all", "All users"], ["members", "Members"], ["creators", "Creators"], ["pending", "Pending approval"], ["moderators", "Moderators"], ["admins", "Admins"],
];
const SORTS = [["newest", "Registration (newest)"], ["oldest", "Registration (oldest)"], ["last_login", "Last login"], ["name", "Name"], ["balance", "BREAD balance"]];

const rel = (iso: string | null) => {
  if (!iso) return "never";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
};

const AdminUsersTab = ({ onRefresh }: { users?: unknown; onRefresh?: () => void }) => {
  const { user: me } = useAuth();
  const canExport = useFeature("export_users");
  const canLoginAs = useFeature("login_as_user");
  const [rows, setRows] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [sort, setSort] = useState("newest");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const [counts, setCounts] = useState({ members: 0, creators: 0, admins: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("admin_list_users", { p_search: search || null, p_role: role, p_sort: sort, p_limit: 300, p_offset: 0 });
    if (error) toast.error(error.message);
    const list = (data as AdminUser[]) || [];
    setRows(list);
    setTotal(list[0]?.total_count ?? 0);
    setLoading(false);
  }, [search, role, sort]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => {
    (supabase as any).rpc("admin_list_users", { p_role: "all", p_limit: 2000 }).then(({ data }: { data: AdminUser[] | null }) => {
      const all = data || [];
      setCounts({ members: all.filter((u) => !u.is_creator && !u.role.includes("admin")).length, creators: all.filter((u) => u.is_creator).length, admins: all.filter((u) => u.role.includes("admin")).length });
    });
  }, [rows.length]);

  const adminAction = async (action: string, params: Record<string, unknown>) => {
    const res = await supabase.functions.invoke("admin-actions", { body: { action, ...params } });
    if (res.error) throw new Error(res.error.message);
    return res.data;
  };
  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try { await fn(); toast.success(ok); await load(); onRefresh?.(); if (selected) setSelected((s) => s && rows.find((r) => r.user_id === s.user_id) || s); }
    catch (e: any) { toast.error(e.message); }
    setBusy(null);
  };

  const exportCsv = () => {
    const head = ["id", "display_name", "email", "email_confirmed", "role", "is_creator", "approval_status", "bread_balance", "earnings_balance", "created_at", "last_sign_in_at", "last_seen_at"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [head.join(","), ...rows.map((u) => [u.user_id, u.display_name, u.email, u.email_confirmed, u.role, u.is_creator, u.approval_status, u.bread_balance, u.credit_balance, u.created_at, u.last_sign_in_at, u.last_seen_at].map(esc).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const sendReset = async (u: AdminUser) => {
    if (!u.email) return toast.error("No email on file");
    const { error } = await supabase.auth.resetPasswordForEmail(u.email, { redirectTo: `${window.location.origin}/auth` });
    if (error) toast.error(error.message); else toast.success(`Password reset email sent to ${u.email}`);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-sm text-muted-foreground">
          <span className="font-bold text-foreground">{total}</span> users: {counts.members} members, {counts.creators} creators, {counts.admins} admins
        </div>
        <div className="ml-auto flex gap-2">
          {canExport && <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4 mr-1.5" /> Export CSV</Button>}
          <Button size="sm" className="bg-gradient-purple text-primary-foreground font-bold" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1.5" /> Add user</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="relative sm:col-span-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ID, name or email" className="pl-9 bg-muted border-border" />
        </div>
        <Select value={role} onValueChange={setRole}><SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger><SelectContent>{ROLE_FILTERS.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
        <Select value={sort} onValueChange={setSort}><SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger><SelectContent>{SORTS.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
      </div>

      {/* Table */}
      <div className="rounded-xl bg-gradient-card border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead><tr className="text-muted-foreground text-left border-b border-border text-xs"><th className="p-3 font-medium">User</th><th className="p-3 font-medium">Email</th><th className="p-3 font-medium">Role</th><th className="p-3 font-medium">Status</th><th className="p-3 font-medium text-right">BREAD</th><th className="p-3 font-medium text-right">Earnings</th><th className="p-3 font-medium">Joined</th><th className="p-3 font-medium">Last login</th><th className="p-3"></th></tr></thead>
            <tbody className="divide-y divide-border">
              {loading && rows.length === 0 ? <tr><td colSpan={9} className="p-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline" /></td></tr>
              : rows.length === 0 ? <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No matching users</td></tr>
              : rows.map((u) => (
                <tr key={u.user_id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setSelected(u)}>
                  <td className="p-3"><div className="flex items-center gap-3"><div className="h-8 w-8 rounded-full bg-muted overflow-hidden flex items-center justify-center text-xs font-bold shrink-0">{u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" /> : (u.display_name || "?")[0]?.toUpperCase()}</div><div className="min-w-0"><div className="font-medium truncate">{u.display_name || "Unnamed"}</div><div className="text-[10px] text-muted-foreground font-mono truncate">{u.user_id.slice(0, 8)}</div></div></div></td>
                  <td className="p-3 text-muted-foreground truncate max-w-[200px]">{u.email || "—"}{u.email && !u.email_confirmed && <span className="ml-1 text-[10px] text-amber-500">unverified</span>}</td>
                  <td className="p-3"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${u.role.includes("admin") ? "bg-destructive/10 text-destructive" : u.is_creator ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"}`}>{u.role.includes("admin") ? "Admin" : u.role.includes("moderator") ? "Moderator" : u.is_creator ? "Creator" : "Member"}</span></td>
                  <td className="p-3"><span className={`text-xs ${u.approval_status === "approved" ? "text-emerald-400" : u.approval_status === "pending" ? "text-amber-400" : "text-red-400"}`}>{u.approval_status}</span></td>
                  <td className="p-3 text-right tabular-nums">{u.bread_balance.toLocaleString()}</td>
                  <td className="p-3 text-right tabular-nums">{u.credit_balance.toLocaleString()}</td>
                  <td className="p-3 text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="p-3 text-muted-foreground">{rel(u.last_sign_in_at)}</td>
                  <td className="p-3 text-right"><Button size="sm" variant="ghost" className="h-7 text-xs"><Eye className="h-3.5 w-3.5 mr-1" /> Open</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto bg-background">
          {selected && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 rounded-full bg-muted overflow-hidden flex items-center justify-center text-lg font-bold">{selected.avatar_url ? <img src={selected.avatar_url} alt="" className="w-full h-full object-cover" /> : (selected.display_name || "?")[0]?.toUpperCase()}</div>
                  <div className="min-w-0"><SheetTitle className="truncate">{selected.display_name || "Unnamed"}</SheetTitle><SheetDescription className="truncate">{selected.email || "no email"}</SheetDescription></div>
                </div>
              </SheetHeader>

              <div className="flex flex-wrap gap-2 mt-4">
                <Button size="sm" variant="outline" onClick={() => window.open(`/creator/${selected.user_id}`, "_blank")}><Eye className="h-4 w-4 mr-1.5" /> View profile</Button>
                {canLoginAs && selected.user_id !== me?.id && <Button size="sm" variant="outline" disabled={busy === "imp"} onClick={() => run("imp", () => startImpersonation(selected.user_id, selected.display_name || "user"), "Signed in as user")}><LogIn className="h-4 w-4 mr-1.5" /> Login as user</Button>}
                <Button size="sm" variant="outline" onClick={() => sendReset(selected)}><KeyRound className="h-4 w-4 mr-1.5" /> Send password reset</Button>
              </div>

              <Section title="Profile information">
                <Row k="Username" v={selected.display_name || "—"} />
                <Row k="Email" v={<span>{selected.email || "—"} {selected.email && <span className={`ml-1 text-[10px] ${selected.email_confirmed ? "text-emerald-400" : "text-amber-500"}`}>{selected.email_confirmed ? "verified" : "unverified"}</span>}</span>} />
                <Row k="User ID" v={<span className="font-mono text-xs">{selected.user_id}</span>} />
                <Row k="Time zone" v={selected.timezone || "—"} />
              </Section>

              <Section title="Registration information">
                <Row k="Registration date" v={new Date(selected.created_at).toLocaleString()} />
                <Row k="Last login" v={selected.last_sign_in_at ? new Date(selected.last_sign_in_at).toLocaleString() : "never"} />
                <Row k="Last online" v={rel(selected.last_seen_at)} />
                <Row k="Referral URL" v={selected.referral_url || "—"} />
              </Section>

              <Section title="Balances">
                <Row k="BREAD wallet" v={<span className="flex items-center gap-1"><Wallet className="h-3.5 w-3.5 text-primary" />{selected.bread_balance.toLocaleString()}</span>} />
                <Row k="Creator earnings" v={<span className="flex items-center gap-1"><Crown className="h-3.5 w-3.5 text-accent" />{selected.credit_balance.toLocaleString()}</span>} />
              </Section>

              <Section title="Role & access">
                <div className="flex items-center justify-between py-2"><div><div className="text-sm">Creator account</div><div className="text-xs text-muted-foreground">Can post, sell and receive payouts</div></div>
                  <Switch checked={selected.is_creator} disabled={busy === "creator"} onCheckedChange={(v) => run("creator", () => adminAction("toggle_creator", { user_id: selected.user_id, is_creator: v }), v ? "Promoted to creator" : "Set to member")} /></div>
                <div className="flex items-center justify-between py-2"><div><div className="text-sm">Approval status</div><div className="text-xs text-muted-foreground">Pending creators can't publish</div></div>
                  <Select value={selected.approval_status} onValueChange={(v) => run("appr", () => adminAction("update_approval", { user_id: selected.user_id, approval_status: v }), `Status: ${v}`)}><SelectTrigger className="w-32 h-8 bg-muted border-border"><SelectValue /></SelectTrigger><SelectContent>{["approved", "pending", "rejected"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
                <div className="flex items-center justify-between py-2"><div><div className="text-sm">Platform role</div><div className="text-xs text-muted-foreground">Admins get this panel; moderators review content</div></div>
                  <Select value={selected.role.includes("admin") ? "admin" : selected.role.includes("moderator") ? "moderator" : "none"} disabled={selected.user_id === me?.id}
                    onValueChange={(v) => run("role", () => (v === "none" ? adminAction("remove_role", { user_id: selected.user_id }) : adminAction("set_role", { user_id: selected.user_id, role: v })), "Role updated")}>
                    <SelectTrigger className="w-32 h-8 bg-muted border-border"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">User</SelectItem><SelectItem value="moderator">Moderator</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent></Select></div>
              </Section>

              <Section title="Account management">
                <p className="text-xs text-muted-foreground mb-3">Deleting removes the login, profile, wallets, posts and messages. Purchases by other users are kept. This can't be undone.</p>
                <Button variant="outline" size="sm" className="border-destructive/50 text-destructive hover:bg-destructive/10" disabled={selected.user_id === me?.id} onClick={() => setDeleting(selected)}><Trash2 className="h-4 w-4 mr-1.5" /> Delete account</Button>
              </Section>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AddUserDialog open={addOpen} onOpenChange={setAddOpen} onCreated={load} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete {deleting?.display_name || "this user"}?</AlertDialogTitle><AlertDialogDescription>Their login, profile, balances and content are permanently removed.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => { const u = deleting!; setDeleting(null); setSelected(null); run("del", async () => { const { data, error } = await (supabase as any).rpc("admin_delete_user", { p_user_id: u.user_id }); if (error) throw error; if (!data?.success) throw new Error(data?.error || "Delete failed"); }, "Account deleted"); }}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mt-6"><h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{title}</h4><div className="rounded-xl border border-border bg-muted/30 px-4 py-1 divide-y divide-border">{children}</div></div>
);
const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-4 py-2 text-sm"><span className="text-muted-foreground">{k}</span><span className="text-right truncate">{v}</span></div>
);

/** Admin creates an account. Uses a throwaway client so the admin's own session is untouched. */
const AddUserDialog = ({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isCreator, setIsCreator] = useState(false);
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!email || password.length < 6 || !name.trim()) return toast.error("Email, name and a 6+ character password are required");
    setSaving(true);
    try {
      const tmp = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await tmp.auth.signUp({ email, password, options: { data: { display_name: name.trim(), is_creator: isCreator, date_of_birth: "1990-01-01" } } });
      if (error) throw error;
      if (!data.user) throw new Error("Sign-up did not return a user");
      toast.success(`Created ${name}`);
      setEmail(""); setPassword(""); setName(""); setIsCreator(false);
      onOpenChange(false);
      setTimeout(onCreated, 800);
    } catch (e: any) { toast.error(e.message); }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-gradient-card border-border">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><UserCircle className="h-5 w-5 text-primary" /> Add user</DialogTitle><DialogDescription>Creates a login immediately (email confirmation is skipped). Share the password with them.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs text-muted-foreground">Display name</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="bg-muted border-border mt-1" /></div>
          <div><Label className="text-xs text-muted-foreground">Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-muted border-border mt-1" /></div>
          <div><Label className="text-xs text-muted-foreground">Temporary password</Label><Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-muted border-border mt-1 font-mono" /></div>
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2"><div className="text-sm flex items-center gap-2"><Crown className="h-4 w-4 text-accent" /> Creator account</div><Switch checked={isCreator} onCheckedChange={setIsCreator} /></div>
        </div>
        <div className="flex gap-2 mt-2"><Button onClick={create} disabled={saving} className="flex-1 bg-gradient-purple text-primary-foreground font-bold">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Shield className="h-4 w-4 mr-1.5" /> Create account</>}</Button><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button></div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminUsersTab;
