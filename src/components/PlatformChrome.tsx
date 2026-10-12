import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { hexToHslTriplet, useSetting } from "@/hooks/usePlatform";
import { useFeature } from "@/hooks/usePlatform";
import type { Announcement } from "@/components/admin/AdminAnnouncementsTab";
import { Megaphone, X } from "lucide-react";

/**
 * Site-wide effects driven by the admin Settings: brand colors, document title,
 * favicon, Google Analytics, last-seen heartbeat, and the announcement banners.
 */
const PlatformChrome = () => {
  const site = useSetting("site");
  const design = useSetting("design");
  const announcementsOn = useFeature("announcements");
  const { user, profile } = useAuth();
  const location = useLocation();
  const [items, setItems] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem("dismissed_announcements") || "[]"); } catch { return []; } });

  // Brand colors → CSS tokens
  useEffect(() => {
    const root = document.documentElement;
    const p = hexToHslTriplet(design.primary); const s = hexToHslTriplet(design.secondary);
    if (p) root.style.setProperty("--primary", p); else root.style.removeProperty("--primary");
    if (s) root.style.setProperty("--accent", s); else root.style.removeProperty("--accent");
  }, [design.primary, design.secondary]);

  // Title, meta, favicon
  useEffect(() => {
    if (site.site_name && !location.pathname.startsWith("/p/")) document.title = site.site_name;
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!meta) { meta = document.createElement("meta"); meta.name = "description"; document.head.appendChild(meta); }
    if (site.meta_description) meta.content = site.meta_description;
    if (site.favicon_url) {
      let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
      if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
      link.href = site.favicon_url;
    }
  }, [site.site_name, site.meta_description, site.favicon_url, location.pathname]);

  // Google Analytics
  useEffect(() => {
    const id = (site.ga_code || "").trim();
    if (!/^(G|UA|AW)-[A-Z0-9-]+$/i.test(id) || document.getElementById("ga-script")) return;
    const s = document.createElement("script"); s.id = "ga-script"; s.async = true; s.src = `https://www.googletagmanager.com/gtag/js?id=${id}`; document.head.appendChild(s);
    const inline = document.createElement("script"); inline.textContent = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');`; document.head.appendChild(inline);
  }, [site.ga_code]);

  // Last-seen heartbeat
  useEffect(() => {
    if (!user) return;
    const ping = () => (supabase as any).rpc("touch_last_seen").then(() => {}, () => {});
    ping();
    const t = window.setInterval(ping, 5 * 60 * 1000);
    return () => window.clearInterval(t);
  }, [user?.id]);

  // Announcements
  useEffect(() => {
    if (!announcementsOn) { setItems([]); return; }
    (supabase as any).from("announcements").select("*").eq("is_active", true).lte("starts_at", new Date().toISOString()).order("created_at", { ascending: false })
      .then(({ data }: { data: Announcement[] | null }) => setItems((data || []).filter((a) => !a.ends_at || new Date(a.ends_at) > new Date())));
  }, [announcementsOn, location.pathname]);

  const audienceOk = (a: Announcement) => a.audience === "all" || (a.audience === "creators" ? !!profile?.is_creator : !!user && !profile?.is_creator);
  const visible = items.filter((a) => audienceOk(a) && !dismissed.includes(a.id));
  const dismiss = (id: string) => { const next = [...dismissed, id]; setDismissed(next); try { localStorage.setItem("dismissed_announcements", JSON.stringify(next)); } catch { /* ignore */ } };

  if (location.pathname.startsWith("/admin") || location.pathname.startsWith("/call/") || location.pathname.startsWith("/vr/") || visible.length === 0) return null;
  const styles: Record<string, string> = { info: "bg-primary/90 text-primary-foreground", success: "bg-emerald-600 text-white", warning: "bg-amber-500 text-black" };
  return (
    <div className="fixed top-0 inset-x-0 z-[70]">
      {visible.slice(0, 2).map((a) => (
        <div key={a.id} className={`${styles[a.style] || styles.info} px-4 py-2 text-sm flex items-center gap-3`}>
          <Megaphone className="h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1 truncate"><span className="font-bold">{a.title}</span>{a.body && <span className="opacity-90"> · {a.body}</span>}{a.link_url && <a href={a.link_url} className="underline ml-2 font-semibold">Learn more</a>}</div>
          <button onClick={() => dismiss(a.id)} aria-label="Dismiss" className="opacity-80 hover:opacity-100"><X className="h-4 w-4" /></button>
        </div>
      ))}
    </div>
  );
};

export default PlatformChrome;
