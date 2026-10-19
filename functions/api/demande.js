// Fonction du site (Cloudflare Pages) : enregistre une demande client
// (rappel, estimation, réservation) puis envoie les emails.
// La plaque d'immatriculation n'est JAMAIS mise dans un email.
 
const str = (v, n = 200) => (typeof v === "string" ? v.trim().slice(0, n) : "") || null;
const num = (v) => {
  const n = Number(v);
  return v !== "" && v != null && Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
};
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const reply = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
const LABELS = { rappel: "rappel", estimation: "estimation", reservation: "réservation" };
 
async function sendMail(env, to, subject, html) {
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, html }),
    });
  } catch (e) {
    // Un échec d'envoi d'email ne doit jamais faire perdre la demande.
  }
}
 
export async function onRequestPost({ request, env }) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
    return reply({ ok: false, error: "Configuration incomplète." }, 500);
  }
  let b;
  try {
    b = await request.json();
  } catch {
    return reply({ ok: false, error: "Requête invalide." }, 400);
  }
  if (b && b.website) return reply({ ok: true }); // piège anti-robots
  const type = b && b.type;
  if (!LABELS[type]) return reply({ ok: false, error: "Type de demande inconnu." }, 400);
 
  const d = {
    type,
    nom: str(b.nom, 100),
    telephone: str(b.telephone, 30),
    email: str(b.email, 150),
    ville: str(b.ville, 100),
    vehicule: str(b.vehicule),
    annonce_id: /^[0-9a-f-]{36}$/i.test(b.annonce_id || "") ? b.annonce_id : null,
    marque_modele: str(b.marque_modele),
    annee: num(b.annee),
    km: num(b.km),
    energie: str(b.energie, 30),
    boite: str(b.boite, 30),
    etat: str(b.etat, 300),
    souhait: ["rachat", "depot"].includes(b.souhait) ? b.souhait : null,
    projet_achat: ["oui", "non"].includes(b.projet_achat) ? b.projet_achat : null,
    livraison: ["domicile", "garage"].includes(b.livraison) ? b.livraison : null,
    adresse_livraison: str(b.adresse_livraison, 250),
    immatriculation: type === "estimation" ? (str(b.immatriculation, 12) || "").toUpperCase() || null : null,
  };
 
  const chiffres = (d.telephone || "").replace(/\D/g, "");
  if (!d.nom || chiffres.length < 8) return reply({ ok: false, error: "Nom et téléphone valides requis." }, 400);
  const mailOk = d.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email);
  if (type !== "rappel" && !mailOk) return reply({ ok: false, error: "Email valide requis." }, 400);
  if (type === "reservation" && (!d.livraison || (d.livraison === "domicile" && !d.adresse_livraison))) {
    return reply({ ok: false, error: "Mode de récupération requis." }, 400);
  }
 
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/demandes`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(d),
  });
  if (!r.ok) return reply({ ok: false, error: "Enregistrement impossible." }, 502);
 
  const lignes = [
    ["Nom", d.nom],
    ["Téléphone", d.telephone],
    ["Email", d.email],
    ["Ville", d.ville],
    ["Véhicule", d.vehicule || d.marque_modele],
    ["Année", d.annee],
    ["Kilométrage", d.km],
    ["Énergie", d.energie],
    ["Boîte", d.boite],
    ["État", d.etat],
    ["Souhait", d.souhait === "depot" ? "Dépôt-vente" : d.souhait === "rachat" ? "Rachat par le garage" : null],
    ["Projet d'achat d'un véhicule", d.projet_achat === "oui" ? "Oui" : d.projet_achat === "non" ? "Non" : null],
    ["Récupération", d.livraison === "domicile" ? "Livraison à domicile" : d.livraison === "garage" ? "Retrait au garage" : null],
    ["Adresse de livraison", d.adresse_livraison],
  ].filter(([, v]) => v);
 
  const tableau = lignes.map(([k, v]) => `<tr><td><b>${esc(k)}</b></td><td>${esc(v)}</td></tr>`).join("");
  const envois = [];
  if (env.GARAGE_EMAIL) {
    envois.push(
      sendMail(
        env,
        env.GARAGE_EMAIL,
        `Nouvelle demande de ${LABELS[type]} : ${d.nom}`,
        `<h2>Nouvelle demande de ${LABELS[type]}</h2><table cellpadding="4">${tableau}</table><p>Retrouvez-la dans votre espace d'administration.</p>`
      )
    );
  }
  if (type !== "rappel" && mailOk) {
    const objet = d.vehicule || d.marque_modele;
    envois.push(
      sendMail(
        env,
        d.email,
        `Votre demande de ${LABELS[type]} - EDEN AUTOMOBILES`,
        `<p>Bonjour ${esc(d.nom)},</p>
         <p>Nous avons bien reçu votre demande de ${LABELS[type]}${objet ? ` concernant : ${esc(objet)}` : ""}.</p>
         <p>Un conseiller EDEN AUTOMOBILES vous rappelle au ${esc(d.telephone)} pour la confirmer.
         ${type === "reservation" ? "Aucun paiement n'a été demandé à ce stade." : ""}</p>
         <p>EDEN AUTOMOBILES<br>3 chemin de Candie, 31120 Portet-sur-Garonne<br>06 82 00 71 94</p>`
      )
    );
  }
  await Promise.all(envois);
  return reply({ ok: true });
}
 
