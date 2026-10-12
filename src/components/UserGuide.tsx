import { useMemo, useState } from "react";
import guideMd from "@/content/user-guide.md?raw";
import { renderMarkdown } from "@/lib/markdown";
import { Button } from "@/components/ui/button";
import { BookOpen, Download, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

/** Renders the platform guide (src/content/user-guide.md) with a section index and PDF download. */
const UserGuide = ({ compact = false }: { compact?: boolean }) => {
  const [q, setQ] = useState("");
  const sections = useMemo(() => {
    const parts = guideMd.split(/\n(?=## )/);
    return parts.map((p, i) => {
      const title = (p.match(/^##?\s+(.*)$/m)?.[1] || (i === 0 ? "Introduction" : `Section ${i}`)).trim();
      const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      return { id, title, md: p };
    });
  }, []);
  const filtered = q ? sections.filter((s) => s.md.toLowerCase().includes(q.toLowerCase())) : sections;
  const highlight = (html: string) => (q ? html.replace(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"), "<mark>$1</mark>") : html);

  return (
    <div className={`grid gap-6 ${compact ? "" : "lg:grid-cols-[240px_1fr]"}`}>
      {!compact && (
        <aside className="lg:sticky lg:top-24 h-fit space-y-3">
          <div className="relative"><Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the guide" className="pl-9 bg-muted border-border" /></div>
          <nav className="rounded-xl bg-gradient-card border border-border p-2 text-sm">
            {sections.slice(1).map((s) => <a key={s.id} href={`#${s.id}`} className="block px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 truncate">{s.title}</a>)}
          </nav>
          <Button asChild variant="outline" className="w-full"><a href="/user-guide.pdf" download><Download className="h-4 w-4 mr-2" /> Download PDF</a></Button>
        </aside>
      )}
      <article className="prose prose-invert prose-headings:font-display max-w-none rounded-xl bg-gradient-card border border-border p-5 md:p-8">
        {compact && <div className="flex justify-end not-prose mb-4"><Button asChild size="sm" variant="outline"><a href="/user-guide.pdf" download><Download className="h-4 w-4 mr-2" /> Download PDF</a></Button></div>}
        {filtered.length === 0 && <p className="text-muted-foreground not-prose flex items-center gap-2"><BookOpen className="h-4 w-4" /> Nothing matches "{q}".</p>}
        {filtered.map((s) => <section key={s.id} id={s.id} className="scroll-mt-24" dangerouslySetInnerHTML={{ __html: highlight(renderMarkdown(s.md)) }} />)}
      </article>
    </div>
  );
};

export default UserGuide;
