# Household

A touch-first family wall dashboard: a week calendar with two-way Google Calendar, this week's Mealie meal plan, and a weather strip. It is meant to live on a 15.6" kitchen panel driven by a Raspberry Pi Zero 2 (or Zero 2 W) or Banana Pi M2 Zero.

The Pi is a **kiosk**. The app runs on the home server that already hosts Mealie. That is the only arrangement that fits 512MB of RAM plus a 1080p touchscreen.

**Setup is in this README** (home server, Google, Mealie, PhotoPrism). **Pi imaging and “show only this app”** is in [deploy/kiosk/README.md](deploy/kiosk/README.md): Raspberry Pi OS Lite (64-bit) on a Zero 2 / Zero 2 W, then `install.sh`.

## What you get

- Week grid, color-coded by person, tap to add/edit/delete events
- Google OAuth on the server (tokens never touch the browser)
- Open-Meteo weather (no API key)
- Mealie meal plan + recipe search through the Mealie API
- An "Open Mealie" page with a back bar for shopping lists and planning
- Demo data when Google or Mealie are not configured, so you can try the wall UI first
- Idle dim / night clock, optional PhotoPrism background slideshow, kiosk install scripts, Docker Compose for the server

## Run on the home server

```bash
cp .env.example .env
# edit .env — Mealie token, Google OAuth, weather coordinates
docker compose up --build -d
```

The dashboard listens on port **3847**. Point a browser at `http://<server-ip>:3847`.

Without Docker, on a **2 GB / 4 GB swap** LXC. Do not run a full `next build` on 1 GB — typecheck + webpack together will OOM. After `git pull`:

```bash
chmod +x deploy/lxc-setup.sh
./deploy/lxc-setup.sh
npm start   # http://0.0.0.0:3847
```

That script installs packages, then compiles with `npm run build:lxc` (skips TypeScript, one webpack worker, 1 GB heap). Raise swap on the Proxmox host if it still dies:

```bash
pct set <CTID> --memory 2048 --swap 4096
```

## Google Calendar (two-way)

Google will **not** accept a LAN IP as the OAuth redirect (`192.168.x.x`, `.local`, etc.). Redirect URIs must be a public domain on HTTPS, except **localhost / 127.0.0.1**, which may use HTTP. Keep the OAuth consent screen on **Testing** (Production rejects localhost).

Do the one-time Google sign-in through an SSH tunnel from a laptop, then leave the Pi on the LAN URL.

1. Create a Google Cloud project and enable the **Google Calendar API**.
2. Configure an OAuth consent screen (External is fine for a family; add your Google accounts as testers). Publishing status: **Testing**.
3. Create an OAuth client of type **Web application**.
4. Authorized redirect URI (exact, no LAN IP):

   `http://127.0.0.1:3847/api/auth/google/callback`

5. In `.env` on the LXC:

   ```
   APP_URL=http://<lxc-lan-ip>:3847
   GOOGLE_REDIRECT_URI=http://127.0.0.1:3847/api/auth/google/callback
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   ```

   Restart the app.
6. From a laptop on the LAN:

   ```bash
   ssh -L 3847:127.0.0.1:3847 <user>@<lxc-lan-ip>
   ```

   Open **http://127.0.0.1:3847/settings** (not the LAN IP) and tap **Connect Google**. Sign in with the household Google account (or one that has the family calendars shared to it).
7. Assign each person a calendar, then Save. After that the wall and the Pi can keep using `http://<lxc-lan-ip>:3847`.

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

## PhotoPrism background

The wall can cycle random photos from a PhotoPrism library behind the glass cards. Credentials never leave the home server — the kiosk only loads proxied JPEGs.

```
PHOTOPRISM_URL=http://192.168.1.10:2342
PHOTOPRISM_USER=admin
PHOTOPRISM_PASSWORD=...
# optional: limit to one album (UID from the PhotoPrism album URL)
PHOTOPRISM_ALBUM=
# optional: PhotoPrism search filters, e.g. favorite:true
PHOTOPRISM_QUERY=
PHOTO_ROTATE_SEC=45
```

An app password or `PHOTOPRISM_TOKEN` works if you would rather not store the account password. You can also enter the URL and login under Settings. If PhotoPrism is unset or unreachable, the scenic wallpaper stays put.

Sleep uses a dim overlay so the slideshow can keep playing. Lower the dim slider if you want more of the photo to show through the night clock.

## Weather

Open-Meteo is used by default. Set latitude, longitude, timezone, and `fahrenheit` or `celsius` in `.env` or Settings. If the forecast request fails, the last cached (or demo) forecast stays on screen.

## Kiosk (Pi Zero 2 / Banana Pi M2 Zero)

Do not run this Node app on the 512MB board. The Pi only opens a fullscreen browser at the home-server URL.

**OS:** [Raspberry Pi OS Lite (64-bit)](https://www.raspberrypi.com/software/) on a Raspberry Pi Zero 2 or Zero 2 W (same board — early ones omit the **W** on the silk). That is the Lite image in Raspberry Pi Imager — not the desktop image. The installer turns it into a kiosk: console autologin → bare X/Openbox → Chromium `--kiosk`, so the panel shows this app and nothing else. The radio is 2.4 GHz only; or use USB Ethernet on the powered hub. SSH in and `git clone` this repo — you do not need to copy files from Windows.

Step-by-step (Imager settings, wiring, `git clone`, Cog fallback) is in [deploy/kiosk/README.md](deploy/kiosk/README.md).

```bash
# on the Pi, after: git clone https://github.com/first88rx7/Calendar.git
cd Calendar/deploy/kiosk
HOUSEHOLD_URL=http://<home-server-ip>:3847 ./install.sh
sudo reboot
```

Banana Pi M2 Zero v1.0 works on Armbian; use the external Wi-Fi antenna. If Chromium is too heavy, install Cog (WPE WebKit). The launcher will use it.

## LAN only

This is a kitchen appliance, not a public website. Do not forward port 3847. Optional `SETTINGS_PIN` locks the Settings page.

## ESP32

Not used. A 15.6" HDMI panel needs a Pi-class board. Keep the ESP32s for a later sensor if you want indoor temperature on the strip.
