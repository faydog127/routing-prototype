const apiKeyInput = document.getElementById("apiKey");
const rememberKeyInput = document.getElementById("rememberKey");
const originInput = document.getElementById("origin");
const destinationInput = document.getElementById("destination");
const stopsInput = document.getElementById("stops");
const supabaseUrlInput = document.getElementById("supabaseUrl");
const supabaseKeyInput = document.getElementById("supabaseKey");
const rememberSupabaseInput = document.getElementById("rememberSupabase");
const loadZonesBtn = document.getElementById("loadZonesBtn");
const supabaseStatusEl = document.getElementById("supabaseStatus");
const supabaseCredentialsEl = document.getElementById("supabaseCredentials");
const backendNoteEl = document.getElementById("backendNote");
const zoneSelect = document.getElementById("zoneSelect");
const replaceStopsBtn = document.getElementById("replaceStopsBtn");
const appendStopsBtn = document.getElementById("appendStopsBtn");
const propertySearchInput = document.getElementById("propertySearch");
const propertyResultsEl = document.getElementById("propertyResults");
const travelModeInput = document.getElementById("travelMode");
const routingPreferenceInput = document.getElementById("routingPreference");
const unitsInput = document.getElementById("units");
const serviceTimeInput = document.getElementById("serviceTime");
const departAtInput = document.getElementById("departAt");
const windowStartInput = document.getElementById("windowStart");
const windowEndInput = document.getElementById("windowEnd");
const roundTripInput = document.getElementById("roundTrip");
const avoidTollsInput = document.getElementById("avoidTolls");
const avoidHighwaysInput = document.getElementById("avoidHighways");
const avoidFerriesInput = document.getElementById("avoidFerries");
const optimizeBtn = document.getElementById("optimizeBtn");
const clearBtn = document.getElementById("clearBtn");
const openMapsBtn = document.getElementById("openMapsBtn");
const statusEl = document.getElementById("status");
const summaryEl = document.getElementById("summary");
const orderEl = document.getElementById("order");
const scheduleEl = document.getElementById("schedule");
const legsEl = document.getElementById("legs");
const rawOutputEl = document.getElementById("rawOutput");

const CONFIG = window.__ROUTE_CONFIG__ || {};
const APP_CONFIG = {
  routesProxyUrl: CONFIG.routesProxyUrl || "",
  zonesProxyUrl: CONFIG.zonesProxyUrl || "",
  mapsApiKey: CONFIG.mapsApiKey || "",
  supabaseUrl: CONFIG.supabaseUrl || "",
  autoLoadZones: CONFIG.autoLoadZones !== false,
};

const STORAGE_KEY = "routing-prototype-api-key";
const SUPABASE_URL_KEY = "routing-prototype-supabase-url";
const SUPABASE_KEY_KEY = "routing-prototype-supabase-anon";
const DEFAULT_CENTER = { lat: 28.5383, lng: -81.3792 };

let mapsPromise;
let map;
let routePolyline;
let markers = [];
let zones = [];
let properties = [];
let filteredProperties = [];
let mapsLinkUrl = "";

if (openMapsBtn) {
  openMapsBtn.disabled = true;
}

function loadRememberedKey() {
  if (APP_CONFIG.mapsApiKey) {
    apiKeyInput.value = APP_CONFIG.mapsApiKey;
    apiKeyInput.disabled = true;
    rememberKeyInput.checked = false;
    rememberKeyInput.disabled = true;
    return;
  }

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    apiKeyInput.value = stored;
    rememberKeyInput.checked = true;
  }
}

function loadRememberedSupabase() {
  if (APP_CONFIG.zonesProxyUrl) {
    if (supabaseCredentialsEl) supabaseCredentialsEl.classList.add("hidden");
    if (backendNoteEl) backendNoteEl.classList.remove("hidden");
    rememberSupabaseInput.checked = false;
    rememberSupabaseInput.disabled = true;
    setSupabaseStatus("Backend proxy ready. Click Load zones.", "neutral");
    return;
  }

  const storedUrl = localStorage.getItem(SUPABASE_URL_KEY);
  const storedKey = localStorage.getItem(SUPABASE_KEY_KEY);
  if (storedUrl) {
    supabaseUrlInput.value = storedUrl;
  }
  if (storedKey) {
    supabaseKeyInput.value = storedKey;
  }
  if (storedUrl && storedKey) {
    rememberSupabaseInput.checked = true;
  }

  if (!storedUrl && APP_CONFIG.supabaseUrl) {
    supabaseUrlInput.value = APP_CONFIG.supabaseUrl;
  }
}

function setStatus(message, tone = "neutral") {
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
}

function setSupabaseStatus(message, tone = "neutral") {
  supabaseStatusEl.textContent = message;
  supabaseStatusEl.dataset.tone = tone;
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

function parseMinutesInput(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.round(num);
}

function parseTimeValue(value) {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function parseDateTimeLocal(value) {
  if (!value) return null;
  const [datePart, timePart] = value.split("T");
  if (!datePart || !timePart) return null;
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes] = timePart.split(":").map(Number);
  if ([year, month, day, hours, minutes].some(Number.isNaN)) return null;
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

function formatTime(date) {
  if (!date) return "—";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDateTime(date) {
  if (!date) return "—";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isWithinWindow(date, windowStartMinutes, windowEndMinutes) {
  if (windowStartMinutes == null || windowEndMinutes == null || !date) return true;
  const minutes = date.getHours() * 60 + date.getMinutes();
  if (windowStartMinutes <= windowEndMinutes) {
    return minutes >= windowStartMinutes && minutes <= windowEndMinutes;
  }
  return minutes >= windowStartMinutes || minutes <= windowEndMinutes;
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
  scheduleEl.innerHTML = "";
  legsEl.innerHTML = "";
  rawOutputEl.textContent = "{}";
  mapsLinkUrl = "";
  if (openMapsBtn) {
    openMapsBtn.disabled = true;
  }
}

function normalizeSupabaseUrl(url) {
  return url.replace(/\/+$/, "");
}

async function fetchSupabaseJson(path, supabaseUrl, supabaseKey) {
  const baseUrl = normalizeSupabaseUrl(supabaseUrl);
  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Supabase request failed (${response.status}).`);
  }
  return response.json();
}

function populateZones() {
  zoneSelect.innerHTML = "";
  zones.forEach((zone) => {
    const option = document.createElement("option");
    option.value = zone.id;
    option.textContent = zone.zone_name;
    zoneSelect.appendChild(option);
  });
}

function getSelectedZoneIds() {
  return Array.from(zoneSelect.selectedOptions)
    .map((option) => Number(option.value))
    .filter((value) => !Number.isNaN(value));
}

function propertyToAddress(property) {
  const line1 = property.address_line_1 || "";
  const city = property.city || "";
  const state = property.state || "";
  const zip = property.zip || "";
  const cityState = [city, state].filter(Boolean).join(", ");
  const tail = cityState ? `${cityState}${zip ? ` ${zip}` : ""}` : zip;
  return [line1, tail].filter(Boolean).join(", ");
}

function filterPropertiesByZones() {
  const selectedZoneIds = getSelectedZoneIds();
  if (selectedZoneIds.length === 0) {
    filteredProperties = properties.slice();
  } else {
    filteredProperties = properties.filter((property) =>
      selectedZoneIds.includes(property.zone_id)
    );
  }
  renderPropertyResults(propertySearchInput.value.trim());
}

function replaceStopsWithAddresses(addresses) {
  if (!addresses.length) {
    setSupabaseStatus("No properties found for the selected zones.", "error");
    return;
  }
  stopsInput.value = addresses.join("\n");
}

function appendStopsWithAddresses(addresses) {
  if (!addresses.length) {
    setSupabaseStatus("No properties found for the selected zones.", "error");
    return;
  }
  const existing = parseStops(stopsInput.value);
  const existingSet = new Set(existing.map((addr) => addr.toLowerCase()));
  addresses.forEach((address) => {
    const key = address.toLowerCase();
    if (!existingSet.has(key)) {
      existing.push(address);
      existingSet.add(key);
    }
  });
  stopsInput.value = existing.join("\n");
}

function getZoneAddresses() {
  const selectedZoneIds = getSelectedZoneIds();
  if (selectedZoneIds.length === 0) return [];
  return properties
    .filter((property) => selectedZoneIds.includes(property.zone_id))
    .map(propertyToAddress)
    .filter(Boolean);
}

function renderPropertyResults(searchTerm) {
  propertyResultsEl.innerHTML = "";
  if (!properties.length) {
    propertyResultsEl.innerHTML =
      '<div class="hint">Load zones to enable search.</div>';
    return;
  }

  const term = searchTerm.toLowerCase();
  let results = filteredProperties;
  if (term) {
    results = filteredProperties.filter((property) => {
      const name = property.property_name?.toLowerCase() || "";
      const address = propertyToAddress(property).toLowerCase();
      return name.includes(term) || address.includes(term);
    });
  }

  results.slice(0, 10).forEach((property) => {
    const address = propertyToAddress(property);
    const item = document.createElement("div");
    item.className = "result-item";

    const title = document.createElement("div");
    title.className = "result-title";
    title.textContent = property.property_name || "Unnamed property";

    const addressEl = document.createElement("div");
    addressEl.textContent = address || "No address on file";

    const actions = document.createElement("div");
    actions.className = "result-actions";

    const addBtn = document.createElement("button");
    addBtn.className = "ghost small";
    addBtn.textContent = "Add to stops";
    addBtn.addEventListener("click", () => {
      if (address) appendStopsWithAddresses([address]);
    });

    const onlyBtn = document.createElement("button");
    onlyBtn.className = "ghost small";
    onlyBtn.textContent = "Use only this stop";
    onlyBtn.addEventListener("click", () => {
      if (address) replaceStopsWithAddresses([address]);
    });

    actions.appendChild(addBtn);
    actions.appendChild(onlyBtn);

    item.appendChild(title);
    item.appendChild(addressEl);
    item.appendChild(actions);
    propertyResultsEl.appendChild(item);
  });

  if (results.length === 0) {
    propertyResultsEl.innerHTML =
      '<div class="hint">No matching properties found.</div>';
  }
}

async function loadSupabaseData() {
  setSupabaseStatus("Loading zones and properties...", "working");

  try {
    if (APP_CONFIG.zonesProxyUrl) {
      const response = await fetch(APP_CONFIG.zonesProxyUrl, {
        method: "GET",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load zones.");
      }
      zones = payload.zones || [];
      properties = payload.properties || [];
    } else {
      const supabaseUrl = supabaseUrlInput.value.trim();
      const supabaseKey = supabaseKeyInput.value.trim();

      if (!supabaseUrl || !supabaseKey) {
        setSupabaseStatus("Enter the Supabase URL and anon key.", "error");
        return;
      }

      if (rememberSupabaseInput.checked) {
        localStorage.setItem(SUPABASE_URL_KEY, supabaseUrl);
        localStorage.setItem(SUPABASE_KEY_KEY, supabaseKey);
      } else {
        localStorage.removeItem(SUPABASE_URL_KEY);
        localStorage.removeItem(SUPABASE_KEY_KEY);
      }

      zones = await fetchSupabaseJson(
        "zones?select=id,zone_name&order=zone_name.asc",
        supabaseUrl,
        supabaseKey
      );
      properties = await fetchSupabaseJson(
        "properties?select=property_name,address_line_1,city,state,zip,zone_id&is_active=eq.true&order=property_name.asc",
        supabaseUrl,
        supabaseKey
      );
    }
    populateZones();
    filterPropertiesByZones();
    setSupabaseStatus(
      `Loaded ${zones.length} zones and ${properties.length} properties.`,
      "success"
    );
  } catch (error) {
    setSupabaseStatus(error.message, "error");
  }
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

function buildMapsUrl(sequence, travelMode, avoids) {
  if (!sequence.length) return "";
  const origin = sequence[0];
  const destination = sequence[sequence.length - 1];
  const waypoints = sequence.slice(1, -1);
  const params = new URLSearchParams();
  params.set("api", "1");
  params.set("origin", origin);
  params.set("destination", destination);

  if (waypoints.length) {
    params.set("waypoints", waypoints.join("|"));
  }

  const modeMap = {
    DRIVE: "driving",
    TWO_WHEELER: "driving",
    BICYCLE: "bicycling",
    WALK: "walking",
    TRANSIT: "transit",
  };

  params.set("travelmode", modeMap[travelMode] || "driving");

  const avoidList = [];
  if (avoids.avoidTolls) avoidList.push("tolls");
  if (avoids.avoidHighways) avoidList.push("highways");
  if (avoids.avoidFerries) avoidList.push("ferries");
  if (avoidList.length) {
    params.set("avoid", avoidList.join("|"));
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function renderSchedule({
  sequence,
  legs,
  serviceMinutes,
  departAt,
  windowStartMinutes,
  windowEndMinutes,
}) {
  scheduleEl.innerHTML = "";

  if (!departAt) {
    return;
  }

  let currentTime = new Date(departAt.getTime());
  const items = [];
  const stopCount = sequence.length - 2;

  for (let i = 0; i < stopCount; i += 1) {
    const leg = legs[i];
    const legSeconds = parseDurationSeconds(leg?.duration) || 0;
    currentTime = new Date(currentTime.getTime() + legSeconds * 1000);
    const arrival = new Date(currentTime.getTime());
    const hasWindow =
      windowStartMinutes != null && windowEndMinutes != null;
    const withinWindow = hasWindow
      ? isWithinWindow(arrival, windowStartMinutes, windowEndMinutes)
      : true;
    const badgeClass = withinWindow ? "badge-inline" : "badge-inline warn";
    const badgeText = withinWindow ? "Within window" : "Outside window";

    const badgeHtml = hasWindow
      ? ` · <span class="${badgeClass}">${badgeText}</span>`
      : "";

    items.push(
      `<div class="item"><strong>Stop ${i + 1}</strong>: ${
        sequence[i + 1]
      }<div class="meta">ETA ${formatTime(arrival)}${badgeHtml}</div></div>`
    );

    currentTime = new Date(currentTime.getTime() + serviceMinutes * 60000);
  }

  const finalLeg = legs[legs.length - 1];
  const finalLegSeconds = parseDurationSeconds(finalLeg?.duration) || 0;
  const arriveDestination = new Date(
    currentTime.getTime() + finalLegSeconds * 1000
  );

  items.push(
    `<div class="item"><strong>Return</strong>: ${
      sequence[sequence.length - 1]
    }<div class="meta">ETA ${formatTime(arriveDestination)}</div></div>`
  );

  scheduleEl.innerHTML = items.join("");
}

async function optimizeRoute() {
  const mapApiKey = apiKeyInput.value.trim();
  const origin = originInput.value.trim();
  const isRoundTrip = roundTripInput.checked;
  const destinationInputValue = destinationInput.value.trim();
  const destination = isRoundTrip ? origin : destinationInputValue;
  const stops = parseStops(stopsInput.value);

  if (!origin || !destination) {
    setStatus("Origin and destination are required.", "error");
    return;
  }

  if (!mapApiKey) {
    setStatus("Add your Google Maps JS API key to display the map.", "error");
    return;
  }

  if (!APP_CONFIG.mapsApiKey) {
    if (rememberKeyInput.checked) {
      localStorage.setItem(STORAGE_KEY, mapApiKey);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  setStatus("Calling routing service…", "working");
  clearOutput();

  const travelMode = travelModeInput.value;
  const serviceMinutes = parseMinutesInput(serviceTimeInput.value);
  const departAt = parseDateTimeLocal(departAtInput.value);
  const windowStartMinutes = parseTimeValue(windowStartInput.value);
  const windowEndMinutes = parseTimeValue(windowEndInput.value);
  const proxyPayload = {
    origin,
    destination,
    stops,
    travelMode,
    routingPreference: routingPreferenceInput.value,
    optimizeWaypointOrder: stops.length > 1,
    units: unitsInput.value,
    avoidTolls: avoidTollsInput.checked,
    avoidHighways: avoidHighwaysInput.checked,
    avoidFerries: avoidFerriesInput.checked,
  };

  try {
    let response;

    if (APP_CONFIG.routesProxyUrl) {
      response = await fetch(APP_CONFIG.routesProxyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(proxyPayload),
      });
    } else {
      const requestBody = {
        origin: { address: origin },
        destination: { address: destination },
        intermediates: stops.map((address) => ({ address })),
        travelMode,
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

      response = await fetch(
        "https://routes.googleapis.com/directions/v2:computeRoutes",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": mapApiKey,
            "X-Goog-FieldMask": fieldMask,
          },
          body: JSON.stringify(requestBody),
        }
      );
    }

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

    const routeSeconds = parseDurationSeconds(route.duration) || 0;
    const serviceSeconds = serviceMinutes * 60 * stops.length;
    const totalWorkSeconds = routeSeconds + serviceSeconds;
    const finishAt = departAt
      ? new Date(departAt.getTime() + totalWorkSeconds * 1000)
      : null;

    summaryEl.innerHTML = `
      <span>Total distance: ${totalDistance}</span>
      <span>Total duration: ${totalDuration}</span>
      <span>Stops: ${stops.length}</span>
      ${
        serviceMinutes > 0
          ? `<span>Service time: ${serviceMinutes * stops.length} min</span>`
          : ""
      }
      ${
        serviceMinutes > 0
          ? `<span>Total work time: ${formatDuration(totalWorkSeconds)}</span>`
          : ""
      }
      ${departAt ? `<span>Depart: ${formatDateTime(departAt)}</span>` : ""}
      ${finishAt ? `<span>Finish: ${formatDateTime(finishAt)}</span>` : ""}
    `;

    const optimizedIndex =
      route.optimizedIntermediateWaypointIndex ||
      stops.map((_, index) => index);

    const orderedStops = optimizedIndex.map((idx) => stops[idx]);
    const sequence = [origin, ...orderedStops, destination];

    const avoids = {
      avoidTolls: avoidTollsInput.checked,
      avoidHighways: avoidHighwaysInput.checked,
      avoidFerries: avoidFerriesInput.checked,
    };
    mapsLinkUrl = buildMapsUrl(sequence, travelMode, avoids);
    if (openMapsBtn) {
      openMapsBtn.disabled = !mapsLinkUrl;
    }

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

    renderSchedule({
      sequence,
      legs,
      serviceMinutes,
      departAt,
      windowStartMinutes,
      windowEndMinutes,
    });

    try {
      await loadMapsScript(mapApiKey);
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
  serviceTimeInput.value = "";
  departAtInput.value = "";
  windowStartInput.value = "";
  windowEndInput.value = "";
  roundTripInput.checked = false;
  clearOutput();
  clearMap();
  setStatus("Cleared.", "neutral");
});

openMapsBtn.addEventListener("click", () => {
  if (mapsLinkUrl) {
    window.open(mapsLinkUrl, "_blank", "noopener");
  }
});

loadZonesBtn.addEventListener("click", loadSupabaseData);
zoneSelect.addEventListener("change", filterPropertiesByZones);
propertySearchInput.addEventListener("input", () =>
  renderPropertyResults(propertySearchInput.value.trim())
);
replaceStopsBtn.addEventListener("click", () =>
  replaceStopsWithAddresses(getZoneAddresses())
);
appendStopsBtn.addEventListener("click", () =>
  appendStopsWithAddresses(getZoneAddresses())
);

loadRememberedKey();
loadRememberedSupabase();
if (APP_CONFIG.autoLoadZones && APP_CONFIG.zonesProxyUrl) {
  loadSupabaseData();
}
