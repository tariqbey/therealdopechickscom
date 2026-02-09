import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  Users, DollarSign, Image, TrendingUp, Settings, LogOut,
  BarChart3, Shield, Eye, Home, Video, Sparkles, Crown, Menu, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";
import AdminUsersTab from "@/components/admin/AdminUsersTab";
import AdminAnalyticsTab from "@/components/admin/AdminAnalyticsTab";
import AdminContentTab from "@/components/admin/AdminContentTab";
import AdminSettingsTab from "@/components/admin/AdminSettingsTab";
import AdminSecurityTab from "@/components/admin/AdminSecurityTab";
import AdminFeaturedTab from "@/components/admin/AdminFeaturedTab";

interface Stats {
  totalUsers: number;
  totalCreators: number;
  totalGenerations: number;
  totalBreadCirculating: number;
}

interface UserRow {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  is_creator: boolean;
  created_at: string;
}

const AdminDashboard = () => {
  const { user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, totalCreators: 0, totalGenerations: 0, totalBreadCirculating: 0 });
  const [users, setUsers] = useState<UserRow[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/auth"); return; }

    const checkAdmin = async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!data) { navigate("/"); return; }
      setIsAdmin(true);
      setChecking(false);
    };
    checkAdmin();
  }, [user, loading, navigate]);

  const fetchUsers = async () => {
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(50);
    setUsers((data as UserRow[]) ?? []);
  };

  useEffect(() => {
    if (!isAdmin) return;
    const fetchStats = async () => {
      const [profilesRes, creatorsRes, gensRes, walletsRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_creator", true),
        supabase.from("ai_generations").select("id", { count: "exact", head: true }),
        supabase.from("wallets").select("balance"),
      ]);
      setStats({
        totalUsers: profilesRes.count ?? 0,
        totalCreators: creatorsRes.count ?? 0,
        totalGenerations: gensRes.count ?? 0,
        totalBreadCirculating: (walletsRes.data ?? []).reduce((s, w) => s + (w.balance || 0), 0),
      });
    };
    fetchStats();
    fetchUsers();
  }, [isAdmin]);

  if (loading || checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading admin panel…</div>
      </div>
    );
  }

  if (!isAdmin) return null;

  const statCards = [
    { label: "Total Users", value: stats.totalUsers, icon: Users, color: "text-primary" },
    { label: "Creators", value: stats.totalCreators, icon: Video, color: "text-accent" },
    { label: "AI Generations", value: stats.totalGenerations, icon: Sparkles, color: "text-primary" },
    { label: "BREAD Circulating", value: stats.totalBreadCirculating.toLocaleString(), icon: DollarSign, color: "text-accent" },
  ];

  const sidebarItems = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "users", label: "Users", icon: Users },
    { id: "featured", label: "Featured", icon: Crown },
    { id: "content", label: "Monetization", icon: DollarSign },
    { id: "analytics", label: "Analytics", icon: TrendingUp },
    { id: "security", label: "Security", icon: Shield },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background flex overflow-x-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-background/80 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-sidebar-background border-r border-sidebar-border flex flex-col z-50 transition-transform duration-300 ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}>
        <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
          <div>
            <a href="/">
              <img src={logo} alt="Logo" className="h-10 w-auto mix-blend-screen" />
            </a>
            <p className="text-xs text-muted-foreground mt-1">Admin Panel</p>
          </div>
          <button className="md:hidden text-foreground" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === item.id
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-sidebar-border space-y-1">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent/50"
            onClick={() => navigate("/")}
          >
            <Home className="h-4 w-4" /> Back to Site
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-destructive hover:bg-destructive/10"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-auto">
        <header className="border-b border-border px-4 md:px-8 py-4 md:py-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button className="md:hidden text-foreground" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-6 w-6" />
            </button>
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-display font-bold text-foreground truncate">
                {activeTab === "overview" && "Dashboard Overview"}
                {activeTab === "users" && "User Management"}
                {activeTab === "featured" && "Featured Creators"}
                {activeTab === "content" && "API Monetization"}
                {activeTab === "analytics" && "Analytics"}
                {activeTab === "security" && "Security"}
                {activeTab === "settings" && "Settings"}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5 truncate">
                Welcome back, {profile?.display_name || "Admin"}
              </p>
            </div>
          </div>
          <span className="text-xs font-medium bg-accent/10 text-accent px-2.5 py-1 rounded-full border border-accent/20 shrink-0">
            <Shield className="h-3 w-3 inline mr-1" />Admin
          </span>
        </header>

        <div className="p-4 md:p-8">
          {activeTab === "overview" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                {statCards.map((card) => (
                  <div key={card.label} className="rounded-xl bg-gradient-card border border-border p-4 md:p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] md:text-xs font-bold text-muted-foreground uppercase tracking-wide">{card.label}</span>
                      <card.icon className={`h-4 w-4 ${card.color}`} />
                    </div>
                    <p className="text-2xl md:text-3xl font-display font-bold text-foreground">{card.value}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl bg-gradient-card border border-border p-4 md:p-6">
                <h3 className="text-lg font-display font-bold text-foreground mb-4">Recent Users</h3>
                <div className="overflow-x-auto -mx-4 md:mx-0">
                  <table className="w-full text-sm min-w-[500px]">
                    <thead>
                      <tr className="text-muted-foreground text-left border-b border-border">
                        <th className="pb-3 font-medium px-4 md:px-0">User</th>
                        <th className="pb-3 font-medium">Type</th>
                        <th className="pb-3 font-medium">Joined</th>
                        <th className="pb-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {users.slice(0, 10).map((u) => (
                        <tr key={u.id} className="text-foreground">
                          <td className="py-3 px-4 md:px-0 flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                              {(u.display_name || "?")[0].toUpperCase()}
                            </div>
                            <span className="truncate">{u.display_name || "Unknown"}</span>
                          </td>
                          <td className="py-3">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${u.is_creator ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"}`}>
                              {u.is_creator ? "Creator" : "Fan"}
                            </span>
                          </td>
                          <td className="py-3 text-muted-foreground">
                            {new Date(u.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3">
                            <Button variant="ghost" size="sm" className="h-7 text-xs">
                              <Eye className="h-3 w-3 mr-1" /> View
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "users" && (
            <AdminUsersTab users={users} onRefresh={fetchUsers} />
          )}

          {activeTab === "featured" && <AdminFeaturedTab />}

          {activeTab === "content" && <AdminContentTab />}

          {activeTab === "analytics" && <AdminAnalyticsTab />}

          {activeTab === "settings" && <AdminSettingsTab />}

          {activeTab === "security" && <AdminSecurityTab />}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
