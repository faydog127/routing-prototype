# Route Optimizer Prototype (Today)

This is a tiny standalone prototype that optimizes stop order for a single driver,
renders the route on a map, and can optionally call the Routes API through a backend
proxy so the routing key is not exposed in the browser.

## Setup

1. Enable the **Routes API** and **Maps JavaScript API** in your Google Cloud project.
2. Create a **Maps JavaScript API** key and restrict it by HTTP referrer.
3. Run a local web server from this folder.
4. Open the browser and paste your key (or set `mapsApiKey` in `config.js`).

## Run locally

From `c:\BHFOS\routing-prototype`:

```powershell
python -m http.server 8080
```

Then open:

```
http://localhost:8080
```

## Backend Proxy (Recommended)

The routing requests can be proxied through a Supabase Edge Function so the Routes API
key is never exposed in the browser.

1. Deploy the functions:

```powershell
cd c:\BHFOS\command-center
supabase functions deploy routes-proxy
supabase functions deploy zones-proxy
```

2. Set secrets (in Supabase Dashboard or CLI):

```powershell
supabase secrets set GOOGLE_MAPS_API_KEY=YOUR_ROUTES_API_KEY
```

3. Update `config.js` to point to your function URLs and (optionally) set
   `mapsApiKey` for the map renderer.

## Notes

- Waypoint optimization requires **Routes API** and is billed under the
  ComputeRoutes Advanced SKU.

## Supabase Zones (Optional)

If you want zone and property selection:

1. Use the **Load zones** button (preferred) if `zones-proxy` is configured.
2. Or, enter the **Supabase URL** and **anon key** (public key) manually.
3. Select one or more zones and use **Replace stops** or **Append stops**.

This assumes `zones` and `properties` tables are readable with your anon key.
