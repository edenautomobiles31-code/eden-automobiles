// Plan du site généré automatiquement : pages fixes + une page par véhicule en vente.
const BASE = "https://edenautomobile.fr";
const slug = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const x = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

export async function onRequestGet({ env }) {
  const urls = [
    { loc: BASE + "/", pr: "1.0" },
    { loc: BASE + "/recherche-voiture-occasion-toulouse/", pr: "0.9" },
    { loc: BASE + "/estimation-reprise-voiture-portet-sur-garonne/", pr: "0.9" },
  ];
  try {
    if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
      const r = await fetch(`${env.SUPABASE_URL}/rest/v1/annonces?select=id,titre,created_at&statut=neq.vendu&order=created_at.desc&limit=1000`, { headers: { apikey: env.SUPABASE_ANON_KEY } });
      if (r.ok) for (const a of await r.json()) urls.push({ loc: `${BASE}/vehicule/${a.id}/${slug(a.titre)}`, mod: (a.created_at || "").slice(0, 10), pr: "0.7" });
    }
  } catch {}
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `<url><loc>${x(u.loc)}</loc>${u.mod ? `<lastmod>${u.mod}</lastmod>` : ""}<priority>${u.pr}</priority></url>`).join("\n") + `\n</urlset>\n`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
