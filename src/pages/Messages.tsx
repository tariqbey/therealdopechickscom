import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Send, ArrowLeft, Loader2, Sparkles, MessageCircle, Video, Camera, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import VideoMessageRecorder from "@/components/VideoMessageRecorder";
import VideoMessageBubble from "@/components/VideoMessageBubble";
import VideoCallRequestDialog from "@/components/VideoCallRequestDialog";
import { fetchCallProfile, type CallProfile } from "@/lib/videoCalls";

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_ai_reply: boolean;
  read: boolean;
  created_at: string;
  media_url?: string | null;
  media_type?: string | null;
  call_id?: string | null;
}

interface ConversationPreview {
  conversation_id: string;
  other_user_id: string;
  other_name: string;
  other_avatar: string | null;
  last_message: string;
  last_time: string;
  unread: number;
}

const Messages = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialCreatorId = searchParams.get("to");

  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [otherUser, setOtherUser] = useState<{ name: string; avatar: string | null; id: string } | null>(null);
  const [otherProfile, setOtherProfile] = useState<CallProfile | null>(null);
  const [recorderOpen, setRecorderOpen] = useState(false);
  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Full profile of the other party (creator call/video-message settings)
  useEffect(() => {
    if (!otherUser?.id) { setOtherProfile(null); return; }
    let alive = true;
    fetchCallProfile(otherUser.id).then((p) => { if (alive) setOtherProfile(p); });
    return () => { alive = false; };
  }, [otherUser?.id]);

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    loadConversations();
  }, [user]);

  useEffect(() => {
    if (initialCreatorId && user) {
      const convId = [user.id, initialCreatorId].sort().join("_");
      setActiveConversation(convId);
      loadMessages(convId);
      loadOtherUser(initialCreatorId);
    }
  }, [initialCreatorId, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Realtime subscription
  useEffect(() => {
    if (!activeConversation) return;
    const channel = supabase
      .channel(`messages-${activeConversation}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${activeConversation}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeConversation]);

  const loadConversations = async () => {
    if (!user) return;
    setLoadingConvos(true);
    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (!data) { setLoadingConvos(false); return; }

    const convMap = new Map<string, Message[]>();
    data.forEach((m: any) => {
      const msgs = convMap.get(m.conversation_id) || [];
      msgs.push(m);
      convMap.set(m.conversation_id, msgs);
    });

    const previews: ConversationPreview[] = [];
    for (const [convId, msgs] of convMap) {
      const last = msgs[0];
      const otherId = last.sender_id === user.id ? last.receiver_id : last.sender_id;
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("user_id", otherId)
        .maybeSingle();
      previews.push({
        conversation_id: convId,
        other_user_id: otherId,
        other_name: profile?.display_name || "User",
        other_avatar: profile?.avatar_url || null,
        last_message: last.content,
        last_time: last.created_at,
        unread: msgs.filter((m) => m.receiver_id === user.id && !m.read).length,
      });
    }
    setConversations(previews);
    setLoadingConvos(false);
  };

  const loadOtherUser = async (otherId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("display_name, avatar_url, user_id")
      .eq("user_id", otherId)
      .maybeSingle();
    if (data) setOtherUser({ name: data.display_name || "User", avatar: data.avatar_url, id: data.user_id });
  };

  const loadMessages = async (convId: string) => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });
    setMessages((data as Message[]) || []);

    // Mark as read
    if (user) {
      await supabase
        .from("messages")
        .update({ read: true })
        .eq("conversation_id", convId)
        .eq("receiver_id", user.id)
        .eq("read", false);
    }
  };

  const openConversation = (conv: ConversationPreview) => {
    setActiveConversation(conv.conversation_id);
    setOtherUser({ name: conv.other_name, avatar: conv.other_avatar, id: conv.other_user_id });
    loadMessages(conv.conversation_id);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !activeConversation || !otherUser) return;
    setSending(true);
    const content = newMessage.trim();
    setNewMessage("");

    // Insert message
    await supabase.from("messages").insert({
      conversation_id: activeConversation,
      sender_id: user.id,
      receiver_id: otherUser.id,
      content,
    });

    // Trigger AI auto-reply
    supabase.functions.invoke("ai-auto-reply", {
      body: { message: content, creatorId: otherUser.id, conversationId: activeConversation },
    }).catch(() => {}); // Fire and forget

    setSending(false);
  };

  const sendVideoMessage = async (blob: Blob, mimeType: string, durationSeconds: number) => {
    if (!user || !activeConversation || !otherUser) return;
    const ext = mimeType.includes("mp4") ? "mp4" : "webm";
    const path = `${activeConversation}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("message-media")
      .upload(path, blob, { contentType: mimeType.split(";")[0], upsert: false });
    if (upErr) {
      toast({ title: "Upload failed", description: upErr.message, variant: "destructive" });
      throw upErr;
    }
    const { error } = await supabase.from("messages").insert({
      conversation_id: activeConversation,
      sender_id: user.id,
      receiver_id: otherUser.id,
      content: `🎥 Video message (${durationSeconds}s)`,
      media_url: path,
      media_type: "video",
    });
    if (error) {
      toast({ title: "Couldn't send", description: error.message, variant: "destructive" });
      throw error;
    }
  };

  const otherIsCreator = !!otherProfile?.is_creator;
  const canRequestCall = otherIsCreator && !!otherProfile?.video_calls_enabled && otherProfile?.user_id !== user?.id;
  // Creators can always send video messages; fans can when the creator allows it (default on).
  const canSendVideo = !otherIsCreator || otherProfile?.video_messages_enabled !== false;

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-4 max-w-4xl">
        <div className="rounded-xl bg-gradient-card border border-border overflow-hidden" style={{ height: "calc(100vh - 120px)" }}>
          <div className="flex h-full">
            {/* Conversation List */}
            <div className={`w-full md:w-80 border-r border-border flex flex-col ${activeConversation ? "hidden md:flex" : ""}`}>
              <div className="p-4 border-b border-border">
                <h2 className="text-lg font-black flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-primary" /> Messages
                </h2>
              </div>
              <div className="flex-1 overflow-y-auto">
                {loadingConvos ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : conversations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">No conversations yet</div>
                ) : (
                  conversations.map((conv) => (
                    <button
                      key={conv.conversation_id}
                      onClick={() => openConversation(conv)}
                      className={`w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors text-left ${
                        activeConversation === conv.conversation_id ? "bg-muted/50" : ""
                      }`}
                    >
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground shrink-0">
                        {conv.other_avatar ? (
                          <img src={conv.other_avatar} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : conv.other_name[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-sm truncate">{conv.other_name}</span>
                          {conv.unread > 0 && (
                            <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">{conv.unread}</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{conv.last_message}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Chat Area */}
            <div className={`flex-1 flex flex-col ${!activeConversation ? "hidden md:flex" : ""}`}>
              {activeConversation && otherUser ? (
                <>
                  <div className="p-4 border-b border-border flex items-center gap-3">
                    <button onClick={() => setActiveConversation(null)} className="md:hidden text-muted-foreground">
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                      {otherUser.avatar ? (
                        <img src={otherUser.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : otherUser.name[0].toUpperCase()}
                    </div>
                    <span className="font-medium text-sm">{otherUser.name}</span>
                    {canRequestCall && otherProfile && (
                      <Button
                        size="sm"
                        onClick={() => setCallDialogOpen(true)}
                        className="ml-auto rounded-full bg-gradient-purple text-primary-foreground font-bold h-8 px-3 text-xs"
                        title="Start a paid video call"
                      >
                        <Video className="h-3.5 w-3.5 mr-1.5" />
                        Video call
                        {(otherProfile.video_call_price_bread ?? 0) > 0 && (
                          <span className="ml-1.5 opacity-80">· {otherProfile.video_call_price_bread} BREAD</span>
                        )}
                      </Button>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {messages.map((msg) => {
                      const isMine = msg.sender_id === user.id;
                      if (msg.media_type === "call") {
                        return (
                          <div key={msg.id} className="flex justify-center">
                            <button
                              onClick={() => msg.call_id && navigate(`/call/${msg.call_id}`)}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/60 border border-border text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Phone className="h-3 w-3" /> {msg.content.replace(/^📞\s*/, "")}
                            </button>
                          </div>
                        );
                      }
                      return (
                        <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[75%] rounded-2xl text-sm ${msg.media_type === "video" ? "p-1" : "px-3 py-2"} ${
                            isMine
                              ? "bg-primary text-primary-foreground rounded-br-md"
                              : "bg-muted text-foreground rounded-bl-md"
                          }`}>
                            {msg.media_type === "video" && msg.media_url ? (
                              <VideoMessageBubble path={msg.media_url} />
                            ) : msg.content}
                            {msg.is_ai_reply && (
                              <span className="flex items-center gap-1 text-[10px] opacity-60 mt-1">
                                <Sparkles className="h-2.5 w-2.5" /> AI
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>

                  <div className="p-4 border-t border-border">
                    <form
                      onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
                      className="flex gap-2"
                    >
                      {canSendVideo && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setRecorderOpen(true)}
                          className="shrink-0 border-border text-muted-foreground hover:text-primary hover:border-primary/50"
                          title="Record a video message"
                          aria-label="Record a video message"
                        >
                          <Camera className="h-4 w-4" />
                        </Button>
                      )}
                      <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="bg-muted border-border"
                        disabled={sending}
                      />
                      <Button type="submit" disabled={sending || !newMessage.trim()} className="bg-gradient-purple text-primary-foreground shrink-0">
                        <Send className="h-4 w-4" />
                      </Button>
                    </form>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                  Select a conversation to start messaging
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <VideoMessageRecorder open={recorderOpen} onOpenChange={setRecorderOpen} onSend={sendVideoMessage} />
      {otherProfile && canRequestCall && (
        <VideoCallRequestDialog open={callDialogOpen} onOpenChange={setCallDialogOpen} creator={otherProfile} />
      )}
    </div>
  );
};

export default Messages;
