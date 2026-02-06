import { motion } from "framer-motion";
import CreatorCard from "./CreatorCard";
import { Crown, TrendingUp, Sparkles } from "lucide-react";

const mockCreators = [
  {
    name: "Jasmine Luxe",
    handle: "jasmineluxe",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=face",
    coverImage: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500&h=300&fit=crop",
    subscribers: "12.5K",
    price: 50,
    isVerified: true,
    tag: "Chick of the Week",
  },
  {
    name: "Melody Rain",
    handle: "melodyrain",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face",
    coverImage: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500&h=300&fit=crop",
    subscribers: "8.2K",
    price: 35,
    isVerified: true,
  },
  {
    name: "Nova Starr",
    handle: "novastarr",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=200&fit=crop&crop=face",
    coverImage: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=500&h=300&fit=crop",
    subscribers: "15.1K",
    price: 75,
    isVerified: true,
    tag: "Chick of the Month",
  },
  {
    name: "Diamond Rose",
    handle: "diamondrose",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face",
    coverImage: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=500&h=300&fit=crop",
    subscribers: "6.7K",
    price: 40,
    isVerified: false,
  },
  {
    name: "Sasha Vex",
    handle: "sashavex",
    avatar: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&h=200&fit=crop&crop=face",
    coverImage: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=500&h=300&fit=crop",
    subscribers: "9.8K",
    price: 60,
    isVerified: true,
  },
  {
    name: "Luna Blaze",
    handle: "lunablaze",
    avatar: "https://images.unsplash.com/photo-1524250502761-1ac6f2e30d43?w=200&h=200&fit=crop&crop=face",
    coverImage: "https://images.unsplash.com/photo-1504703395950-b89145a5425b?w=500&h=300&fit=crop",
    subscribers: "4.3K",
    price: 25,
    isVerified: false,
    tag: "New",
  },
];

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

const FeaturedCreators = () => {
  return (
    <section id="creators" className="py-20">
      <div className="container mx-auto px-4">
        {/* Spotlight */}
        <SectionHeader icon={Crown} title="Featured Creators" subtitle="The Dopest" />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
          {mockCreators.slice(0, 3).map((creator, i) => (
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

        {/* Trending */}
        <SectionHeader icon={TrendingUp} title="Trending Now" subtitle="Hot & Rising" />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
          {mockCreators.slice(3).map((creator, i) => (
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
