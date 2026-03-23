# Route Optimizer Prototype (Today)

This is a tiny standalone prototype that calls the Google Maps Platform Routes API
directly from the browser. It optimizes the order of intermediate stops for a single
driver and summarizes the route.

## Setup

1. Enable the **Routes API** and **Maps JavaScript API** in your Google Cloud project.
2. Create an API key and restrict it.
3. Run a local web server from this folder.
4. Open the browser and paste your key.

## Run locally

From `c:\BHFOS\routing-prototype`:

```powershell
python -m http.server 8080
```

Then open:

```
http://localhost:8080
```

## Notes

- This prototype calls the API from the browser. For production, use a backend proxy
  to keep the key private.
- Waypoint optimization requires **Routes API** and is billed under the
  ComputeRoutes Advanced SKU.

## Supabase Zones (Optional)

If you want zone and property selection:

1. Use the **Supabase URL** and **anon key** (public key) from your project.
2. Click **Load zones** in the UI.
3. Select one or more zones and use **Replace stops** or **Append stops**.

This assumes `zones` and `properties` tables are readable with your anon key.
