import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  User, Shield, Crown, CreditCard, Bell, ArrowRight, History,
} from "lucide-react";

interface SettingsItem {
  label: string;
  description: string;
  icon: React.ElementType;
  route: string;
  show: boolean;
  accent?: string;
}

const Settings = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  if (!user) {
    navigate("/auth");
    return null;
  }

  const isCreator = profile?.is_creator || false;

  const items: SettingsItem[] = [
    {
      label: "Profile",
      description: "Edit your display name, avatar, bio, and account type",
      icon: User,
      route: "/settings/profile",
      show: true,
    },
    {
      label: "Subscription Tiers",
      description: "Manage your Bronze, Silver, and Gold pricing",
      icon: Crown,
      route: "/settings/tiers",
      show: isCreator,
      accent: "text-accent",
    },
    {
      label: "Transaction History",
      description: "View your BREAD and Credits purchase history",
      icon: CreditCard,
      route: "/transactions",
      show: true,
    },
    {
      label: "Generation History",
      description: "Browse your AI generation history",
      icon: History,
      route: "/history",
      show: true,
    },
    {
      label: "Admin Panel",
      description: "Manage users, content, analytics, and platform settings",
      icon: Shield,
      route: "/admin",
      show: isAdmin,
      accent: "text-destructive",
    },
  ];

  const visibleItems = items.filter((i) => i.show);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12 max-w-2xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-black mb-8">Settings</h1>

          <div className="space-y-3">
            {visibleItems.map((item) => (
              <button
                key={item.route}
                onClick={() => navigate(item.route)}
                className="w-full flex items-center gap-4 p-4 rounded-xl bg-gradient-card border border-border hover:border-primary/30 transition-colors text-left group"
              >
                <div className={`p-2.5 rounded-lg bg-muted ${item.accent || "text-foreground"}`}>
                  <item.icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
              </button>
            ))}
          </div>
        </motion.div>
      </div>
      <Footer />
    </div>
  );
};

export default Settings;
