import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import {
  Heart, Lock, Star, Crown, MessageCircle, Share2,
  Image as ImageIcon, Video, Loader2, CheckCircle2, Plus,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import CreatorContentManager from "@/components/CreatorContentManager";
import CreatorProfileEditor from "@/components/CreatorProfileEditor";
import PostEditModal from "@/components/PostEditModal";

interface CreatorData {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  cover_url: string | null;
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

interface CreatorPost {
  id: string;
  creator_id: string;
  title: string | null;
  description: string | null;
  media_url: string;
  media_type: string;
  is_locked: boolean;
  min_tier: string | null;
  likes_count: number;
  created_at: string;
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

const dummyContent: { id: string; type: string; locked: boolean; img: string; likes: number }[] = [];

const CreatorProfile = () => {
  const { handle } = useParams<{ handle: string }>();
  const [activeTab, setActiveTab] = useState<"all" | "photos" | "videos" | "manage" | "edit">("all");
  const [subscribingTier, setSubscribingTier] = useState<string | null>(null);
  const [activeSubscription, setActiveSubscription] = useState<{ tier: string; subscriptionEnd: string } | null>(null);
  const [checkingSubscription, setCheckingSubscription] = useState(false);
  const [creator, setCreator] = useState<CreatorData | null>(null);
  const [tiers, setTiers] = useState<TierData[]>([]);
  const [posts, setPosts] = useState<CreatorPost[]>([]);
  const [loadingCreator, setLoadingCreator] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingPost, setEditingPost] = useState<CreatorPost | null>(null);
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const isOwnProfile = user && creator && user.id === creator.user_id;
  const canManagePosts = isOwnProfile || isAdmin;

  const userId = user?.id;

  useEffect(() => {
    const loadCreator = async () => {
      setLoadingCreator(true);
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("is_creator", true);

      if (error) {
        console.error("Error loading creator:", error);
        setLoadingCreator(false);
        return;
      }

      const found = profiles?.find((p) => {
        const slug = (p.display_name || "").toLowerCase().replace(/\s+/g, "");
        return slug === handle || p.user_id === handle;
      });

      if (found) {
        setCreator(found as unknown as CreatorData);
        loadTiers(found.user_id);
        loadPosts(found.user_id);
        if (userId) checkSubscription(found.user_id);
      }
      setLoadingCreator(false);
    };


    loadCreator();

    // Check if current user is admin
    if (userId) {
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle()
        .then(({ data }) => setIsAdmin(!!data));
    }
  }, [handle, userId]);

  const loadTiers = async (creatorUserId: string) => {
    const { data } = await supabase
      .from("creator_subscription_tiers")
      .select("*")
      .eq("creator_id", creatorUserId)
      .eq("is_active", true)
      .order("price_cents", { ascending: true });
    if (data && data.length > 0) setTiers(data as TierData[]);
  };

  const loadPosts = async (creatorUserId: string) => {
    const { data } = await supabase
      .from("creator_posts" as any)
      .select("*")
      .eq("creator_id", creatorUserId)
      .order("created_at", { ascending: false });
    setPosts((data as unknown as CreatorPost[]) || []);
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

  // Build content grid from real posts + optional dummy
  const contentItems = posts.map((p) => ({
    id: p.id,
    type: p.media_type as "photo" | "video",
    locked: p.is_locked,
    img: p.media_url,
    likes: p.likes_count,
    isReal: true,
  }));

  const allContent = contentItems;

  const filtered = allContent.filter((c) =>
    activeTab === "all" || activeTab === "manage" ? true : activeTab === "photos" ? c.type === "photo" : c.type === "video"
  );

  const displayName = creator?.display_name || "Creator";
  const avatarUrl = creator?.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&crop=face";
  const coverUrl = creator?.cover_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1400&h=400&fit=crop&crop=top";
  const bio = creator?.bio || "Content creator ✨";
  const joinedDate = creator ? new Date(creator.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "";

  const displayTiers = tiers;

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

      {/* Cover Banner */}
      <div className="relative h-56 md:h-72 lg:h-80 mt-16 overflow-hidden">
        <img src={coverUrl} alt="" className="w-full h-full object-cover scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/40 via-transparent to-background/40" />
      </div>

      <div className="container mx-auto px-4 relative">
        {/* Profile Header Card */}
        <div className="-mt-24 md:-mt-28 relative z-10 mb-10">
          <div className="rounded-2xl bg-gradient-card border border-border/60 p-5 md:p-8 shadow-2xl shadow-background/80">
            <div className="flex flex-col md:flex-row gap-5 md:gap-8 items-center md:items-start">
              {/* Avatar */}
              <div className="relative -mt-16 md:-mt-20 shrink-0">
                <div className="w-28 h-28 md:w-36 md:h-36 rounded-full overflow-hidden ring-4 ring-background shadow-xl shadow-background/60">
                  <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-accent flex items-center justify-center ring-2 ring-background">
                  <Crown className="h-4 w-4 text-accent-foreground" />
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 text-center md:text-left mt-2 md:mt-4">
                <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3 mb-1">
                  <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">{displayName}</h1>
                </div>
                <p className="text-sm text-muted-foreground mb-3 font-medium">@{(displayName).toLowerCase().replace(/\s+/g, "")}</p>
                <p className="text-sm text-secondary-foreground max-w-lg leading-relaxed">{bio}</p>

                {/* Stats Row */}
                <div className="flex flex-wrap justify-center md:justify-start gap-5 mt-4">
                  <div className="flex flex-col items-center md:items-start">
                    <span className="text-lg font-black text-gradient-gold">{posts.length}</span>
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Posts</span>
                  </div>
                  {joinedDate && (
                    <div className="flex flex-col items-center md:items-start">
                      <span className="text-lg font-black text-foreground">{joinedDate}</span>
                      <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Joined</span>
                    </div>
                  )}
                  {displayTiers.length > 0 && (
                    <div className="flex flex-col items-center md:items-start">
                      <span className="text-lg font-black text-gradient-purple">{displayTiers.length}</span>
                      <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Tiers</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 shrink-0 mt-2 md:mt-4">
                <Button variant="outline" size="icon" className="rounded-full border-border/60 text-muted-foreground hover:text-foreground hover:border-accent/40 transition-colors">
                  <Share2 className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="rounded-full border-border/60 text-muted-foreground hover:text-foreground hover:border-destructive/40 transition-colors">
                  <Heart className="h-4 w-4" />
                </Button>
                <Button
                  className="rounded-full bg-gradient-purple text-primary-foreground font-bold hover:opacity-90 px-5"
                  onClick={() => navigate(`/messages?to=${creator?.user_id}`)}
                >
                  <MessageCircle className="h-4 w-4 mr-2" /> Message
                </Button>
              </div>
            </div>
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

        {/* Content Section */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black">Content</h2>
            <div className="flex gap-1">
              {(["all", "photos", "videos", ...(isOwnProfile ? ["manage" as const, "edit" as const] : [])] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    activeTab === tab ? "bg-gradient-purple text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab === "manage" ? (
                    <span className="flex items-center gap-1"><Plus className="h-3 w-3" /> Manage</span>
                  ) : tab === "edit" ? (
                    <span className="flex items-center gap-1">✏️ Edit Profile</span>
                  ) : (
                    tab.charAt(0).toUpperCase() + tab.slice(1)
                  )}
                </button>
              ))}
            </div>
          </div>

          {activeTab === "edit" && isOwnProfile ? (
            <div className="rounded-xl bg-gradient-card border border-border p-5">
              <CreatorProfileEditor onSaved={() => { setActiveTab("all"); if (creator) { /* reload */ window.location.reload(); } }} />
            </div>
          ) : activeTab === "manage" && isOwnProfile ? (
            <CreatorContentManager posts={posts} onRefresh={() => creator && loadPosts(creator.user_id)} />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {filtered.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <ImageIcon className="h-10 w-10 mb-3" />
                  <p className="text-sm font-medium">No content yet</p>
                  {isOwnProfile && <p className="text-xs mt-1">Switch to "Manage" to upload your first post!</p>}
                </div>
              ) : (
                filtered.map((item) => (
                  <motion.div
                    key={item.id}
                    whileHover={{ scale: 1.02 }}
                    className="relative aspect-square rounded-xl overflow-hidden cursor-pointer group"
                    onClick={() => {
                      if (canManagePosts && item.isReal) {
                        const post = posts.find((p) => p.id === item.id);
                        if (post) setEditingPost(post);
                      }
                    }}
                  >
                    {item.locked ? (
                      <>
                        <div className="w-full h-full bg-gradient-to-br from-muted via-muted/80 to-muted/60" />
                        <div className="absolute inset-0 backdrop-blur-xl bg-background/30" />
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <Lock className="h-8 w-8 text-accent mb-2 drop-shadow-lg" />
                          <span className="text-xs font-bold text-accent drop-shadow">Subscribe to unlock</span>
                          {item.type === "video" && (
                            <span className="mt-1 px-2 py-0.5 rounded-full bg-primary/80 text-primary-foreground text-[10px] font-bold">VIDEO</span>
                          )}
                        </div>
                      </>
                    ) : item.type === "video" ? (
                      <video src={item.img} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" muted />
                    ) : (
                      <img src={item.img} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    )}
                    {!item.locked && <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />}
                    {item.type === "video" && !item.locked && (
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-primary/80 text-primary-foreground text-[10px] font-bold">VIDEO</div>
                    )}
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 text-xs text-foreground/80">
                      <Heart className="h-3 w-3" /> {item.likes.toLocaleString()}
                    </div>
                    {canManagePosts && item.isReal && (
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-background/80 text-[10px] font-bold text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                        Tap to manage
                      </div>
                    )}
                  </motion.div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Post Edit Modal for owner or admin */}
      {editingPost && (
        <PostEditModal
          post={editingPost}
          open={!!editingPost}
          onClose={() => setEditingPost(null)}
          onRefresh={() => creator && loadPosts(creator.user_id)}
        />
      )}

      <Footer />
    </div>
  );
};

export default CreatorProfile;
