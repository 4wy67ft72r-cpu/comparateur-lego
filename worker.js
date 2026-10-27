export default {
  async fetch(request, env) {
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json'
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers });
    const url = new URL(request.url);
    const set = url.searchParams.get('set');
    if (!set || !/^\d{4,8}$/.test(set)) return Response.json({ offers: [], error: 'Numéro LEGO invalide' }, { status: 400, headers });
    if (!env.EBAY_CLIENT_ID || !env.EBAY_CLIENT_SECRET) return Response.json({ offers: [], error: 'Clés eBay non configurées' }, { status: 503, headers });
    try {
      const credentials = btoa(env.EBAY_CLIENT_ID + ':' + env.EBAY_CLIENT_SECRET);
      const tokenResponse = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
        method: 'POST',
        headers: { 'Authorization': 'Basic ' + credentials, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope'
      });
      if (!tokenResponse.ok) throw new Error('Authentification eBay : ' + tokenResponse.status);
      const token = (await tokenResponse.json()).access_token;
      const api = new URL('https://api.ebay.com/buy/browse/v1/item_summary/search');
      api.searchParams.set('q', 'LEGO ' + set);
      api.searchParams.set('limit', '50');
      api.searchParams.set('filter', 'deliveryCountry:FR');
      const response = await fetch(api, { headers: { 'Authorization': 'Bearer ' + token, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_FR' } });
      if (!response.ok) throw new Error('Recherche eBay : ' + response.status);
      const data = await response.json();
      const offers = (data.itemSummaries || []).filter(x => new RegExp('(^|\\D)' + set + '(\\D|$)').test(x.title || '')).map(x => ({
        seller: 'eBay' + (x.seller?.username ? ' - ' + x.seller.username : ''),
        price: Number(x.price?.value),
        shipping: Number(x.shippingOptions?.[0]?.shippingCost?.value ?? 0),
        condition: x.condition === 'New' ? 'new' : 'used',
        box: 'unknown',
        url: x.itemWebUrl
      })).filter(x => Number.isFinite(x.price) && Number.isFinite(x.shipping) && x.url?.startsWith('https://'));
      return Response.json({ offers }, { headers });
    } catch (error) {
      return Response.json({ offers: [], error: error.message }, { status: 502, headers });
    }
  }
};
