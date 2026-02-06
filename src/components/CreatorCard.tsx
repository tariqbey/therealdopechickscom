import { motion } from "framer-motion";
import { Heart, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface CreatorCardProps {
  name: string;
  handle: string;
  avatar: string;
  coverImage: string;
  subscribers: string;
  price: number;
  isVerified?: boolean;
  tag?: string;
}

const CreatorCard = ({
  name,
  handle,
  avatar,
  coverImage,
  subscribers,
  price,
  isVerified,
  tag,
}: CreatorCardProps) => {
  return (
    <Link to={`/creator/${handle}`}>
      <motion.div
        whileHover={{ y: -4, scale: 1.02 }}
        transition={{ duration: 0.2 }}
        className="group relative rounded-xl overflow-hidden bg-gradient-card border border-border hover:border-primary/30 transition-colors cursor-pointer"
      >
        <div className="relative h-44 overflow-hidden">
          <img
            src={coverImage}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
          {tag && (
            <span className="absolute top-3 left-3 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-primary/90 text-primary-foreground">
              {tag}
            </span>
          )}
          <button className="absolute top-3 right-3 p-1.5 rounded-full glass text-foreground/70 hover:text-destructive transition-colors">
            <Heart className="h-4 w-4" />
          </button>
        </div>

        <div className="relative px-4 -mt-8">
          <div className="w-16 h-16 rounded-full border-2 border-card overflow-hidden ring-2 ring-primary/40">
            <img src={avatar} alt={name} className="w-full h-full object-cover" />
          </div>
        </div>

        <div className="px-4 pt-2 pb-4">
          <div className="flex items-center gap-1.5">
            <h3 className="font-bold text-foreground">{name}</h3>
            {isVerified && <span className="text-accent text-xs">✓</span>}
          </div>
          <p className="text-xs text-muted-foreground">@{handle}</p>
          <p className="text-xs text-muted-foreground mt-1">{subscribers} subscribers</p>

          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-1">
              <Lock className="h-3 w-3 text-accent" />
              <span className="text-xs font-semibold text-accent">{price} BREAD/mo</span>
            </div>
            <Button
              size="sm"
              className="h-7 text-xs bg-gradient-purple text-primary-foreground font-semibold hover:opacity-90"
            >
              Subscribe
            </Button>
          </div>
        </div>
      </motion.div>
    </Link>
  );
};

export default CreatorCard;
