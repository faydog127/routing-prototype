const apiKeyInput = document.getElementById("apiKey");
const rememberKeyInput = document.getElementById("rememberKey");
const originInput = document.getElementById("origin");
const destinationInput = document.getElementById("destination");
const stopsInput = document.getElementById("stops");
const travelModeInput = document.getElementById("travelMode");
const routingPreferenceInput = document.getElementById("routingPreference");
const unitsInput = document.getElementById("units");
const roundTripInput = document.getElementById("roundTrip");
const avoidTollsInput = document.getElementById("avoidTolls");
const avoidHighwaysInput = document.getElementById("avoidHighways");
const avoidFerriesInput = document.getElementById("avoidFerries");
const optimizeBtn = document.getElementById("optimizeBtn");
const clearBtn = document.getElementById("clearBtn");
const statusEl = document.getElementById("status");
const summaryEl = document.getElementById("summary");
const orderEl = document.getElementById("order");
const legsEl = document.getElementById("legs");
const rawOutputEl = document.getElementById("rawOutput");

const STORAGE_KEY = "routing-prototype-api-key";
const DEFAULT_CENTER = { lat: 28.5383, lng: -81.3792 };

let mapsPromise;
let map;
let routePolyline;
let markers = [];

function loadRememberedKey() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    apiKeyInput.value = stored;
    rememberKeyInput.checked = true;
  }
}

function setStatus(message, tone = "neutral") {
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
}

function parseStops(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function formatDistance(meters, units) {
  if (meters == null) return "—";
  if (units === "METRIC") {
    const km = meters / 1000;
    return `${km.toFixed(km < 10 ? 2 : 1)} km`;
  }
  const miles = meters / 1609.344;
  return `${miles.toFixed(miles < 10 ? 2 : 1)} mi`;
}

function parseDurationSeconds(duration) {
  if (!duration) return null;
  if (typeof duration === "number") return duration;
  const match = duration.match(/([\d.]+)s/);
  if (!match) return null;
  return Number(match[1]);
}

function formatDuration(duration) {
  const seconds = parseDurationSeconds(duration);
  if (seconds == null) return "—";
  const minutesTotal = Math.round(seconds / 60);
  const hours = Math.floor(minutesTotal / 60);
  const minutes = minutesTotal % 60;
  if (hours === 0) return `${minutes} min`;
  return `${hours} hr ${minutes} min`;
}

function formatLocalized(value, fallback) {
  if (value && value.text) return value.text;
  return fallback;
}

function clearOutput() {
  summaryEl.innerHTML = "";
  orderEl.innerHTML = "";
  legsEl.innerHTML = "";
  rawOutputEl.textContent = "{}";
}

function loadMapsScript(apiKey) {
  if (window.google && window.google.maps) {
    return Promise.resolve();
  }
  if (mapsPromise) return mapsPromise;

  mapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const encodedKey = encodeURIComponent(apiKey);
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodedKey}&v=weekly&libraries=geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Failed to load the Maps JavaScript API."));
    document.head.appendChild(script);
  });

  return mapsPromise;
}

function ensureMap(center) {
  if (!map) {
    map = new google.maps.Map(document.getElementById("map"), {
      center: center || DEFAULT_CENTER,
      zoom: 7,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });
  } else if (center) {
    map.setCenter(center);
  }
}

function clearMap() {
  if (routePolyline) {
    routePolyline.setMap(null);
    routePolyline = null;
  }
  markers.forEach((marker) => marker.setMap(null));
  markers = [];
}

function locationToLatLng(location) {
  const latLng = location?.latLng;
  if (!latLng) return null;
  return { lat: latLng.latitude, lng: latLng.longitude };
}

function renderRouteOnMap(route, sequence) {
  const encodedPolyline = route?.polyline?.encodedPolyline;
  if (!encodedPolyline) return;

  const path = google.maps.geometry.encoding.decodePath(encodedPolyline);
  if (!path.length) return;

  ensureMap(path[0]);
  clearMap();

  routePolyline = new google.maps.Polyline({
    path,
    map,
    strokeColor: "#d05a33",
    strokeOpacity: 0.85,
    strokeWeight: 4,
  });

  const bounds = new google.maps.LatLngBounds();
  path.forEach((point) => bounds.extend(point));
  map.fitBounds(bounds, 48);

  const legs = route.legs || [];
  const markerPoints = [];

  legs.forEach((leg) => {
    const start = locationToLatLng(leg.startLocation);
    if (start) markerPoints.push(start);
  });

  const lastEnd = locationToLatLng(legs[legs.length - 1]?.endLocation);
  if (lastEnd) markerPoints.push(lastEnd);

  const labels = sequence.map((_, index) => {
    if (index === 0) return "O";
    if (index === sequence.length - 1) return "D";
    return String(index);
  });

  markerPoints.forEach((position, index) => {
    const label = labels[index] || "";
    const title = sequence[index] || "Stop";
    markers.push(
      new google.maps.Marker({
        position,
        map,
        label,
        title,
      })
    );
  });
}

async function optimizeRoute() {
  const apiKey = apiKeyInput.value.trim();
  const origin = originInput.value.trim();
  const isRoundTrip = roundTripInput.checked;
  const destinationInputValue = destinationInput.value.trim();
  const destination = isRoundTrip ? origin : destinationInputValue;
  const stops = parseStops(stopsInput.value);

  if (!apiKey) {
    setStatus("Add your Google Maps API key to continue.", "error");
    return;
  }
  if (!origin || !destination) {
    setStatus("Origin and destination are required.", "error");
    return;
  }

  if (rememberKeyInput.checked) {
    localStorage.setItem(STORAGE_KEY, apiKey);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }

  setStatus("Calling Routes API…", "working");
  clearOutput();

  const requestBody = {
    origin: { address: origin },
    destination: { address: destination },
    intermediates: stops.map((address) => ({ address })),
    travelMode: travelModeInput.value,
    routingPreference: routingPreferenceInput.value,
    optimizeWaypointOrder: stops.length > 1,
    units: unitsInput.value,
    routeModifiers: {
      avoidTolls: avoidTollsInput.checked,
      avoidHighways: avoidHighwaysInput.checked,
      avoidFerries: avoidFerriesInput.checked,
    },
  };

  const fieldMask = [
    "routes.distanceMeters",
    "routes.duration",
    "routes.localizedValues",
    "routes.optimizedIntermediateWaypointIndex",
    "routes.polyline.encodedPolyline",
    "routes.legs.distanceMeters",
    "routes.legs.duration",
    "routes.legs.localizedValues",
    "routes.legs.startLocation",
    "routes.legs.endLocation",
  ].join(",");

  try {
    const response = await fetch(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": fieldMask,
        },
        body: JSON.stringify(requestBody),
      }
    );

    const payload = await response.json();
    rawOutputEl.textContent = JSON.stringify(payload, null, 2);

    if (!response.ok) {
      const message =
        payload.error?.message || `Request failed (${response.status}).`;
      setStatus(message, "error");
      return;
    }

    const route = payload.routes && payload.routes[0];
    if (!route) {
      setStatus("No route returned. Check your inputs.", "error");
      return;
    }

    const totalDistance = formatLocalized(
      route.localizedValues?.distance,
      formatDistance(route.distanceMeters, unitsInput.value)
    );
    const totalDuration = formatLocalized(
      route.localizedValues?.duration,
      formatDuration(route.duration)
    );

    summaryEl.innerHTML = `
      <span>Total distance: ${totalDistance}</span>
      <span>Total duration: ${totalDuration}</span>
      <span>Stops: ${stops.length}</span>
    `;

    const optimizedIndex =
      route.optimizedIntermediateWaypointIndex ||
      stops.map((_, index) => index);

    const orderedStops = optimizedIndex.map((idx) => stops[idx]);
    const sequence = [origin, ...orderedStops, destination];

    orderEl.innerHTML = sequence
      .map((address, index) => {
        if (index === 0) {
          return `<div class="item"><strong>Origin</strong>: ${address}</div>`;
        }
        if (index === sequence.length - 1) {
          return `<div class="item"><strong>Destination</strong>: ${address}</div>`;
        }
        const originalIndex = optimizedIndex[index - 1];
        return `<div class="item"><strong>Stop ${index}</strong> (input #${
          originalIndex + 1
        }): ${address}</div>`;
      })
      .join("");

    const legs = route.legs || [];
    legsEl.innerHTML = legs
      .map((leg, index) => {
        const from = sequence[index];
        const to = sequence[index + 1];
        const distance = formatLocalized(
          leg.localizedValues?.distance,
          formatDistance(leg.distanceMeters, unitsInput.value)
        );
        const duration = formatLocalized(
          leg.localizedValues?.duration,
          formatDuration(leg.duration)
        );
        return `<div class="item"><strong>Leg ${
          index + 1
        }</strong>: ${from} → ${to}<br/>${distance} • ${duration}</div>`;
      })
      .join("");

    try {
      await loadMapsScript(apiKey);
      renderRouteOnMap(route, sequence);
    } catch (mapError) {
      setStatus(`${mapError.message} Route details are still available.`, "error");
      return;
    }

    setStatus("Route optimized successfully.", "success");
  } catch (error) {
    setStatus(`Request failed: ${error.message}`, "error");
  }
}

optimizeBtn.addEventListener("click", optimizeRoute);
clearBtn.addEventListener("click", () => {
  originInput.value = "";
  destinationInput.value = "";
  stopsInput.value = "";
  roundTripInput.checked = false;
  clearOutput();
  clearMap();
  setStatus("Cleared.", "neutral");
});

loadRememberedKey();
