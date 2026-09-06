import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const cache = new Map<string, { url: string; exp: number }>();

/** Plays a video message stored in the private `message-media` bucket via a signed URL. */
const VideoMessageBubble = ({ path }: { path: string }) => {
  const [url, setUrl] = useState<string | null>(() => {
    const c = cache.get(path);
    return c && c.exp > Date.now() ? c.url : null;
  });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (url) return;
    let alive = true;
    supabase.storage
      .from("message-media")
      .createSignedUrl(path, 3600)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error || !data?.signedUrl) { setFailed(true); return; }
        cache.set(path, { url: data.signedUrl, exp: Date.now() + 55 * 60 * 1000 });
        setUrl(data.signedUrl);
      });
    return () => { alive = false; };
  }, [path, url]);

  if (failed) return <span className="text-xs opacity-70">Video unavailable</span>;
  if (!url) return <div className="w-48 h-32 flex items-center justify-center"><Loader2 className="h-4 w-4 animate-spin opacity-70" /></div>;
  return (
    <video
      src={url}
      controls
      playsInline
      preload="metadata"
      className="w-56 sm:w-64 max-h-80 rounded-xl bg-black"
    />
  );
};

export default VideoMessageBubble;
