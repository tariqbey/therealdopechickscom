import { useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Upload, Loader2, Headset, Trash2, Eye, EyeOff, ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface VRVideo {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  video_path: string | null;
  thumbnail_url: string | null;
  price_bread: number;
  is_published: boolean;
  unlocks_count: number;
  created_at: string;
}

const MAX_VIDEO_MB = 3584; // 3.5 GB — videos go to Vercel Blob, not Supabase

const VRVideoManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  const [videos, setVideos] = useState<VRVideo[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceBread, setPriceBread] = useState("25");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [deleting, setDeleting] = useState<VRVideo | null>(null);

  const loadVideos = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("vr_videos" as any)
      .select("*")
      .eq("creator_id", user.id)
      .order("created_at", { ascending: false });
    setVideos((data as unknown as VRVideo[]) || []);
  };

  useEffect(() => { loadVideos(); }, [user?.id]);

  const handlePublish = async () => {
    if (!user) return;
    if (!videoFile) {
      toast({ title: "Pick a VR video file", description: "Side-by-side VR180 MP4.", variant: "destructive" });
      return;
    }
    if (!title.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    const price = Math.max(0, parseInt(priceBread, 10) || 0);

    setUploading(true);
    setUploadPct(2);
    try {
      // Need the Supabase session token so the upload API can verify the creator
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Session expired — sign in again");

      // 1. Upload the (large) VR video straight to Vercel Blob, multipart.
      const ext = videoFile.name.split(".").pop() || "mp4";
      const blob = await upload(`vr/${user.id}/${Date.now()}.${ext}`, videoFile, {
        access: "public",
        handleUploadUrl: "/api/vr-upload",
        clientPayload: session.access_token,
        multipart: true,
        onUploadProgress: (p) => setUploadPct(Math.round(p.percentage * 0.85)),
      });
      setUploadPct(88);

      // 2. Thumbnail stays in Supabase (small, public)
      let thumbnailUrl: string | null = null;
      if (thumbFile) {
        const thumbExt = thumbFile.name.split(".").pop() || "jpg";
        const thumbPath = `${user.id}/${Date.now()}.${thumbExt}`;
        const { error: thumbErr } = await supabase.storage
          .from("vr-thumbnails")
          .upload(thumbPath, thumbFile, { upsert: false });
        if (thumbErr) throw thumbErr;
        thumbnailUrl = supabase.storage.from("vr-thumbnails").getPublicUrl(thumbPath).data.publicUrl;
      }
      setUploadPct(94);

      // 3. Create the metadata row, then store the Blob URL in the locked
      //    sources table (only readable via the paywalled get_vr_video_url RPC).
      const { data: inserted, error: insertErr } = await supabase
        .from("vr_videos" as any)
        .insert({
          creator_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          video_path: null,
          thumbnail_url: thumbnailUrl,
          price_bread: price,
          is_published: true,
        } as any)
        .select("id")
        .single();
      if (insertErr) throw insertErr;

      const { error: srcErr } = await supabase
        .from("vr_video_sources" as any)
        .insert({ video_id: (inserted as any).id, blob_url: blob.url } as any);
      if (srcErr) throw srcErr;

      toast({ title: "VR video published! 🥽", description: price > 0 ? `Fans unlock it for ${price} BREAD.` : "Free for all fans." });
      setTitle("");
      setDescription("");
      setPriceBread("25");
      setVideoFile(null);
      setThumbFile(null);
      if (videoInputRef.current) videoInputRef.current.value = "";
      if (thumbInputRef.current) thumbInputRef.current.value = "";
      loadVideos();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      setUploadPct(0);
    }
  };

  const togglePublished = async (v: VRVideo) => {
    const { error } = await supabase
      .from("vr_videos" as any)
      .update({ is_published: !v.is_published } as any)
      .eq("id", v.id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: v.is_published ? "Hidden from fans" : "Published!" });
      loadVideos();
    }
  };

  const updatePrice = async (v: VRVideo, newPrice: number) => {
    const { error } = await supabase
      .from("vr_videos" as any)
      .update({ price_bread: Math.max(0, newPrice) } as any)
      .eq("id", v.id);
    if (!error) loadVideos();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    // Row delete cascades to vr_video_sources. The Blob file is cleaned up
    // server-side via the /api/vr-delete route.
    fetch("/api/vr-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId: deleting.id, token: (await supabase.auth.getSession()).data.session?.access_token }),
    }).catch(() => {});
    const { error } = await supabase.from("vr_videos" as any).delete().eq("id", deleting.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "VR video deleted" });
      loadVideos();
    }
    setDeleting(null);
  };

  return (
    <div className="space-y-6">
      {/* Upload form */}
      <div className="rounded-xl bg-gradient-card border border-border p-5 space-y-4">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Headset className="h-4 w-4 text-primary" /> Upload VR180 Video
        </h3>
        <p className="text-xs text-muted-foreground">
          Side-by-side stereo VR180 MP4 (H.264 recommended, max 3.5GB).
          Fans watch it in a real VR headset right from your profile.
        </p>

        <div>
          <Label className="text-xs text-muted-foreground">Title</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="VR video title..."
            className="bg-muted border-border mt-1"
            maxLength={100}
          />
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Description (optional)</Label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tease what they'll experience..."
            maxLength={500}
            className="w-full h-16 bg-muted border border-border rounded-lg p-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary mt-1"
          />
        </div>

        <div className="flex items-end gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Price (BREAD) — 0 = free</Label>
            <Input
              type="number"
              min={0}
              value={priceBread}
              onChange={(e) => setPriceBread(e.target.value)}
              className="bg-muted border-border mt-1 w-32"
            />
          </div>
          <p className="text-[11px] text-muted-foreground pb-2.5">You earn 80% of every unlock 🍞</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            onClick={() => videoInputRef.current?.click()}
            disabled={uploading}
            className={`text-xs h-auto py-3 flex-col gap-1 ${videoFile ? "border-primary/60" : "border-dashed"}`}
          >
            <Headset className="h-4 w-4" />
            {videoFile ? <span className="truncate max-w-full px-1">{videoFile.name}</span> : "Choose VR Video"}
          </Button>
          <Button
            variant="outline"
            onClick={() => thumbInputRef.current?.click()}
            disabled={uploading}
            className={`text-xs h-auto py-3 flex-col gap-1 ${thumbFile ? "border-primary/60" : "border-dashed"}`}
          >
            <ImageIcon className="h-4 w-4" />
            {thumbFile ? <span className="truncate max-w-full px-1">{thumbFile.name}</span> : "Choose Thumbnail"}
          </Button>
        </div>
        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/quicktime"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f && f.size > MAX_VIDEO_MB * 1024 * 1024) {
              toast({ title: "File too large", description: `Max 3.5GB. Re-encode at a lower bitrate (~25 Mbps is ideal for streaming).`, variant: "destructive" });
              e.target.value = "";
              return;
            }
            setVideoFile(f || null);
          }}
        />
        <input
          ref={thumbInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => setThumbFile(e.target.files?.[0] || null)}
        />

        <Button
          onClick={handlePublish}
          disabled={uploading || !videoFile}
          className="w-full bg-gradient-purple text-primary-foreground font-bold hover:opacity-90"
        >
          {uploading ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading… {uploadPct}%</>
          ) : (
            <><Upload className="h-4 w-4 mr-2" /> Publish VR Video</>
          )}
        </Button>
      </div>

      {/* Existing VR videos */}
      {videos.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-foreground">Your VR Videos ({videos.length})</h3>
          <div className="space-y-2">
            {videos.map((v) => (
              <div key={v.id} className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
                <div className="w-20 h-12 rounded-lg overflow-hidden bg-muted shrink-0">
                  {v.thumbnail_url ? (
                    <img src={v.thumbnail_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Headset className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{v.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {v.unlocks_count} unlock{v.unlocks_count === 1 ? "" : "s"} · {v.is_published ? "Live" : "Hidden"}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Input
                    type="number"
                    min={0}
                    defaultValue={v.price_bread}
                    onBlur={(e) => {
                      const p = parseInt(e.target.value, 10) || 0;
                      if (p !== v.price_bread) updatePrice(v, p);
                    }}
                    className="w-20 h-8 text-xs bg-muted border-border"
                    title="Price in BREAD"
                  />
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => togglePublished(v)} title={v.is_published ? "Hide" : "Publish"}>
                    {v.is_published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeleting(v)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete VR video?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleting?.title}" will be permanently removed. Fans who unlocked it will lose access. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default VRVideoManager;
