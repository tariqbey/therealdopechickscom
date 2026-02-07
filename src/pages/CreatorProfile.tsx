import { useState, useEffect } from "react";
import { motion } from "framer-motion";
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
import { useNavigate } from "react-router-dom";

const creator = {
  name: "Jasmine Luxe",
  handle: "jasmineluxe",
  creatorUserId: null as string | null, // Will be dynamic later
  avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&crop=face",
  cover: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1400&h=400&fit=crop&crop=top",
  bio: "Professional model & content creator 💋 Exclusive behind-the-scenes, glamour shoots, and premium content. Your favorite bad girl next door ✨",
  location: "Los Angeles, CA",
  joined: "Jan 2025",
  subscribers: "12.5K",
  likes: "89.2K",
  posts: 342,
  photos: 285,
  videos: 57,
  isVerified: true,
};

const defaultTiers = [
  {
    name: "Bronze",
    price_cents: 499,
    color: "from-amber-700 to-amber-900",
    features: ["Access to basic posts", "Like & comment", "Monthly newsletter"],
  },
  {
    name: "Silver",
    price_cents: 999,
    color: "from-gray-400 to-gray-600",
    features: ["Everything in Bronze", "Exclusive photo sets", "Behind-the-scenes content", "Priority DMs"],
    popular: true,
  },
  {
    name: "Gold",
    price_cents: 2499,
    color: "from-yellow-500 to-amber-600",
    features: ["Everything in Silver", "Custom content requests", "1-on-1 video calls", "Early access to new drops", "Exclusive merch discounts"],
  },
];

const contentGrid = [
  { id: 1, type: "photo", locked: false, img: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop", likes: 342 },
  { id: 2, type: "photo", locked: true, img: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=400&fit=crop", likes: 891 },
  { id: 3, type: "video", locked: true, img: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=400&fit=crop", likes: 1203 },
  { id: 4, type: "photo", locked: false, img: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop", likes: 567 },
  { id: 5, type: "photo", locked: true, img: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&h=400&fit=crop", likes: 2100 },
  { id: 6, type: "video", locked: true, img: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=400&fit=crop", likes: 1540 },
  { id: 7, type: "photo", locked: false, img: "https://images.unsplash.com/photo-1524250502761-1ac6f2e30d43?w=400&h=400&fit=crop", likes: 420 },
  { id: 8, type: "photo", locked: true, img: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&h=400&fit=crop", likes: 780 },
  { id: 9, type: "photo", locked: true, img: "https://images.unsplash.com/photo-1504703395950-b89145a5425b?w=400&h=400&fit=crop", likes: 956 },
];

const CreatorProfile = () => {
  const [activeTab, setActiveTab] = useState<"all" | "photos" | "videos">("all");
  const [subscribingTier, setSubscribingTier] = useState<string | null>(null);
  const [activeSubscription, setActiveSubscription] = useState<{ tier: string; subscriptionEnd: string } | null>(null);
  const [checkingSubscription, setCheckingSubscription] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const filtered = contentGrid.filter((c) =>
    activeTab === "all" ? true : activeTab === "photos" ? c.type === "photo" : c.type === "video"
  );

  // Check subscription status on load
  useEffect(() => {
    if (user && creator.creatorUserId) {
      checkSubscription();
    }
  }, [user]);

  const checkSubscription = async () => {
    if (!creator.creatorUserId) return;
    setCheckingSubscription(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-creator-subscription", {
        body: { creatorId: creator.creatorUserId },
      });
      if (!error && data?.subscribed) {
        setActiveSubscription({
          tier: data.tier,
          subscriptionEnd: data.subscription_end,
        });
      }
    } catch (err) {
      console.error("Error checking subscription:", err);
    } finally {
      setCheckingSubscription(false);
    }
  };

  const handleSubscribe = async (tierIndex: number) => {
    if (!user) {
      navigate("/auth");
      return;
    }

    const tier = defaultTiers[tierIndex];
    setSubscribingTier(tier.name);

    try {
      // For now, since tiers aren't in DB yet for this demo creator,
      // we'll show a toast. In production, this would call the edge function.
      if (!creator.creatorUserId) {
        toast({
          title: "Demo Mode",
          description: `Subscription to ${tier.name} tier ($${(tier.price_cents / 100).toFixed(2)}/mo) would be processed via Stripe in production.`,
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke("create-creator-checkout", {
        body: { tierId: tier.name }, // Would be actual tier ID from DB
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to start checkout",
        variant: "destructive",
      });
    } finally {
      setSubscribingTier(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Cover */}
      <div className="relative h-64 md:h-80 mt-16">
        <img src={creator.cover} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      </div>

      <div className="container mx-auto px-4 -mt-20 relative">
        {/* Profile Header */}
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-end mb-8">
          <div className="w-32 h-32 rounded-full border-4 border-background overflow-hidden ring-2 ring-primary/50 shrink-0">
            <img src={creator.avatar} alt={creator.name} className="w-full h-full object-cover" />
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl md:text-3xl font-black">{creator.name}</h1>
              {creator.isVerified && <Crown className="h-5 w-5 text-accent" />}
            </div>
            <p className="text-sm text-muted-foreground mb-2">@{creator.handle}</p>
            <p className="text-sm text-secondary-foreground max-w-lg">{creator.bio}</p>

            <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Joined {creator.joined}</span>
              <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {creator.subscribers} subscribers</span>
              <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {creator.likes} likes</span>
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

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-10 max-w-md">
          {[
            { icon: ImageIcon, value: creator.photos, label: "Photos" },
            { icon: Video, value: creator.videos, label: "Videos" },
            { icon: Eye, value: creator.posts, label: "Posts" },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label} className="text-center p-3 rounded-xl bg-gradient-card border border-border">
              <Icon className="h-4 w-4 mx-auto text-primary mb-1" />
              <div className="text-xl font-bold">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>

        {/* Subscription Tiers */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <h2 className="text-xl font-black mb-4 flex items-center gap-2">
            <Star className="h-5 w-5 text-accent" /> Subscription Tiers
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {defaultTiers.map((tier, index) => {
              const isCurrentTier = activeSubscription?.tier === tier.name;
              return (
                <div
                  key={tier.name}
                  className={`relative rounded-xl p-5 border transition-colors ${
                    isCurrentTier
                      ? "border-accent/60 glow-gold"
                      : tier.popular
                      ? "border-primary/50 glow-purple"
                      : "border-border"
                  } bg-gradient-card`}
                >
                  {isCurrentTier && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-accent text-accent-foreground rounded-full flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Your Plan
                    </span>
                  )}
                  {!isCurrentTier && tier.popular && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-primary text-primary-foreground rounded-full">
                      Most Popular
                    </span>
                  )}
                  <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r ${tier.color} text-primary-foreground mb-3`}>
                    {tier.name}
                  </div>
                  <div className="flex items-baseline gap-1 mb-3">
                    <span className="text-3xl font-black text-gradient-gold">${(tier.price_cents / 100).toFixed(2)}</span>
                    <span className="text-sm text-muted-foreground">/mo</span>
                  </div>
                  <ul className="space-y-2 mb-4">
                    {tier.features.map((f) => (
                      <li key={f} className="text-xs text-muted-foreground flex items-start gap-2">
                        <span className="text-primary mt-0.5">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    onClick={() => handleSubscribe(index)}
                    disabled={isCurrentTier || subscribingTier === tier.name}
                    className={`w-full font-bold text-sm ${
                      isCurrentTier
                        ? "bg-accent/20 text-accent cursor-default"
                        : tier.popular
                        ? "bg-gradient-purple text-primary-foreground hover:opacity-90"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {subscribingTier === tier.name ? (
                      <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Processing...</>
                    ) : isCurrentTier ? (
                      "Subscribed"
                    ) : (
                      "Subscribe"
                    )}
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
                    activeTab === tab
                      ? "bg-gradient-purple text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {filtered.map((item) => (
              <motion.div
                key={item.id}
                whileHover={{ scale: 1.02 }}
                className="relative aspect-square rounded-xl overflow-hidden cursor-pointer group"
              >
                <img
                  src={item.img}
                  alt=""
                  className={`w-full h-full object-cover ${item.locked ? "blur-lg scale-110" : ""} group-hover:scale-105 transition-transform duration-300`}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                {item.locked && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <Lock className="h-8 w-8 text-accent mb-2" />
                    <span className="text-xs font-bold text-accent">Subscribe to unlock</span>
                  </div>
                )}

                {item.type === "video" && !item.locked && (
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-primary/80 text-primary-foreground text-[10px] font-bold">
                    VIDEO
                  </div>
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
