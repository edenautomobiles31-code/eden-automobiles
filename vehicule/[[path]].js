// Page publique d'un véhicule : /vehicule/<id>/<titre-du-véhicule>
// Générée côté serveur pour que Google voie le contenu (titre, prix, caractéristiques, photos).
const BASE = "https://edenautomobile.fr";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => Number(n || 0).toLocaleString("fr-FR");
const slug = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const isUrl = (u) => /^https:\/\/[^\s"'<>]+$/.test(u);

function shell(title, desc, canonical, body, extraHead = "", status = 200, noindex = false) {
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#15171A"><link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ""}<meta name="robots" content="${noindex ? "noindex,follow" : "index,follow,max-image-preview:large"}">
<meta property="og:type" content="website"><meta property="og:locale" content="fr_FR"><meta property="og:site_name" content="EDEN AUTOMOBILES"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">${canonical ? `<meta property="og:url" content="${esc(canonical)}">` : ""}
${extraHead}<link rel="stylesheet" href="/style.css?v=1"></head><body>
<header><div class="w bar"><a class="logo" href="/" aria-label="EDEN AUTOMOBILES, accueil"><img src="/logo.png" alt="" width="50" height="50"><span class="lt">Eden<span>.</span> Automobiles</span></a>
<nav aria-label="Navigation principale"><a href="/#avis">Avis</a><a href="/#acheter">Nos véhicules</a><a href="/estimation-reprise-voiture-portet-sur-garonne/">Vendre</a><a href="/#contact">Contact</a><a class="c" href="/recherche-voiture-occasion-toulouse/">Lancer ma recherche</a></nav></div></header>
<main id="top">${body}</main>
<footer><div class="w"><span class="fl"><img src="/logo.png" alt="Logo EDEN AUTOMOBILES" width="56" height="56" loading="lazy">© EDEN AUTOMOBILES · 3 chemin de Candie, 31120 Portet-sur-Garonne</span><span><a href="/?legal=1">Mentions légales</a> · <a href="/?priv=1">Confidentialité</a></span></div></footer></body></html>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": status === 200 ? "public, max-age=300" : "public, max-age=60" } });
}

const gone = (msg, status) => shell("Véhicule introuvable | EDEN AUTOMOBILES", msg, null,
  `<div class="w txt" style="padding:70px 20px"><h1 style="font-size:36px">${esc(msg)}</h1><p>Retrouvez nos autres véhicules ou lancez une recherche personnalisée : nous trouvons la voiture que vous cherchez.</p><p><a class="btn" href="/#acheter">Voir les véhicules disponibles</a> <a class="btn g" href="/recherche-voiture-occasion-toulouse/">Lancer une recherche</a></p></div>`, "", status, true);

export async function onRequestGet({ params, env, request }) {
  const parts = [].concat(params.path || []);
  const id = parts[0] || "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return gone("Véhicule introuvable.", 404);
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return gone("Service momentanément indisponible.", 503);

  let a;
  try {
    const r = await fetch(`${env.SUPABASE_URL}/rest/v1/annonces?id=eq.${id}&select=*&limit=1`, { headers: { apikey: env.SUPABASE_ANON_KEY } });
    if (!r.ok) throw new Error("db");
    a = (await r.json())[0];
  } catch {
    return gone("Service momentanément indisponible.", 503);
  }
  if (!a) return gone("Véhicule introuvable.", 404);
  if (a.statut === "vendu") return gone("Ce véhicule a été vendu.", 410);

  const good = slug(a.titre);
  const canonical = `${BASE}/vehicule/${a.id}/${good}`;
  // l'adresse "propre" est celle avec le titre : on y redirige les liens sans titre ou avec un titre périmé
  if (parts[1] !== good) return Response.redirect(canonical, 301);

  const photos = (a.photos || []).filter(isUrl);
  const reserve = a.statut === "reserve";
  const specs = [["Année", a.annee], ["Kilométrage", a.km != null ? fmt(a.km) + " km" : null], ["Énergie", a.energie], ["Boîte", a.boite]].filter((x) => x[1]);
  const marque = String(a.titre || "").trim().split(/\s+/)[0] || "";
  const title = `${a.titre} d’occasion, ${fmt(a.prix)} € | EDEN AUTOMOBILES Portet-sur-Garonne`;
  const desc = `${a.titre}${a.annee ? " " + a.annee : ""}${a.km != null ? ", " + fmt(a.km) + " km" : ""}${a.energie ? ", " + a.energie : ""}${a.boite ? ", boîte " + a.boite.toLowerCase() : ""} : ${fmt(a.prix)} € TTC chez EDEN AUTOMOBILES, garage à Portet-sur-Garonne près de Toulouse.`.slice(0, 300);

  const ld = {
    "@context": "https://schema.org", "@type": "Car", name: a.titre, url: canonical,
    brand: { "@type": "Brand", name: marque }, description: a.description || desc,
    ...(photos.length ? { image: photos } : {}),
    ...(a.annee ? { vehicleModelDate: String(a.annee) } : {}),
    ...(a.km != null ? { mileageFromOdometer: { "@type": "QuantitativeValue", value: a.km, unitCode: "KMT" } } : {}),
    ...(a.energie ? { fuelType: a.energie } : {}), ...(a.boite ? { vehicleTransmission: a.boite } : {}),
    offers: { "@type": "Offer", price: String(a.prix), priceCurrency: "EUR", url: canonical, itemCondition: "https://schema.org/UsedCondition",
      availability: reserve ? "https://schema.org/LimitedAvailability" : "https://schema.org/InStock",
      seller: { "@type": "AutoDealer", name: "EDEN AUTOMOBILES", telephone: "+33682007194", address: { "@type": "PostalAddress", streetAddress: "3 chemin de Candie", postalCode: "31120", addressLocality: "Portet-sur-Garonne", addressCountry: "FR" } } },
  };
  const crumbs = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "Accueil", item: BASE + "/" },
    { "@type": "ListItem", position: 2, name: "Véhicules", item: BASE + "/#acheter" },
    { "@type": "ListItem", position: 3, name: a.titre, item: canonical }] };
  const j = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;

  const wa = `https://wa.me/33627025083?text=${encodeURIComponent("Bonjour, je suis intéressé(e) par : " + a.titre + " (" + canonical + ")")}`;
  const body = `<div class="w"><p class="crumb"><a href="/">Accueil</a> › <a href="/#acheter">Véhicules</a> › ${esc(a.titre)}</p>
<div class="vp"><div>
<div class="gm" id="gm">${photos[0] ? `<img src="${esc(photos[0])}" alt="${esc(a.titre)}" width="800" height="600">` : "Photo à venir"}</div>
${photos.length > 1 ? `<div class="ths">${photos.map((u, k) => `<button type="button" class="tb ${k ? "" : "on"}" data-ph="${k}" aria-label="Photo ${k + 1}"><img src="${esc(u)}" alt="${esc(a.titre)} – photo ${k + 1}" loading="lazy"></button>`).join("")}</div>` : ""}
${a.description ? `<h2 style="font-size:24px;margin-top:28px">Description</h2><p>${esc(a.description).replace(/\n/g, "<br>")}</p>` : ""}
${(a.equipements || []).length ? `<h2 style="font-size:24px;margin-top:24px">Équipements</h2><div class="tg">${a.equipements.map((x) => `<span>${esc(x)}</span>`).join("")}</div>` : ""}
</div><div>
<h1>${esc(a.titre)}</h1>${reserve ? '<p class="mt"><strong>Ce véhicule est actuellement réservé.</strong></p>' : ""}
<div class="pr">${fmt(a.prix)} € TTC</div>
<ul class="sp">${specs.map((x) => `<li><span>${x[0]}</span><br>${esc(x[1])}</li>`).join("")}</ul>
<p><a class="btn" href="tel:+33682007194">Appeler le garage</a> <a class="btn g" href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp</a></p>
<form id="fc" style="margin-top:22px"><h2 style="font-size:22px">Être rappelé à propos de ce véhicule</h2>
<div class="r2"><label>Nom<input name="nom" autocomplete="name" required></label><label>Téléphone<input name="telephone" type="tel" autocomplete="tel" required></label></div>
<label class="cs"><input type="checkbox" name="consent" required> J’accepte que EDEN AUTOMOBILES utilise ces informations pour me recontacter (voir la <a href="/?priv=1">politique de confidentialité</a>).</label>
<input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
<button class="btn" type="submit">Être rappelé</button><p class="er" role="alert" id="er"></p></form>
<p style="margin-top:22px">Ce modèle vous plaît mais pas cette version ? <a href="/recherche-voiture-occasion-toulouse/">On le trouve pour vous</a>.</p>
</div></div></div>
<script>
document.addEventListener("click",function(e){var t=e.target.closest("[data-ph]");if(!t)return;var im=t.querySelector("img");document.getElementById("gm").innerHTML='<img src="'+im.src+'" alt="">';document.querySelectorAll(".tb").forEach(function(b){b.classList.toggle("on",b===t)})});
document.getElementById("fc").addEventListener("submit",async function(e){e.preventDefault();var f=e.target,b=f.querySelector("button[type=submit]"),m=document.getElementById("er");
 var v=function(n){return f.elements[n].value.trim()};m.textContent="";b.disabled=true;
 try{var r=await fetch("/api/demande",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:"rappel",nom:v("nom"),telephone:v("telephone"),website:v("website"),vehicule:${JSON.stringify(a.titre)},annonce_id:${JSON.stringify(a.id)}})});var j=await r.json();if(!j.ok)throw new Error(j.error||"Erreur");
  f.innerHTML='<h2 style="font-size:22px">Demande envoyée</h2><p>Un conseiller vous rappelle très vite. Merci !</p>'}catch(x){m.textContent=(x.message||"Envoi impossible")+" Vous pouvez aussi nous appeler au 06 82 00 71 94.";b.disabled=false}});
</script>`;
  return shell(title, desc, canonical, body, j(ld) + j(crumbs));
}
