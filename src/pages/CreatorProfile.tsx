import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import {
  Heart, Lock, Star, Crown, MessageCircle, Share2,
  Image as ImageIcon, Video, Calendar, Users, Eye, Loader2, CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CreatorData {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_creator: boolean;
  created_at: string;
}

interface TierData {
  id: string;
  tier_name: string;
  price_cents: number;
  description: string | null;
  is_active: boolean;
}

const tierColors: Record<string, string> = {
  Bronze: "from-amber-700 to-amber-900",
  Silver: "from-gray-400 to-gray-600",
  Gold: "from-yellow-500 to-amber-600",
};

const tierFeatures: Record<string, string[]> = {
  Bronze: ["Access to basic posts", "Like & comment", "Monthly newsletter"],
  Silver: ["Everything in Bronze", "Exclusive photo sets", "Behind-the-scenes content", "Priority DMs"],
  Gold: ["Everything in Silver", "Custom content requests", "1-on-1 video calls", "Early access to new drops", "Exclusive merch discounts"],
};

const contentGrid = [
  { id: 1, type: "photo", locked: false, img: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop", likes: 342 },
  { id: 2, type: "photo", locked: true, img: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=400&fit=crop", likes: 891 },
  { id: 3, type: "video", locked: true, img: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=400&fit=crop", likes: 1203 },
  { id: 4, type: "photo", locked: false, img: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop", likes: 567 },
  { id: 5, type: "photo", locked: true, img: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&h=400&fit=crop", likes: 2100 },
  { id: 6, type: "video", locked: true, img: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=400&fit=crop", likes: 1540 },
];

const CreatorProfile = () => {
  const { handle } = useParams<{ handle: string }>();
  const [activeTab, setActiveTab] = useState<"all" | "photos" | "videos">("all");
  const [subscribingTier, setSubscribingTier] = useState<string | null>(null);
  const [activeSubscription, setActiveSubscription] = useState<{ tier: string; subscriptionEnd: string } | null>(null);
  const [checkingSubscription, setCheckingSubscription] = useState(false);
  const [creator, setCreator] = useState<CreatorData | null>(null);
  const [tiers, setTiers] = useState<TierData[]>([]);
  const [loadingCreator, setLoadingCreator] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Load creator profile from DB
  useEffect(() => {
    const loadCreator = async () => {
      setLoadingCreator(true);
      // Try to find creator by display_name (used as handle)
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("is_creator", true);

      if (error) {
        console.error("Error loading creator:", error);
        setLoadingCreator(false);
        return;
      }

      // Match by handle (lowercase display_name without spaces, or user_id)
      const found = profiles?.find((p) => {
        const slug = (p.display_name || "").toLowerCase().replace(/\s+/g, "");
        return slug === handle || p.user_id === handle;
      });

      if (found) {
        setCreator(found as CreatorData);
        loadTiers(found.user_id);
        if (user) checkSubscription(found.user_id);
      }
      setLoadingCreator(false);
    };

    loadCreator();
  }, [handle, user]);

  const loadTiers = async (creatorUserId: string) => {
    const { data } = await supabase
      .from("creator_subscription_tiers")
      .select("*")
      .eq("creator_id", creatorUserId)
      .eq("is_active", true)
      .order("price_cents", { ascending: true });

    if (data && data.length > 0) {
      setTiers(data as TierData[]);
    }
  };

  const checkSubscription = async (creatorUserId: string) => {
    setCheckingSubscription(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-creator-subscription", {
        body: { creatorId: creatorUserId },
      });
      if (!error && data?.subscribed) {
        setActiveSubscription({ tier: data.tier, subscriptionEnd: data.subscription_end });
      }
    } catch (err) {
      console.error("Error checking subscription:", err);
    } finally {
      setCheckingSubscription(false);
    }
  };

  const handleSubscribe = async (tier: TierData) => {
    if (!user) { navigate("/auth"); return; }

    setSubscribingTier(tier.id);
    try {
      const { data, error } = await supabase.functions.invoke("create-creator-checkout", {
        body: { tierId: tier.id },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to start checkout", variant: "destructive" });
    } finally {
      setSubscribingTier(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("creator-portal");
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const filtered = contentGrid.filter((c) =>
    activeTab === "all" ? true : activeTab === "photos" ? c.type === "photo" : c.type === "video"
  );

  const displayName = creator?.display_name || "Creator";
  const avatarUrl = creator?.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&crop=face";
  const coverUrl = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1400&h=400&fit=crop&crop=top";
  const bio = creator?.bio || "Content creator on Dope Chicks ✨";
  const joinedDate = creator ? new Date(creator.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "";

  // Use real tiers if available, otherwise show defaults for demo
  const displayTiers = tiers.length > 0 ? tiers : [
    { id: "demo-bronze", tier_name: "Bronze", price_cents: 499, description: null, is_active: true },
    { id: "demo-silver", tier_name: "Silver", price_cents: 999, description: null, is_active: true },
    { id: "demo-gold", tier_name: "Gold", price_cents: 2499, description: null, is_active: true },
  ];

  if (loadingCreator) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Cover */}
      <div className="relative h-64 md:h-80 mt-16">
        <img src={coverUrl} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      </div>

      <div className="container mx-auto px-4 -mt-20 relative">
        {/* Profile Header */}
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-end mb-8">
          <div className="w-32 h-32 rounded-full border-4 border-background overflow-hidden ring-2 ring-primary/50 shrink-0">
            <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl md:text-3xl font-black">{displayName}</h1>
              <Crown className="h-5 w-5 text-accent" />
            </div>
            <p className="text-sm text-muted-foreground mb-2">@{(displayName).toLowerCase().replace(/\s+/g, "")}</p>
            <p className="text-sm text-secondary-foreground max-w-lg">{bio}</p>
            <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
              {joinedDate && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Joined {joinedDate}</span>}
              <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {tiers.length > 0 ? "Active" : "New"} creator</span>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="icon" className="border-border text-muted-foreground hover:text-foreground">
              <Share2 className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="border-border text-muted-foreground hover:text-foreground">
              <Heart className="h-4 w-4" />
            </Button>
            <Button className="bg-gradient-purple text-primary-foreground font-bold hover:opacity-90">
              <MessageCircle className="h-4 w-4 mr-2" /> Message
            </Button>
          </div>
        </div>

        {/* Subscription Tiers */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black flex items-center gap-2">
              <Star className="h-5 w-5 text-accent" /> Subscription Tiers
            </h2>
            {activeSubscription && (
              <Button variant="outline" size="sm" onClick={handleManageSubscription} className="text-xs">
                Manage Subscription
              </Button>
            )}
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {displayTiers.map((tier) => {
              const isCurrentTier = activeSubscription?.tier === tier.tier_name;
              const isPopular = tier.tier_name === "Silver";
              const color = tierColors[tier.tier_name] || "from-primary to-primary/80";
              const features = tierFeatures[tier.tier_name] || [tier.description || "Access to exclusive content"];

              return (
                <div
                  key={tier.id}
                  className={`relative rounded-xl p-5 border transition-colors ${
                    isCurrentTier ? "border-accent/60 glow-gold" : isPopular ? "border-primary/50 glow-purple" : "border-border"
                  } bg-gradient-card`}
                >
                  {isCurrentTier && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-accent text-accent-foreground rounded-full flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Your Plan
                    </span>
                  )}
                  {!isCurrentTier && isPopular && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-primary text-primary-foreground rounded-full">
                      Most Popular
                    </span>
                  )}
                  <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r ${color} text-primary-foreground mb-3`}>
                    {tier.tier_name}
                  </div>
                  <div className="flex items-baseline gap-1 mb-3">
                    <span className="text-3xl font-black text-gradient-gold">${(tier.price_cents / 100).toFixed(2)}</span>
                    <span className="text-sm text-muted-foreground">/mo</span>
                  </div>
                  <ul className="space-y-2 mb-4">
                    {features.map((f) => (
                      <li key={f} className="text-xs text-muted-foreground flex items-start gap-2">
                        <span className="text-primary mt-0.5">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    onClick={() => handleSubscribe(tier)}
                    disabled={isCurrentTier || subscribingTier === tier.id}
                    className={`w-full font-bold text-sm ${
                      isCurrentTier ? "bg-accent/20 text-accent cursor-default"
                        : isPopular ? "bg-gradient-purple text-primary-foreground hover:opacity-90"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {subscribingTier === tier.id ? (
                      <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Processing...</>
                    ) : isCurrentTier ? "Subscribed" : "Subscribe"}
                  </Button>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Content Grid */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black">Content</h2>
            <div className="flex gap-1">
              {(["all", "photos", "videos"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    activeTab === tab ? "bg-gradient-purple text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {filtered.map((item) => (
              <motion.div key={item.id} whileHover={{ scale: 1.02 }} className="relative aspect-square rounded-xl overflow-hidden cursor-pointer group">
                <img src={item.img} alt="" className={`w-full h-full object-cover ${item.locked ? "blur-lg scale-110" : ""} group-hover:scale-105 transition-transform duration-300`} />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                {item.locked && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <Lock className="h-8 w-8 text-accent mb-2" />
                    <span className="text-xs font-bold text-accent">Subscribe to unlock</span>
                  </div>
                )}
                {item.type === "video" && !item.locked && (
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-primary/80 text-primary-foreground text-[10px] font-bold">VIDEO</div>
                )}
                <div className="absolute bottom-2 left-2 flex items-center gap-1 text-xs text-foreground/80">
                  <Heart className="h-3 w-3" /> {item.likes.toLocaleString()}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default CreatorProfile;
