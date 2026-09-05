# Household

A touch-first family wall dashboard: a week calendar with two-way Google Calendar, this week's Mealie meal plan, and a weather strip. It is meant to live on a 15.6" kitchen panel driven by a Raspberry Pi Zero 2 W or Banana Pi M2 Zero.

The Pi is a **kiosk**. The app runs on the home server that already hosts Mealie. That is the only arrangement that fits 512MB of RAM plus a 1080p touchscreen.

## What you get

- Week grid, color-coded by person, tap to add/edit/delete events
- Google OAuth on the server (tokens never touch the browser)
- Open-Meteo weather (no API key)
- Mealie meal plan + recipe search through the Mealie API
- An "Open Mealie" page with a back bar for shopping lists and planning
- Demo data when Google or Mealie are not configured, so you can try the wall UI first
- Idle dim / night clock, kiosk install scripts, Docker Compose for the server

## Run on the home server

```bash
cp .env.example .env
# edit .env — Mealie token, Google OAuth, weather coordinates
docker compose up --build -d
```

The dashboard listens on port **3847**. Point a browser at `http://<server-ip>:3847`.

Without Docker:

```bash
npm install
cp .env.example .env
npm run dev    # http://0.0.0.0:43123
# or
npm run build && npm start   # http://0.0.0.0:3847
```

## Google Calendar (two-way)

1. Create a Google Cloud project and enable the **Google Calendar API**.
2. Configure an OAuth consent screen (External is fine for a family; add your Google accounts as testers).
3. Create an OAuth client of type **Web application**.
4. Add the authorized redirect URI:

   `http://<server-ip>:3847/api/auth/google/callback`

5. Put the client ID and secret in `.env`, along with `APP_URL` / `GOOGLE_REDIRECT_URI`.
6. On a **phone on the LAN**, open Settings on the dashboard and tap **Connect Google**. Sign in with the household Google account (or one account that has the family calendars shared to it).
7. Assign each person a calendar, then Save.

Sync runs about every five minutes. Edits from the wall write through the Calendar API immediately.

Until Google is connected, the week is filled with sample events you can still add, edit, and delete locally.

## Mealie

Create a token at `/user/profile/api-tokens` on your Mealie instance.

```
MEALIE_URL=http://192.168.1.10:9925
MEALIE_TOKEN=...
MEALIE_GROUP_SLUG=home
```

The wall pulls `GET /api/households/mealplans` and `GET /api/recipes`. Recipe photos are proxied so the token stays on the server. Full Mealie (shopping lists, importing, planning) is the Open Mealie button — a webpage with a back bar, not a second recipe app.

## Weather

Open-Meteo is used by default. Set latitude, longitude, timezone, and `fahrenheit` or `celsius` in `.env` or Settings. If the forecast request fails, the last cached (or demo) forecast stays on screen.

## Kiosk (Pi Zero 2 / Banana Pi M2 Zero)

Do not run this Node app on the 512MB board.

Wiring:

- Mini-HDMI → HDMI for video
- Micro-USB OTG + powered hub for USB touch
- Monitor on its **own** power supply

On the Pi:

```bash
HOUSEHOLD_URL=http://<home-server-ip>:3847 ./deploy/kiosk/install.sh
sudo reboot
```

Details are in [deploy/kiosk/README.md](deploy/kiosk/README.md). Raspberry Pi Zero 2 W with Raspberry Pi OS is the smoother path. Banana Pi M2 Zero v1.0 works on Armbian; use the external Wi-Fi antenna.

If Chromium is too heavy, install Cog (WPE WebKit). The kiosk launcher will use it.

## LAN only

This is a kitchen appliance, not a public website. Do not forward port 3847. Optional `SETTINGS_PIN` locks the Settings page.

## ESP32

Not used. A 15.6" HDMI panel needs a Pi-class board. Keep the ESP32s for a later sensor if you want indoor temperature on the strip.
