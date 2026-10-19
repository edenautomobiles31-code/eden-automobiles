// Donne à la page d'administration l'adresse et la clé PUBLIQUE de Supabase.
// (La clé secrète n'est jamais exposée ici.)
export function onRequestGet({ env }) {
  return new Response(
    JSON.stringify({ url: env.SUPABASE_URL, anonKey: env.SUPABASE_ANON_KEY }),
    { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }
  );
}
 
