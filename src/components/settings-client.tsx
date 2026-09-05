"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useIdleDim } from "@/components/idle-dim";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { GoogleCalendarInfo, Person, PublicConfig, SlideshowPayload } from "@/lib/types";

export function SettingsClient() {
  const params = useSearchParams();
  const idle = useIdleDim();
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [pin, setPin] = useState("");
  const [locked, setLocked] = useState(false);
  const [calendars, setCalendars] = useState<GoogleCalendarInfo[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [familyName, setFamilyName] = useState("");
  const [homeName, setHomeName] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [timezone, setTimezone] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [unit, setUnit] = useState<"fahrenheit" | "celsius">("fahrenheit");
  const [origin, setOrigin] = useState("");
  const [idleTimeoutMs, setIdleTimeoutMs] = useState("180000");
  const [sleepDimPercent, setSleepDimPercent] = useState(78);
  const [sleepShowClock, setSleepShowClock] = useState(true);
  const [nightClockStart, setNightClockStart] = useState("22:00");
  const [nightClockEnd, setNightClockEnd] = useState("06:30");
  const [photoRotateSec, setPhotoRotateSec] = useState("45");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoUser, setPhotoUser] = useState("");
  const [photoPassword, setPhotoPassword] = useState("");
  const [photoAlbum, setPhotoAlbum] = useState("");
  const [photoQuery, setPhotoQuery] = useState("");
  const [passwordSet, setPasswordSet] = useState(false);
  const [testingPhotos, setTestingPhotos] = useState(false);
  const [zip, setZip] = useState("");
  const [lookingUpZip, setLookingUpZip] = useState(false);

  async function loadConfig() {
    const response = await fetch("/api/config", { cache: "no-store" });
    const data = (await response.json()) as PublicConfig;
    setConfig(data);
    setPeople(data.people);
    setFamilyName(data.familyName);
    setHomeName(data.homeName);
    setLatitude(String(data.weather.latitude));
    setLongitude(String(data.weather.longitude));
    setTimezone(data.weather.timezone);
    setLocationLabel(data.weather.locationLabel);
    setUnit(data.weather.temperatureUnit);
    setIdleTimeoutMs(String(data.idleTimeoutMs));
    setSleepDimPercent(data.sleepDimPercent);
    setSleepShowClock(data.sleepShowClock);
    setNightClockStart(data.nightClockStart);
    setNightClockEnd(data.nightClockEnd);
    setPhotoRotateSec(String(data.photoRotateSec));
    setPhotoUrl(data.photoPrism.url);
    setPhotoUser(data.photoPrism.username);
    setPhotoPassword("");
    setPhotoAlbum(data.photoPrism.albumUid);
    setPhotoQuery(data.photoPrism.query);
    setPasswordSet(data.photoPrism.passwordSet);
    setLocked(data.settingsPinRequired && !data.settingsUnlocked);
    return data;
  }

  async function loadCalendars() {
    const response = await fetch("/api/google/calendars", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setCalendars(data.calendars || []);
  }

  useEffect(() => {
    setOrigin(window.location.origin);
    void loadConfig().then((data) => {
      if (!data.settingsPinRequired && data.googleConnected) {
        void loadCalendars();
      }
    });
  }, []);

  useEffect(() => {
    if (params.get("connected") === "1") toast.success("Google Calendar is connected.");
    if (params.get("error") === "google-config") {
      toast.error("Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the server first.");
    }
    if (params.get("error") === "google-denied" || params.get("error") === "google-exchange") {
      toast.error("Google sign-in did not finish.");
    }
  }, [params]);

  async function unlock() {
    const response = await fetch("/api/settings/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    if (!response.ok) {
      toast.error("Wrong PIN");
      return;
    }
    setLocked(false);
    const data = await loadConfig();
    if (data.googleConnected) void loadCalendars();
  }

  async function save() {
    const response = await fetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        familyName,
        homeName,
        people,
        idleTimeoutMs: Number(idleTimeoutMs),
        sleepDimPercent,
        sleepShowClock,
        nightClockStart,
        nightClockEnd,
        photoRotateSec: Number(photoRotateSec),
        weather: {
          latitude: Number(latitude),
          longitude: Number(longitude),
          timezone,
          locationLabel,
          temperatureUnit: unit,
        },
        photoPrism: {
          url: photoUrl.trim(),
          username: photoUser.trim(),
          password: photoPassword,
          albumUid: photoAlbum.trim(),
          query: photoQuery.trim(),
        },
      }),
    });
    if (!response.ok) {
      toast.error("Could not save settings");
      return;
    }
    toast.success("Settings saved");
    await loadConfig();
  }

  async function lookupZip(rawZip = zip) {
    const value = rawZip.trim();
    if (!value) {
      toast.error("Enter a 5-digit US ZIP code");
      return;
    }
    setZip(value);
    setLookingUpZip(true);
    try {
      const response = await fetch(`/api/geo?zip=${encodeURIComponent(value)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "Could not look up that ZIP");
        return;
      }
      const nextWeather = {
        latitude: data.latitude,
        longitude: data.longitude,
        timezone: data.timezone,
        locationLabel: data.locationLabel,
        temperatureUnit: unit,
      };
      setLatitude(String(data.latitude));
      setLongitude(String(data.longitude));
      setTimezone(data.timezone);
      setLocationLabel(data.locationLabel);
      if (data.postalCode) setZip(data.postalCode);
      const persist = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weather: nextWeather }),
      });
      if (!persist.ok) {
        toast.success(`Filled ${data.locationLabel}. Save settings to update the board.`);
        return;
      }
      toast.success(`Weather is now ${data.locationLabel}`);
    } catch {
      toast.error("ZIP lookup failed");
    } finally {
      setLookingUpZip(false);
    }
  }

  function addPerson() {
    const n = people.length + 1;
    setPeople((current) => [
      ...current,
      {
        id: `person-${Date.now()}`,
        name: `Person ${n}`,
        color: n % 2 === 0 ? "#6B5B95" : "#3B6FDB",
        calendarId: "",
      },
    ]);
  }

  async function disconnect() {
    await fetch("/api/auth/google/logout", { method: "POST" });
    toast.success("Google disconnected");
    setCalendars([]);
    await loadConfig();
  }

  async function testPhotos() {
    setTestingPhotos(true);
    try {
      const response = await fetch("/api/photos/slideshow?force=1", { cache: "no-store" });
      const data = (await response.json()) as SlideshowPayload;
      if (!data.configured) {
        toast.error("Save a PhotoPrism URL first.");
        return;
      }
      if (data.error && data.photos.length === 0) {
        toast.error(data.error);
        return;
      }
      toast.success(
        data.photos.length
          ? `PhotoPrism is reachable — ${data.photos.length} photos ready to cycle.`
          : "Signed in, but PhotoPrism returned no photos for that album or search.",
      );
    } catch {
      toast.error("Could not reach the PhotoPrism proxy.");
    } finally {
      setTestingPhotos(false);
    }
  }

  if (!config) {
    return <div className="flex flex-1 items-center justify-center text-muted-foreground">Loading settings…</div>;
  }

  if (locked) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <h1 className="text-3xl font-semibold">Settings PIN</h1>
        <Input
          type="password"
          inputMode="numeric"
          className="h-14 w-48 text-center text-2xl tracking-[0.4em]"
          value={pin}
          onChange={(event) => setPin(event.target.value)}
        />
        <Button className="h-12 w-48 text-base" onClick={() => void unlock()}>
          Unlock
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 pb-10">
      <header>
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Household</p>
        <h1 className="text-3xl font-semibold">Settings</h1>
      </header>

      <section className="glass space-y-3 rounded-2xl p-4">
        <h2 className="text-xl font-medium">Google Calendar</h2>
        {config.googleConnected ? (
          <p className="text-muted-foreground">
            Connected as {config.googleEmail || "the household Google account"}. Assign each person a
            calendar so wall taps write to the right place.
          </p>
        ) : (
          <p className="text-muted-foreground">
            Open this page on a phone ({origin || "this kiosk URL"}) and tap connect. Google&apos;s
            sign-in is awkward on a wall panel. Until then, the week view uses sample events you can
            still add, edit, and delete locally.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <a href="/api/auth/google">
            <Button className="h-12 text-base" type="button">
              {config.googleConnected ? "Reconnect Google" : "Connect Google"}
            </Button>
          </a>
          {config.googleConnected && (
            <Button variant="secondary" className="h-12 text-base" onClick={() => void disconnect()}>
              Disconnect
            </Button>
          )}
        </div>
        {people.map((person, index) => (
          <div key={person.id} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem_auto]">
            <Input
              className="h-12 text-base"
              value={person.name}
              onChange={(event) =>
                setPeople((current) =>
                  current.map((item, i) => (i === index ? { ...item, name: event.target.value } : item)),
                )
              }
              aria-label="Person name"
            />
            <Select
              value={person.calendarId || "__none__"}
              onValueChange={(value) => {
                const calendarId = String(value) === "__none__" ? "" : String(value);
                setPeople((current) =>
                  current.map((item, i) => (i === index ? { ...item, calendarId } : item)),
                );
              }}
            >
              <SelectTrigger className="h-12 w-full min-h-12">
                <SelectValue placeholder="Choose a calendar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Not assigned</SelectItem>
                {calendars.map((calendar) => (
                  <SelectItem key={calendar.id} value={calendar.id}>
                    {calendar.summary}
                    {calendar.primary ? " (primary)" : ""}
                  </SelectItem>
                ))}
                {person.calendarId && !calendars.some((cal) => cal.id === person.calendarId) && (
                  <SelectItem value={person.calendarId}>{person.calendarId}</SelectItem>
                )}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={person.color}
                onChange={(event) =>
                  setPeople((current) =>
                    current.map((item, i) => (i === index ? { ...item, color: event.target.value } : item)),
                  )
                }
                className="size-12 cursor-pointer rounded-xl border border-white/15 bg-transparent p-1"
                aria-label={`${person.name} color`}
              />
              {people.length > 1 && (
                <Button
                  type="button"
                  variant="secondary"
                  className="h-12"
                  onClick={() => setPeople((current) => current.filter((_, i) => i !== index))}
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
        ))}
        <Button type="button" variant="secondary" className="h-12 text-base" onClick={addPerson}>
          Add person
        </Button>
      </section>

      <section className="glass space-y-3 rounded-2xl p-4">
        <h2 className="text-xl font-medium">Family and weather</h2>
        <div className="space-y-2">
          <Label htmlFor="home">Home name</Label>
          <Input id="home" className="h-12 text-base" value={homeName} onChange={(e) => setHomeName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="family">Family name</Label>
          <Input id="family" className="h-12 text-base" value={familyName} onChange={(e) => setFamilyName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="zip">US ZIP code</Label>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const typed = String(new FormData(event.currentTarget).get("zip") || "");
              void lookupZip(typed);
            }}
          >
            <Input
              id="zip"
              name="zip"
              className="h-12 min-w-[8rem] flex-1 text-base"
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="55374"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
            />
            <Button type="submit" variant="secondary" className="h-12 text-base" disabled={lookingUpZip}>
              {lookingUpZip ? "Looking up…" : "Fill from ZIP"}
            </Button>
          </form>
          <p className="text-sm text-muted-foreground">
            Looks up city, coordinates, and timezone, then refreshes the kitchen forecast.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="lat">Latitude</Label>
            <Input id="lat" className="h-12 text-base" value={latitude} onChange={(e) => setLatitude(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lon">Longitude</Label>
            <Input id="lon" className="h-12 text-base" value={longitude} onChange={(e) => setLongitude(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tz">Timezone</Label>
          <Input id="tz" className="h-12 text-base" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="label">Weather label</Label>
          <Input
            id="label"
            className="h-12 text-base"
            value={locationLabel}
            onChange={(e) => setLocationLabel(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Units</Label>
          <Select value={unit} onValueChange={(value) => setUnit(value as "fahrenheit" | "celsius")}>
            <SelectTrigger className="h-12 w-full min-h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fahrenheit">Fahrenheit</SelectItem>
              <SelectItem value="celsius">Celsius</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="glass space-y-4 rounded-2xl p-4">
        <h2 className="text-xl font-medium">Sleep and dim</h2>
        <p className="text-muted-foreground">
          After the wall sits unused, the dashboard fades so the background can keep cycling. Tap
          anywhere to wake it. At night the timeout shortens automatically.
        </p>
        <div className="space-y-2">
          <Label>Idle timeout</Label>
          <Select value={idleTimeoutMs} onValueChange={(value) => setIdleTimeoutMs(String(value))}>
            <SelectTrigger className="h-12 w-full min-h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30000">30 seconds</SelectItem>
              <SelectItem value="60000">1 minute</SelectItem>
              <SelectItem value="180000">3 minutes</SelectItem>
              <SelectItem value="300000">5 minutes</SelectItem>
              <SelectItem value="600000">10 minutes</SelectItem>
              <SelectItem value="0">Never — stay awake</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="dim">Sleep dim · {sleepDimPercent}%</Label>
          <input
            id="dim"
            type="range"
            min={40}
            max={95}
            value={sleepDimPercent}
            onChange={(event) => setSleepDimPercent(Number(event.target.value))}
            className="h-8 w-full accent-white"
          />
          <p className="text-sm text-muted-foreground">
            Lower keeps PhotoPrism photos visible behind the clock. Higher is closer to a black sleep
            screen.
          </p>
        </div>
        <label className="flex min-h-12 items-center justify-between gap-4 rounded-xl bg-white/5 px-3">
          <span>Show the night clock</span>
          <Switch checked={sleepShowClock} onCheckedChange={setSleepShowClock} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="night-start">Night starts</Label>
            <Input
              id="night-start"
              type="time"
              className="h-12 text-base"
              value={nightClockStart}
              onChange={(event) => setNightClockStart(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="night-end">Night ends</Label>
            <Input
              id="night-end"
              type="time"
              className="h-12 text-base"
              value={nightClockEnd}
              onChange={(event) => setNightClockEnd(event.target.value)}
            />
          </div>
        </div>
        <Button variant="secondary" className="h-12 text-base" type="button" onClick={() => idle.dimNow()}>
          Dim now
        </Button>
      </section>

      <section className="glass space-y-3 rounded-2xl p-4">
        <h2 className="text-xl font-medium">PhotoPrism background</h2>
        <p className="text-muted-foreground">
          When a server URL is saved, the wall cycles random photos behind the glass cards. Leave it
          blank to keep the scenic wallpaper. Credentials stay on the home server; the kiosk only
          sees proxied images.
        </p>
        <div className="space-y-2">
          <Label htmlFor="pp-url">PhotoPrism URL</Label>
          <Input
            id="pp-url"
            className="h-12 text-base"
            placeholder="http://192.168.1.10:2342"
            value={photoUrl}
            onChange={(event) => setPhotoUrl(event.target.value)}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="pp-user">Username</Label>
            <Input
              id="pp-user"
              className="h-12 text-base"
              value={photoUser}
              onChange={(event) => setPhotoUser(event.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pp-pass">Password or app password</Label>
            <Input
              id="pp-pass"
              type="password"
              className="h-12 text-base"
              placeholder={passwordSet ? "Unchanged" : "Optional if the library is public"}
              value={photoPassword}
              onChange={(event) => setPhotoPassword(event.target.value)}
              autoComplete="new-password"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pp-album">Album UID (optional)</Label>
          <Input
            id="pp-album"
            className="h-12 text-base"
            placeholder="atkwzfah1bh8tz5w"
            value={photoAlbum}
            onChange={(event) => setPhotoAlbum(event.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Use the id from the PhotoPrism album URL, for example{" "}
            <span className="text-foreground">atkwzfah1bh8tz5w</span> in
            /library/albums/atkwzfah1bh8tz5w/view. A full URL is also accepted.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pp-query">Search filter (optional)</Label>
          <Input
            id="pp-query"
            className="h-12 text-base"
            placeholder="favorite:true quality:5"
            value={photoQuery}
            onChange={(event) => setPhotoQuery(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>How often photos change</Label>
          <Select value={photoRotateSec} onValueChange={(value) => setPhotoRotateSec(String(value))}>
            <SelectTrigger className="h-12 w-full min-h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="20">Every 20 seconds</SelectItem>
              <SelectItem value="45">Every 45 seconds</SelectItem>
              <SelectItem value="60">Every minute</SelectItem>
              <SelectItem value="120">Every 2 minutes</SelectItem>
              <SelectItem value="300">Every 5 minutes</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="secondary"
          className="h-12 text-base"
          type="button"
          disabled={testingPhotos}
          onClick={() => void testPhotos()}
        >
          {testingPhotos ? "Checking PhotoPrism…" : "Test PhotoPrism"}
        </Button>
      </section>

      <section className="glass space-y-3 rounded-2xl p-4">
        <h2 className="text-xl font-medium">Mealie</h2>
        <p className="text-muted-foreground">
          {config.mealieConfigured
            ? `Pulling the meal plan from ${config.mealieOpenUrl}.`
            : "Set MEALIE_URL and MEALIE_TOKEN in the server environment. Until then, meals and recipes stay on demo data."}
        </p>
      </section>

      <Button className="h-12 text-base" onClick={() => void save()}>
        Save settings
      </Button>
    </div>
  );
}
