import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  BarChart3, Blocks, Crown, DollarSign, FileText, Headset, Home, Inbox, LogOut, Megaphone, Menu, Receipt, Settings, Shield, ShieldCheck, Sparkles, Users, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";
import AdminOverviewTab from "@/components/admin/AdminOverviewTab";
import AdminUsersTab from "@/components/admin/AdminUsersTab";
import AdminTransactionsTab from "@/components/admin/AdminTransactionsTab";
import AdminPayoutsTab from "@/components/admin/AdminPayoutsTab";
import AdminPagesTab from "@/components/admin/AdminPagesTab";
import AdminAnnouncementsTab from "@/components/admin/AdminAnnouncementsTab";
import AdminFeaturesTab from "@/components/admin/AdminFeaturesTab";
import AdminContentWallTab from "@/components/admin/AdminContentWallTab";
import AdminAnalyticsTab from "@/components/admin/AdminAnalyticsTab";
import AdminContentTab from "@/components/admin/AdminContentTab";
import AdminSettingsTab from "@/components/admin/AdminSettingsTab";
import AdminSecurityTab from "@/components/admin/AdminSecurityTab";
import AdminFeaturedTab from "@/components/admin/AdminFeaturedTab";
import AdminVRTab from "@/components/admin/AdminVRTab";
import { useSetting } from "@/hooks/usePlatform";

const NAV: { id: string; label: string; icon: React.ComponentType<{ className?: string }>; group?: string }[] = [
  { id: "overview", label: "Dashboard", icon: BarChart3 },
  { id: "users", label: "Users", icon: Users },
  { id: "transactions", label: "Transactions", icon: Receipt },
  { id: "payouts", label: "Payouts", icon: Inbox },
  { id: "contentwall", label: "Content Wall", icon: ShieldCheck, group: "Content" },
  { id: "featured", label: "Featured", icon: Crown },
  { id: "vr", label: "VR Videos", icon: Headset },
  { id: "pages", label: "Pages", icon: FileText },
  { id: "announcements", label: "Announcements", icon: Megaphone },
  { id: "features", label: "Features", icon: Blocks, group: "Platform" },
  { id: "content", label: "AI Monetization", icon: Sparkles },
  { id: "analytics", label: "Analytics", icon: DollarSign },
  { id: "security", label: "Security", icon: Shield },
  { id: "settings", label: "Settings", icon: Settings },
];

const AdminDashboard = () => {
  const { user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const design = useSetting("design");
  const site = useSetting("site");
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const activeTab = params.get("tab") || "overview";
  const setActiveTab = (id: string) => setParams(id === "overview" ? {} : { tab: id });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/auth"); return; }
    supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle().then(({ data }) => {
      if (!data) { navigate("/"); return; }
      setIsAdmin(true); setChecking(false);
    });
  }, [user, loading, navigate]);

  if (loading || checking) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading admin panel…</div></div>;
  if (!isAdmin) return null;

  const current = NAV.find((n) => n.id === activeTab) || NAV[0];
  const right = design.sidebar === "right";

  return (
    <div className={`min-h-screen bg-background flex overflow-x-hidden ${right ? "flex-row-reverse" : ""}`}>
      {sidebarOpen && <div className="fixed inset-0 bg-background/80 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside className={`fixed md:sticky top-0 ${right ? "right-0" : "left-0"} h-screen w-64 bg-sidebar-background ${right ? "border-l" : "border-r"} border-sidebar-border flex flex-col z-50 transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : right ? "translate-x-full md:translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
        <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
          <div><a href="/"><img src={site.logo_url || logo} alt="Logo" className="h-10 w-auto mix-blend-screen" /></a><p className="text-xs text-muted-foreground mt-1">{site.site_name} · Admin</p></div>
          <button className="md:hidden text-foreground" onClick={() => setSidebarOpen(false)}><X className="h-5 w-5" /></button>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map((item) => (
            <div key={item.id}>
              {item.group && <div className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{item.group}</div>}
              <button onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === item.id ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground hover:bg-sidebar-accent/50"}`}>
                <item.icon className="h-4 w-4" />{item.label}
              </button>
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-sidebar-border space-y-1">
          <Button variant="ghost" className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent/50" onClick={() => navigate("/")}><Home className="h-4 w-4" /> Back to site</Button>
          <Button variant="ghost" className="w-full justify-start gap-3 text-destructive hover:bg-destructive/10" onClick={signOut}><LogOut className="h-4 w-4" /> Sign out</Button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-auto">
        <header className="border-b border-border px-4 md:px-8 py-4 md:py-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button className="md:hidden text-foreground" onClick={() => setSidebarOpen(true)}><Menu className="h-6 w-6" /></button>
            <div className="min-w-0"><h1 className="text-xl md:text-2xl font-display font-bold text-foreground truncate">{current.label}</h1><p className="text-sm text-muted-foreground mt-0.5 truncate">Welcome back, {profile?.display_name || "Admin"}</p></div>
          </div>
          <span className="text-xs font-medium bg-accent/10 text-accent px-2.5 py-1 rounded-full border border-accent/20 shrink-0"><Shield className="h-3 w-3 inline mr-1" />Admin</span>
        </header>

        <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 md:p-8">
          {activeTab === "overview" && <AdminOverviewTab onNavigate={setActiveTab} />}
          {activeTab === "users" && <AdminUsersTab />}
          {activeTab === "transactions" && <AdminTransactionsTab />}
          {activeTab === "payouts" && <AdminPayoutsTab />}
          {activeTab === "contentwall" && <AdminContentWallTab />}
          {activeTab === "featured" && <AdminFeaturedTab />}
          {activeTab === "vr" && <AdminVRTab />}
          {activeTab === "pages" && <AdminPagesTab />}
          {activeTab === "announcements" && <AdminAnnouncementsTab />}
          {activeTab === "features" && <AdminFeaturesTab />}
          {activeTab === "content" && <AdminContentTab />}
          {activeTab === "analytics" && <AdminAnalyticsTab />}
          {activeTab === "security" && <AdminSecurityTab />}
          {activeTab === "settings" && <AdminSettingsTab />}
        </motion.div>
      </main>
    </div>
  );
};

export default AdminDashboard;
