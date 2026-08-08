// Fonction Supabase Edge : reçoit une dictée en désordre et renvoie un compte-rendu organisé,
// via l'API OpenAI. La clé OPENAI_API_KEY est un secret côté serveur, jamais exposée au client.
// L'authentification (utilisateur connecté) est vérifiée automatiquement par la plateforme
// avant d'atteindre ce code (vérification du JWT activée par défaut sur les Edge Functions).

const SYSTEM_PROMPT = `Tu es un assistant qui aide un professionnel à mettre en forme un compte-rendu à partir d'une dictée orale.

Le texte fourni peut être :
- une dictée brute en désordre,
- ou un compte-rendu déjà organisé auquel de nouvelles phrases dictées ont été ajoutées à la suite, parfois avec une instruction orale du type "dans telle catégorie, ajoute que...", "ajoute à la fin que...".

Règles strictes :
- Produis une version finale complète et organisée du compte-rendu, en français professionnel.
- N'omets, ne résume et ne raccourcis JAMAIS une information présente dans le texte, même mineure ou répétée : toutes les informations doivent se retrouver dans le résultat.
- Si une phrase contient une instruction sur où placer une information (ex: "dans telle catégorie, ajoute que..."), exécute cette instruction : place l'information au bon endroit et ne recopie pas l'instruction elle-même dans le résultat.
- Ne jamais inventer, déduire ou ajouter une information qui n'est pas explicitement mentionnée.
- Structure avec des sections courtes et cohérentes si le contenu s'y prête (par ex. Motif, Observations, Suite à donner), sans forcer un plan artificiel.
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
