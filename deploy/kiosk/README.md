# Kitchen kiosk (Raspberry Pi Zero 2)

The Pi is only a display. The dashboard runs on the **home server**. After install, the Pi boots straight into this app: no desktop, no browser chrome, no other programs on screen.

## What to install on the Pi

Use **Raspberry Pi OS Lite (64-bit)** on a **Raspberry Pi Zero 2** / **Zero 2 W**.

Raspberry Pi never sold a Zero 2 without radios. Early boards are silkscreened “Raspberry Pi Zero 2” with no **W**; later ones say “Zero 2 W”. Same chip, same 2.4 GHz Wi-Fi, same image. In Imager, pick **Raspberry Pi Zero 2 W**.

That is the Lite image in [Raspberry Pi Imager](https://www.raspberrypi.com/software/) — not “Raspberry Pi OS (desktop)”, and not the 32-bit image. Lite has no PIXEL desktop. On 512MB boards the installer uses Cog on the HDMI console; Chromium gets a tiny X session on boards with more RAM.

| Board | OS | Browser |
| --- | --- | --- |
| Raspberry Pi Zero 2 / Zero 2 W (preferred) | Raspberry Pi OS Lite **64-bit** | Cog (WPE). Chromium is too tight on 512MB |
| Original Raspberry Pi Zero / Zero W | Raspberry Pi OS Lite **32-bit** | Cog (WPE). Chromium is usually too heavy |
| Banana Pi M2 Zero v1.0 | Armbian (Jammy/Bookworm CLI) | Cog or Chromium; fit the external Wi-Fi antenna |

Do **not** install Raspberry Pi OS with desktop. You would get a taskbar and file manager, and 512MB of RAM is already tight.

Do **not** run Docker or Node for this app on the Pi.

## Hardware

- Mini-HDMI → HDMI for the 15.6" panel (1920×1080 landscape)
- Micro-USB **OTG** + a **powered** USB hub for the touch digitizer
- Monitor on its **own** power supply — do not power a 15.6" panel from the Pi 5V rail
- Pi Zero 2 powered from a solid 5V micro-USB supply of its own

ESP32 boards are not used for this HDMI kiosk.

## 1. Flash the card (on a laptop)

1. Install [Raspberry Pi Imager](https://www.raspberrypi.com/software/).
2. **Device:** Raspberry Pi Zero 2 W (use this even if the board only says “Zero 2”).
3. **OS:** Raspberry Pi OS (other) → **Raspberry Pi OS Lite (64-bit)**.
4. Open the gear / Edit settings:
   - hostname (example: `kitchen-pi`)
   - username and password
   - Wi-Fi SSID and password (2.4 GHz, same LAN as the home server). The Zero 2 does not do 5 GHz.
   - locale and keyboard
   - enable SSH
5. Write the card, put it in the Pi, connect HDMI and power. First boot can take a few minutes while it resizes the card.

If you would rather not use Wi-Fi, skip the SSID in Imager and plug a USB Ethernet adapter into the **powered** hub (the same hub as the touch screen). After boot, `ip addr` should show `eth0` or `enx…` with a LAN address. Then `scp` / `ssh` using that IP.

The home-server app should already be up at `http://<server-ip>:3847`. Check that URL on a phone first.

## 2. SSH in and clone this repo

Enable SSH in Imager, wait for the Pi to join the LAN, then from Windows (PowerShell or Windows Terminal):

```powershell
ssh <user>@kitchen-pi.local
```

If `.local` does not resolve, use the Pi's IP from the router.

On the Pi, install git and clone [first88rx7/Calendar](https://github.com/first88rx7/Calendar) (public HTTPS is the easy path):

```bash
sudo apt-get update
sudo apt-get install -y git
git clone https://github.com/first88rx7/Calendar.git
cd Calendar/deploy/kiosk
chmod +x install.sh kiosk.sh
```

If the repo is **private**, either clone with a [personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) when git asks for a password, or add an SSH deploy key:

```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519
cat ~/.ssh/id_ed25519.pub
# paste that public key as a read-only deploy key on the repo, then:
git clone git@github.com:first88rx7/Calendar.git
cd Calendar/deploy/kiosk
```

## 3. Point it at the dashboard and reboot

Still on the Pi, in `deploy/kiosk`:

```bash
HOUSEHOLD_URL=http://<home-server-ip>:3847 ./install.sh
sudo reboot
```

The installer:

- on 512MB boards, installs **Cog** (WPE) as the kiosk browser and does not pull Chromium
- on larger boards, installs Chromium kiosk plus Cog as a fallback
- adds 512MB swap on 512MB boards
- logs the user in on the console
- Cog draws on the HDMI VT (DRM or Cage) with no desktop and no address bar; Chromium still uses a bare X session
- turns off screen blanking
- restarts the browser if it crashes (see `~/household-kiosk/kiosk.log`)

After reboot you should see the household week view and nothing else.

## Changing the URL later

```bash
echo 'http://192.168.1.10:3847' > ~/household-kiosk/url
sudo reboot
```

## If Chromium is too slow or hangs on reload

A Zero 2 has 512MB. Chromium often warns about running under 1GB and can freeze when the page reloads. Use Cog instead — but **re-run `install.sh`**. Only removing Chromium leaves the old X11 session running Cog with a Wayland flag, which is a **blank screen**.

```bash
cd ~/Calendar/deploy/kiosk   # or wherever you cloned the repo
git pull --ff-only origin main
chmod +x install.sh kiosk.sh
# keeps the URL already in ~/household-kiosk/url
./install.sh
sudo reboot
```

SSH in and `tail -f ~/household-kiosk/kiosk.log` if the panel is still blank after that reboot.

To go back to Chromium on a bigger board:

```bash
echo chromium > ~/household-kiosk/browser
sudo reboot
```

## If you still see a desktop or a login prompt

- You flashed the **desktop** image. Re-flash **Lite (64-bit)** and rerun `install.sh`.
- Autologin: `sudo raspi-config` → System Options → Boot / Auto Login → **Console autologin**.
- Blank HDMI: the installer sets `hdmi_force_hotplug=1` in `/boot/firmware/config.txt`. Reboot after a panel change.

## Banana Pi M2 Zero

Use a current Armbian CLI image, attach the external Wi-Fi antenna, then run the same `install.sh`. Keep the 15.6" panel on its own PSU. Mini-HDMI is video only; touch still needs OTG + a powered hub.
