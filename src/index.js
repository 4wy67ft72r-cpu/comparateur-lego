
export default {
  async fetch(request, env) {
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json"
    };

    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), { status, headers });

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    const url = new URL(request.url);

    if (url.pathname !== "/offres") {
      return json({
        service: "Comparateur LEGO",
        status: "online",
        fournisseur: "eBay"
      });
    }

    const set = url.searchParams.get("set");

    if (!set || !/^\d{4,7}$/.test(set)) {
      return json({ error: "Numéro de set LEGO invalide" }, 400);
    }

    if (!env.EBAY_CLIENT_ID || !env.EBAY_CLIENT_SECRET) {
      return json({
        error: "Clés eBay absentes dans Cloudflare"
      }, 500);
    }

    try {
      const credentials = btoa(
        env.EBAY_CLIENT_ID + ":" + env.EBAY_CLIENT_SECRET
      );

      const tokenResponse = await fetch(
        "https://api.ebay.com/identity/v1/oauth2/token",
        {
          method: "POST",
          headers: {
            Authorization: "Basic " + credentials,
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: new URLSearchParams({
            grant_type: "client_credentials",
            scope: "https://api.ebay.com/oauth/api_scope"
          })
        }
      );

      if (!tokenResponse.ok) {
        return json({
          error: "Authentification eBay impossible",
          status: tokenResponse.status
        }, 502);
      }

      const tokenData = await tokenResponse.json();

      const searchUrl = new URL(
        "https://api.ebay.com/buy/browse/v1/item_summary/search"
      );

      searchUrl.searchParams.set("q", "LEGO " + set);
      searchUrl.searchParams.set("limit", "20");

      const ebayResponse = await fetch(searchUrl.toString(), {
        headers: {
          Authorization: "Bearer " + tokenData.access_token,
          "X-EBAY-C-MARKETPLACE-ID": "EBAY_FR",
          "Accept-Language": "fr-FR"
        }
      });

      if (!ebayResponse.ok) {
        return json({
          error: "Recherche eBay indisponible",
          status: ebayResponse.status
        }, 502);
      }

      const data = await ebayResponse.json();

      const offres = (data.itemSummaries || []).map(item => ({
        titre: item.title,
        prix: item.price?.value,
        devise: item.price?.currency,
        livraison: item.shippingOptions?.[0]?.shippingCost?.value ?? null,
        image: item.image?.imageUrl ?? null,
        lien: item.itemWebUrl,
        vendeur: item.seller?.username ?? null,
        etat: item.condition ?? null,
        source: "eBay"
      }));

      return json({
        set,
        source: "eBay",
        total: offres.length,
        offres
      });

    } catch (error) {
      return json({
        error: "Erreur de connexion au fournisseur eBay"
      }, 502);
    }
  }
};
