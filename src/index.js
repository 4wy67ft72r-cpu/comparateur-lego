
export default {
  async fetch(request) {
    const url = new URL(request.url);

    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    if (url.pathname !== "/offres") {
      return Response.json({
        service: "Comparateur LEGO",
        status: "online",
        message: "API prête"
      }, { headers });
    }

    const set = url.searchParams.get("set");

    if (!set || !/^\d{4,7}$/.test(set)) {
      return Response.json({
        error: "Numéro de set LEGO invalide"
      }, { status: 400, headers });
    }

    return Response.json({
      set,
      offres: [],
      source: "aucun fournisseur connecté",
      message: "API opérationnelle, en attente de connexion à un fournisseur de prix."
    }, { headers });
  }
};
