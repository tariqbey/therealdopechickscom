import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Trash2, Save, Video, Image as ImageIcon, Lock, Unlock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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

interface PostEditModalProps {
  post: CreatorPost;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

const PostEditModal = ({ post, open, onClose, onRefresh }: PostEditModalProps) => {
  const { toast } = useToast();
  const [title, setTitle] = useState(post.title || "");
  const [description, setDescription] = useState(post.description || "");
  const [isLocked, setIsLocked] = useState(post.is_locked);
  const [minTier, setMinTier] = useState(post.min_tier || "Bronze");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("creator_posts")
      .update({
        title: title.trim() || null,
        description: description.trim() || null,
        is_locked: isLocked,
        min_tier: isLocked ? minTier : null,
      })
      .eq("id", post.id);

    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Post updated!" });
      onRefresh();
      onClose();
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase
      .from("creator_posts")
      .delete()
      .eq("id", post.id);

    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Post deleted" });
      onRefresh();
      onClose();
    }
    setDeleting(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {post.media_type === "video" ? <Video className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
            Manage Post
          </DialogTitle>
        </DialogHeader>

        {/* Preview */}
        <div className="rounded-xl overflow-hidden border border-border bg-muted aspect-video isolate relative z-0">
          {post.media_type === "video" ? (
            <video src={post.media_url} className="w-full h-full object-contain relative z-0" controls />
          ) : (
            <img src={post.media_url} alt={post.title || ""} className="w-full h-full object-contain" />
          )}
        </div>

        {/* Edit Fields */}
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Post title..."
              className="bg-muted border-border mt-1"
              maxLength={100}
            />
            <EmojiToolbar onSelect={(e) => setTitle((prev) => prev + e)} />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Description</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this about?"
              maxLength={500}
              className="w-full h-20 bg-muted border border-border rounded-lg p-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary mt-1"
            />
            <EmojiToolbar onSelect={(e) => setDescription((prev) => prev + e)} />
          </div>

          {/* Visibility */}
          <div className="rounded-lg border border-border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isLocked ? <Lock className="h-4 w-4 text-primary" /> : <Unlock className="h-4 w-4 text-muted-foreground" />}
                <Label className="text-sm font-medium">Subscribers only</Label>
              </div>
              <Switch checked={isLocked} onCheckedChange={setIsLocked} />
            </div>

            {isLocked && (
              <div>
                <Label className="text-xs text-muted-foreground">Minimum Tier</Label>
                <Select value={minTier} onValueChange={setMinTier}>
                  <SelectTrigger className="w-full h-9 text-sm mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bronze">Bronze+ (all subscribers)</SelectItem>
                    <SelectItem value="Silver">Silver+ (Silver & Gold)</SelectItem>
                    <SelectItem value="Gold">Gold only (top tier)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Meta */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>❤️ {post.likes_count} likes</span>
            <span>Posted {new Date(post.created_at).toLocaleDateString()}</span>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="w-full sm:w-auto" disabled={deleting}>
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Trash2 className="h-4 w-4 mr-1" /> Delete</>}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this post?</AlertDialogTitle>
                <AlertDialogDescription>This will permanently remove this content. This cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto bg-gradient-purple text-primary-foreground">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PostEditModal;
