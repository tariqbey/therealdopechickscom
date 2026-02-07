const EMOJIS = [
  "😍", "🔥", "💋", "❤️", "💦", "✨", "🌹", "💎", "👑", "🎀",
  "💜", "🖤", "💕", "😘", "🥵", "🍑", "🫦", "💫", "⭐", "🌶️",
];

interface EmojiToolbarProps {
  onSelect: (emoji: string) => void;
}

const EmojiToolbar = ({ onSelect }: EmojiToolbarProps) => (
  <div className="flex flex-wrap gap-1 mt-1 relative z-10">
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
);

export default EmojiToolbar;
