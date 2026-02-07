import { useState } from "react";
import { Bell, BellOff, Smartphone, AlertCircle, Loader2, Send } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export function PushNotificationSettings() {
  const { toast } = useToast();
  const {
    isSupported, isSubscribed, permission, isLoading,
    isiOS, isPWA, subscribe, unsubscribe
  } = usePushNotifications();
  const [isSendingTest, setIsSendingTest] = useState(false);

  const handleToggle = async () => {
    try {
      if (isSubscribed) {
        await unsubscribe();
        toast({ title: "Notifications disabled" });
      } else {
        await subscribe();
        toast({ title: "Notifications enabled!" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleSendTest = async () => {
    setIsSendingTest(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      await supabase.functions.invoke('send-push-notification', {
        body: {
          user_id: user.id,
          payload: {
            title: "Test Notification 🔔",
            body: "Push notifications are working!",
            url: "/"
          }
        }
      });
      toast({ title: "Test sent!" });
    } catch (error: any) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSendingTest(false);
    }
  };

  if (isiOS && !isPWA) {
    return (
      <div className="rounded-xl bg-gradient-card border border-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-accent" />
          <h3 className="font-bold text-sm">Push Notifications</h3>
        </div>
        <p className="text-xs text-muted-foreground">Install the app first to enable push notifications:</p>
        <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
          <li>Tap the <strong>Share</strong> button in Safari</li>
          <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
          <li>Open the app from your home screen</li>
        </ol>
      </div>
    );
  }

  if (!isSupported) {
    return (
      <div className="rounded-xl bg-gradient-card border border-border p-4 flex items-center gap-3">
        <AlertCircle className="h-5 w-5 text-muted-foreground" />
        <div>
          <p className="text-sm font-bold">Push Notifications</p>
          <p className="text-xs text-muted-foreground">Not supported in this browser</p>
        </div>
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div className="rounded-xl bg-gradient-card border border-border p-4 flex items-center gap-3">
        <BellOff className="h-5 w-5 text-destructive" />
        <div>
          <p className="text-sm font-bold">Push Notifications</p>
          <p className="text-xs text-muted-foreground">Permission denied — update browser settings</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-gradient-card border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isSubscribed ? <Bell className="h-5 w-5 text-accent" /> : <BellOff className="h-5 w-5 text-muted-foreground" />}
          <div>
            <p className="text-sm font-bold">Push Notifications</p>
            <p className="text-xs text-muted-foreground">{isSubscribed ? "Enabled" : "Disabled"}</p>
          </div>
        </div>
        <Switch checked={isSubscribed} onCheckedChange={handleToggle} disabled={isLoading} />
      </div>
      {isSubscribed && (
        <Button variant="outline" size="sm" onClick={handleSendTest} disabled={isSendingTest} className="w-full">
          {isSendingTest ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
          Send Test Notification
        </Button>
      )}
    </div>
  );
}
