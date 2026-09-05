"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
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
import type { GoogleCalendarInfo, Person, PublicConfig } from "@/lib/types";

export function SettingsClient() {
  const params = useSearchParams();
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
        weather: {
          latitude: Number(latitude),
          longitude: Number(longitude),
          timezone,
          locationLabel,
          temperatureUnit: unit,
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

  async function disconnect() {
    await fetch("/api/auth/google/logout", { method: "POST" });
    toast.success("Google disconnected");
    setCalendars([]);
    await loadConfig();
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
          <div key={person.id} className="grid gap-2 sm:grid-cols-[8rem_1fr]">
            <Label className="self-center">{person.name}</Label>
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
          </div>
        ))}
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
