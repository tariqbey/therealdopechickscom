-- Seeded page bodies used plain '\n' which Postgres stores literally; replace with real newlines.
UPDATE public.site_pages SET content = replace(content, '\n', E'\n') WHERE content LIKE '%\n%';
