export type GeoLookup = {
  latitude: number;
  longitude: number;
  timezone: string;
  locationLabel: string;
  postalCode: string;
};

function cleanZip(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 5) return digits;
  if (digits.length === 9) return digits.slice(0, 5);
  return "";
}

export async function lookupUsZip(zip: string): Promise<GeoLookup> {
  const postalCode = cleanZip(zip);
  if (!postalCode) {
    throw new Error("Enter a 5-digit US ZIP code");
  }
  const zipResponse = await fetch(`https://api.zippopotam.us/us/${postalCode}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (zipResponse.status === 404) {
    throw new Error(`ZIP ${postalCode} was not found`);
  }
  if (!zipResponse.ok) {
    throw new Error("ZIP lookup failed");
  }
  const data = (await zipResponse.json()) as {
    "post code"?: string;
    places?: Array<{
      latitude: string;
      longitude: string;
      "place name": string;
      "state abbreviation": string;
    }>;
  };
  const place = data.places?.[0];
  if (!place) {
    throw new Error(`ZIP ${postalCode} was not found`);
  }
  const latitude = Number(place.latitude);
  const longitude = Number(place.longitude);
  const locationLabel = `${place["place name"]}, ${place["state abbreviation"]}`;
  const forecast = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&timezone=auto`,
    { cache: "no-store", signal: AbortSignal.timeout(8000) },
  );
  const forecastJson = (await forecast.json()) as { timezone?: string };
  return {
    latitude,
    longitude,
    timezone: forecastJson.timezone || "America/Chicago",
    locationLabel,
    postalCode,
  };
}
