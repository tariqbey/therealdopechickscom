import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Headset, Loader2, Lock } from "lucide-react";
import VR180WebXRPlayer from "@/components/VR180WebXRPlayer";
import type { VRVideo } from "@/components/VRVideoManager";

const VRVideoPage = () => {
  const { videoId } = useParams<{ videoId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [video, setVideo] = useState<VRVideo | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [creatorName, setCreatorName] = useState<string>("");
  const [state, setState] = useState<"loading" | "ready" | "locked" | "notfound">("loading");

  useEffect(() => {
    if (authLoading || !videoId) return;

    const load = async () => {
      const { data } = await supabase
        .from("vr_videos" as any)
        .select("*")
        .eq("id", videoId)
        .maybeSingle();
      const v = data as unknown as VRVideo | null;
      if (!v) { setState("notfound"); return; }
      setVideo(v);

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", v.creator_id)
        .maybeSingle();
      setCreatorName(profile?.display_name || "Creator");

      // The paywall gate: get_vr_video_url returns the Blob URL only for the
      // owner, admins, free videos, or fans who unlocked it — NULL otherwise.
      const { data: url, error } = await supabase.rpc("get_vr_video_url" as any, {
        p_video_id: v.id,
      } as any);

      if (error || !url) {
        setState("locked");
        return;
      }
      setSignedUrl(url as string);
      setState("ready");
    };
    load();
  }, [videoId, user?.id, authLoading]);

  const backToCreator = () => {
    if (video) {
      navigate(`/creator/${video.creator_id}`);
    } else {
      navigate(-1);
    }
  };

  if (state === "loading" || authLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (state === "notfound") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Headset className="h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground">This VR video doesn't exist or was removed.</p>
        <Button onClick={() => navigate("/")}>Back home</Button>
      </div>
    );
  }

  if (state === "locked") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4 text-center">
        <Lock className="h-10 w-10 text-accent" />
        <h1 className="text-xl font-black">{video?.title}</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          This VR experience is locked. Unlock it for {video?.price_bread} BREAD on {creatorName}'s profile.
        </p>
        <Button onClick={backToCreator} className="bg-gradient-purple text-primary-foreground font-bold">
          Go to {creatorName}'s profile
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black">
      {signedUrl && <VR180WebXRPlayer src={signedUrl} poster={video?.thumbnail_url || undefined} />}

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-3 p-4 bg-gradient-to-b from-background/80 to-transparent">
        <Button size="icon" variant="ghost" className="rounded-full" onClick={backToCreator}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-sm font-bold truncate flex items-center gap-2">
            <Headset className="h-4 w-4 text-primary shrink-0" /> {video?.title}
          </h1>
          <p className="text-[11px] text-muted-foreground truncate">{creatorName} · VR180</p>
        </div>
      </div>
    </div>
  );
};

export default VRVideoPage;
