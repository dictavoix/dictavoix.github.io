// Fonction Supabase Edge : reçoit une dictée en désordre et renvoie un compte-rendu organisé,
// via l'API OpenAI. La clé OPENAI_API_KEY est un secret côté serveur, jamais exposée au client.
// L'authentification (utilisateur connecté) est vérifiée automatiquement par la plateforme
// avant d'atteindre ce code (vérification du JWT activée par défaut sur les Edge Functions).

const SYSTEM_PROMPT = `Tu es un assistant qui aide un professionnel à mettre en forme un compte-rendu de consultation à partir d'une dictée orale, potentiellement en désordre ou décousue.

Règles strictes :
- Réorganise le contenu en un compte-rendu clair et structuré, en français professionnel.
- Ne jamais inventer, déduire ou ajouter une information qui n'est pas explicitement dans la dictée.
- Reformule pour la clarté, mais conserve tous les faits mentionnés.
- Structure avec des sections courtes si pertinent (par ex. Motif, Observations, Suite à donner), sans forcer un plan si le contenu ne s'y prête pas.
- Réponds uniquement avec le compte-rendu final, sans commentaire ni introduction de ta part.`;

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();
    if (!text || !text.trim()) {
      return new Response(JSON.stringify({ error: 'Texte manquant.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Clé OpenAI non configurée côté serveur." }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(JSON.stringify({ error: `Erreur OpenAI : ${errText}` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const organized = data.choices?.[0]?.message?.content?.trim() || '';

    return new Response(JSON.stringify({ organized }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
