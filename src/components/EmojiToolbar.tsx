import { useState } from "react";
import { Smile } from "lucide-react";

const EMOJIS = [
  "😍", "🔥", "💋", "❤️", "💦", "✨", "🌹", "💎", "👑", "🎀",
  "💜", "🖤", "💕", "😘", "🥵", "🍑", "🫦", "💫", "⭐", "🌶️",
];

interface EmojiToolbarProps {
  onSelect: (emoji: string) => void;
}

const EmojiToolbar = ({ onSelect }: EmojiToolbarProps) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative z-10 mt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
      >
        <Smile className="h-3.5 w-3.5" />
        {open ? "Hide emojis" : "Add emoji"}
      </button>
      {open && (
        <div className="flex flex-wrap gap-1 mt-1">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => onSelect(e)}
              className="text-base hover:scale-125 transition-transform p-0.5 rounded hover:bg-muted"
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmojiToolbar;
