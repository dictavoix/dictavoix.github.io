// Fonction Supabase Edge : reçoit une dictée en désordre et renvoie un compte-rendu organisé,
// via l'API OpenAI. La clé OPENAI_API_KEY est un secret côté serveur, jamais exposée au client.
// L'authentification (utilisateur connecté) est vérifiée automatiquement par la plateforme
// avant d'atteindre ce code (vérification du JWT activée par défaut sur les Edge Functions).

const SYSTEM_PROMPT = `Tu es un assistant qui aide un professionnel à mettre en forme un compte-rendu à partir d'une dictée orale, parlée dans le désordre, parfois en plusieurs fois.

Le texte fourni contient tout ce qui a été dit jusqu'à présent : parfois une dictée brute en désordre, parfois un compte-rendu déjà organisé suivi de nouvelles phrases ajoutées librement, sans indication explicite de la personne sur où les placer.

Règles strictes :
- Déduis TOI-MÊME, à partir du sens de chaque information, à quelle section elle appartient le plus logiquement (par ex. motif, observations, examen, suite à donner...) — n'attends pas que la personne précise la catégorie à voix haute.
- Si une phrase contient malgré tout une instruction explicite de placement (ex: "dans telle catégorie, ajoute que..."), respecte-la en priorité et ne recopie pas l'instruction elle-même dans le résultat.
- Produis une version finale complète et organisée du compte-rendu, en français professionnel, en intégrant chaque information au bon endroit.
- N'omets, ne résume et ne raccourcis JAMAIS une information présente dans le texte, même mineure ou répétée : toutes les informations doivent se retrouver dans le résultat.
- Ne jamais inventer, déduire ou ajouter une information factuelle qui n'est pas explicitement mentionnée.
- Structure avec des sections courtes et cohérentes adaptées au contenu (par ex. Motif, Observations, Suite à donner), sans forcer un plan artificiel s'il ne convient pas.
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
