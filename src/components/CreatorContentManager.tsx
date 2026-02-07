import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, X, Loader2, Image as ImageIcon, Video, Library } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import LibraryPicker from "@/components/LibraryPicker";
import PostEditModal from "@/components/PostEditModal";
import EmojiToolbar from "@/components/EmojiToolbar";

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

interface ContentManagerProps {
  posts: CreatorPost[];
  onRefresh: () => void;
}

const CreatorContentManager = ({ posts, onRefresh }: ContentManagerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isLocked, setIsLocked] = useState(true);
  const [minTier, setMinTier] = useState("Bronze");
  const [showLibrary, setShowLibrary] = useState(false);
  const [editingPost, setEditingPost] = useState<CreatorPost | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 50MB", variant: "destructive" });
      return;
    }

    const isVideo = file.type.startsWith("video/");
    const mediaType = isVideo ? "video" : "photo";

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("creator-content")
      .upload(path, file, { upsert: false });

    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from("creator-content").getPublicUrl(path);

    const { error: insertError } = await supabase
      .from("creator_posts" as any)
      .insert({
        creator_id: user.id,
        title: title.trim() || null,
        description: description.trim() || null,
        media_url: publicUrl,
        media_type: mediaType,
        is_locked: isLocked,
        min_tier: isLocked ? minTier : null,
      } as any);

    if (insertError) {
      toast({ title: "Post failed", description: insertError.message, variant: "destructive" });
    } else {
      toast({ title: "Content posted!" });
      setTitle("");
      setDescription("");
      onRefresh();
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-6">
      {/* Upload New Content */}
      <div className="rounded-xl bg-gradient-card border border-border p-5 space-y-4">
        <h3 className="text-sm font-bold text-foreground">Upload New Content</h3>

        <div>
          <Label className="text-xs text-muted-foreground">Title (optional)</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Post title..." className="bg-muted border-border mt-1" maxLength={100} />
          <EmojiToolbar onSelect={(e) => setTitle((prev) => prev + e)} />
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Description (optional)</Label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this about?"
            maxLength={500}
            className="w-full h-16 bg-muted border border-border rounded-lg p-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary mt-1"
          />
          <EmojiToolbar onSelect={(e) => setDescription((prev) => prev + e)} />
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Switch checked={isLocked} onCheckedChange={setIsLocked} />
            <Label className="text-xs text-muted-foreground">Subscribers only</Label>
          </div>
          {isLocked && (
            <Select value={minTier} onValueChange={setMinTier}>
              <SelectTrigger className="w-28 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Bronze">Bronze+</SelectItem>
                <SelectItem value="Silver">Silver+</SelectItem>
                <SelectItem value="Gold">Gold only</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full bg-gradient-purple text-primary-foreground font-bold hover:opacity-90"
        >
          {uploading ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading...</>
          ) : (
            <><Upload className="h-4 w-4 mr-2" /> Choose Photo or Video</>
          )}
        </Button>
        <Button
          variant="outline"
          onClick={() => setShowLibrary(true)}
          className="w-full border-dashed text-xs"
        >
          <Library className="h-4 w-4 mr-2" /> Import from AI Library
        </Button>
        <p className="text-xs text-muted-foreground text-center">JPG, PNG, MP4, MOV. Max 50MB.</p>
        <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleUpload} />
      </div>

      {/* Library Picker */}
      {showLibrary && (
        <LibraryPicker
          onClose={() => setShowLibrary(false)}
          onSelect={async (items) => {
            setShowLibrary(false);
            if (!user) return;
            let added = 0;
            for (const item of items) {
              const { error } = await supabase
                .from("creator_posts" as any)
                .insert({
                  creator_id: user.id,
                  title: title.trim() || null,
                  description: description.trim() || null,
                  media_url: item.url,
                  media_type: item.type,
                  is_locked: isLocked,
                  min_tier: isLocked ? minTier : null,
                } as any);
              if (!error) added++;
            }
            if (added > 0) {
              toast({ title: `${added} item${added > 1 ? "s" : ""} added to profile!` });
              onRefresh();
            }
          }}
        />
      )}

      {/* Existing Posts */}
      {posts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-foreground">Your Content ({posts.length})</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {posts.map((post) => (
              <div
                key={post.id}
                className="relative group rounded-xl overflow-hidden border border-border bg-muted aspect-square cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                onClick={() => setEditingPost(post)}
              >
                {post.media_type === "video" ? (
                  <video src={post.media_url} className="w-full h-full object-cover" muted />
                ) : (
                  <img src={post.media_url} alt={post.title || ""} className="w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                  <div className="flex items-center gap-1 text-xs">
                    {post.media_type === "video" ? <Video className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                    <span>{post.is_locked ? `🔒 ${post.min_tier}+` : "Public"}</span>
                  </div>
                  {post.title && <span className="text-xs font-medium text-center px-2 truncate w-full">{post.title}</span>}
                  <span className="text-[10px] text-muted-foreground mt-1">Tap to edit</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Post Edit Modal */}
      {editingPost && (
        <PostEditModal
          post={editingPost}
          open={!!editingPost}
          onClose={() => setEditingPost(null)}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
};

export default CreatorContentManager;
