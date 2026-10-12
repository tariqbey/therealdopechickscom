import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import logo from "@/assets/logo.png";
import { supabase } from "@/integrations/supabase/client";
import { useSetting } from "@/hooks/usePlatform";

interface FooterPage { slug: string; title: string; footer_group: "platform" | "company" | "legal" | null }

const PLATFORM_LINKS = [
  { label: "Explore", href: "/#explore" }, { label: "Creators", href: "/#creators" }, { label: "AI Studio", href: "/ai-studio" }, { label: "Get BREAD", href: "/#bread" },
];

const Footer = () => {
  const site = useSetting("site");
  const [pages, setPages] = useState<FooterPage[]>([]);
  useEffect(() => {
    (supabase as any).from("site_pages").select("slug, title, footer_group").eq("is_published", true).not("footer_group", "is", null).order("sort")
      .then(({ data }: any) => setPages(data || []));
  }, []);
  const group = (g: FooterPage["footer_group"]) => pages.filter((p) => p.footer_group === g);
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border py-12">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <img src={site.logo_url || logo} alt={site.site_name} className="h-24 w-auto mb-3 mix-blend-screen drop-shadow-[0_0_15px_hsl(42,80%,55%,0.3)]" />
            <p className="text-xs text-muted-foreground">{site.meta_description || "The premium platform for exclusive content and AI-powered creation."}</p>
            {site.support_email && <a href={`mailto:${site.support_email}`} className="text-xs text-primary mt-2 inline-block">{site.support_email}</a>}
          </div>
          <div><h4 className="font-bold text-sm mb-3">Platform</h4><ul className="space-y-2">{PLATFORM_LINKS.map((l) => <li key={l.label}><a href={l.href} className="text-xs text-muted-foreground hover:text-foreground transition-colors">{l.label}</a></li>)}{group("platform").map((p) => <li key={p.slug}><Link to={`/p/${p.slug}`} className="text-xs text-muted-foreground hover:text-foreground transition-colors">{p.title}</Link></li>)}</ul></div>
          <div><h4 className="font-bold text-sm mb-3">Company</h4><ul className="space-y-2">{group("company").map((p) => <li key={p.slug}><Link to={`/p/${p.slug}`} className="text-xs text-muted-foreground hover:text-foreground transition-colors">{p.title}</Link></li>)}</ul></div>
          <div><h4 className="font-bold text-sm mb-3">Legal</h4><ul className="space-y-2">{group("legal").map((p) => <li key={p.slug}><Link to={`/p/${p.slug}`} className="text-xs text-muted-foreground hover:text-foreground transition-colors">{p.title}</Link></li>)}</ul></div>
        </div>
        <div className="border-t border-border pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted-foreground">© {year} {site.company_name || site.site_name}. All rights reserved. 18+ only.</p>
          <p className="text-xs text-muted-foreground">Powered by BREAD 🍞</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
