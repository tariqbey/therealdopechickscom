import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { renderMarkdown } from "@/lib/markdown";
import { Loader2 } from "lucide-react";

/** Public CMS page from site_pages (Terms, Privacy, About, …). */
const SitePage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [page, setPage] = useState<{ title: string; content: string; updated_at: string } | null | undefined>(undefined);

  useEffect(() => {
    (supabase as any).from("site_pages").select("title, content, updated_at").eq("slug", slug).eq("is_published", true).maybeSingle()
      .then(({ data }: any) => setPage(data || null));
  }, [slug]);

  useEffect(() => { if (page) document.title = `${page.title} · Dope Chicks`; }, [page]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-28 pb-16 max-w-3xl">
        {page === undefined ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        : page === null ? <div className="text-center py-16"><h1 className="text-2xl font-black mb-2">Page not found</h1><Button onClick={() => navigate("/")}>Back home</Button></div>
        : <article className="prose prose-invert prose-headings:font-display max-w-none">
            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(page.content) }} />
            <p className="text-xs text-muted-foreground not-prose mt-10">Last updated {new Date(page.updated_at).toLocaleDateString()}</p>
          </article>}
      </div>
      <Footer />
    </div>
  );
};

export default SitePage;
