/** Visite quotidienne (tâche planifiée Vercel, « crons » de vercel.json ; partie 10, lots 3 et 4).
 * Une lecture par l'API de la base empêche la mise en pause du projet Supabase gratuit (7 jours
 * sans activité), vacances comprises ; la base en profite pour mesurer l'espace occupé et préparer
 * les alertes. Puis la file des e-mails est vidée (fonction serveur « courriels » : ce qui reste ou
 * a échoué repart). Seule la clé publique sert ici. Si CRON_SECRET est défini dans Vercel, seul
 * l'appel planifié est accepté. */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Non autorisé", { status: 401 });
  }
  const url = process.env.VITE_SUPABASE_URL;
  const cle = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !cle) return Response.json({ ok: false, erreur: "Base non configurée" }, { status: 500 });
  try {
    const reponse = await fetch(`${url}/rest/v1/rpc/veille`, {
      method: "POST",
      headers: { apikey: cle, "Content-Type": "application/json" },
      body: "{}",
    });
    if (!reponse.ok) return Response.json({ ok: false, erreur: `Base : réponse ${reponse.status}` }, { status: 502 });
    await reponse.body?.cancel();
  } catch {
    return Response.json({ ok: false, erreur: "Base injoignable" }, { status: 502 });
  }
  // Les e-mails ne font jamais échouer la visite : leur état est seulement rapporté.
  let courriels: string;
  try {
    const envoi = await fetch(`${url}/functions/v1/courriels`, {
      method: "POST",
      headers: { apikey: cle, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "envoyer" }),
    });
    courriels = envoi.ok ? "ok" : `réponse ${envoi.status}`;
    await envoi.body?.cancel();
  } catch {
    courriels = "injoignable";
  }
  return Response.json({ ok: true, courriels });
}
