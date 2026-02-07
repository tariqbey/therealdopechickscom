import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import CreatorCard from "./CreatorCard";
import { Crown, TrendingUp, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const mockCreators = [
  {
    name: "Jasmine Luxe",
    handle: "jasmineluxe",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=face",
    coverImage: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&h=350&fit=crop",
    subscribers: "12.5K",
    price: 50,
    isVerified: true,
    tag: "Chick of the Week",
  },
  {
    name: "Melody Rain",
    handle: "melodyrain",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face",
    coverImage: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&h=350&fit=crop",
    subscribers: "8.2K",
    price: 35,
    isVerified: true,
  },
  {
    name: "Nova Starr",
    handle: "novastarr",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=200&fit=crop&crop=face",
    coverImage: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&h=350&fit=crop",
    subscribers: "15.1K",
    price: 75,
    isVerified: true,
    tag: "Chick of the Month",
  },
  {
    name: "Diamond Rose",
    handle: "diamondrose",
    avatar: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&h=200&fit=crop&crop=face",
    coverImage: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&h=350&fit=crop",
    subscribers: "6.7K",
    price: 40,
    isVerified: false,
  },
  {
    name: "Sasha Vex",
    handle: "sashavex",
    avatar: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&h=200&fit=crop&crop=face",
    coverImage: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&h=350&fit=crop",
    subscribers: "9.8K",
    price: 60,
    isVerified: true,
  },
  {
    name: "Luna Blaze",
    handle: "lunablaze",
    avatar: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=200&h=200&fit=crop&crop=face",
    coverImage: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=600&h=350&fit=crop",
    subscribers: "4.3K",
    price: 25,
    isVerified: false,
    tag: "New",
  },
];

interface RealCreator {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  cover_url: string | null;
}

const SectionHeader = ({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    className="mb-8"
  >
    <div className="flex items-center gap-2 mb-2">
      <Icon className="h-5 w-5 text-accent" />
      <span className="text-xs font-bold uppercase tracking-widest text-accent">{subtitle}</span>
    </div>
    <h2 className="text-3xl md:text-4xl font-black">{title}</h2>
  </motion.div>
);

const toCard = (c: RealCreator) => ({
  name: c.display_name || "Creator",
  handle: (c.display_name || "creator").toLowerCase().replace(/\s+/g, ""),
  avatar: c.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=face",
  coverImage: c.cover_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&h=350&fit=crop",
  subscribers: "—",
  price: 0,
  isVerified: true,
});

const FeaturedCreators = () => {
  const [showDummy, setShowDummy] = useState(true);
  const [featuredCreators, setFeaturedCreators] = useState<RealCreator[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [dummyRes, featuredRes, creatorsRes] = await Promise.all([
        supabase
          .from("platform_settings")
          .select("*")
          .eq("key", "show_dummy_content")
          .maybeSingle(),
        supabase
          .from("platform_settings")
          .select("*")
          .eq("key", "featured_creators")
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("user_id, display_name, avatar_url, cover_url")
          .eq("is_creator", true),
      ]);

      if (dummyRes.data) {
        setShowDummy((dummyRes.data as any).value?.enabled ?? true);
      }

      const allCreators = (creatorsRes.data as RealCreator[]) || [];
      const featuredIds: string[] = (featuredRes.data as any)?.value?.user_ids || [];

      // Build featured list in order
      const ordered = featuredIds
        .map((id) => allCreators.find((c) => c.user_id === id))
        .filter(Boolean) as RealCreator[];

      setFeaturedCreators(ordered);
      setLoading(false);
    };
    load();
  }, []);

  const featuredCards = featuredCreators.map(toCard);

  // If dummy on and no featured picked, show mock; otherwise show real featured
  const displayFeatured = featuredCards.length > 0
    ? featuredCards
    : showDummy
      ? mockCreators.slice(0, 3).map((m) => ({ ...m }))
      : [];

  const trending = showDummy && featuredCards.length === 0 ? mockCreators.slice(3) : [];

  if (loading) return null;

  return (
    <section id="creators" className="py-20">
      <div className="container mx-auto px-4">
        {/* Spotlight */}
        <SectionHeader icon={Crown} title="Featured Creators" subtitle="The Dopest" />

        {displayFeatured.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
            {displayFeatured.map((creator, i) => (
              <motion.div
                key={creator.handle + i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <CreatorCard {...creator} />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground mb-20">
            <Crown className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">No creators yet</p>
          </div>
        )}

        {/* Trending - only when dummy is on and no real featured */}
        {trending.length > 0 && (
          <>
            <SectionHeader icon={TrendingUp} title="Trending Now" subtitle="Hot & Rising" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
              {trending.map((creator, i) => (
                <motion.div
                  key={creator.handle}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                >
                  <CreatorCard {...creator} />
                </motion.div>
              ))}
            </div>
          </>
        )}

        {/* Categories */}
        <SectionHeader icon={Sparkles} title="Browse Categories" subtitle="Explore" />

        <div className="flex flex-wrap gap-3">
          {["All", "Glamour", "Fitness", "Cosplay", "Fantasy", "Artistic", "Lifestyle", "AI Generated", "Exclusive"].map(
            (cat) => (
              <motion.button
                key={cat}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`px-5 py-2 rounded-full text-sm font-medium border transition-colors ${
                  cat === "All"
                    ? "bg-gradient-purple text-primary-foreground border-transparent"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
                }`}
              >
                {cat}
              </motion.button>
            )
          )}
        </div>
      </div>
    </section>
  );
};

export default FeaturedCreators;
