# Kitchen kiosk (Raspberry Pi Zero 2)

The Pi is only a display. The dashboard runs on the **home server**. After install, the Pi boots straight into this app: no desktop, no browser chrome, no other programs on screen.

## What to install on the Pi

Use **Raspberry Pi OS Lite (64-bit)** on a **Raspberry Pi Zero 2** / **Zero 2 W**.

Raspberry Pi never sold a Zero 2 without radios. Early boards are silkscreened “Raspberry Pi Zero 2” with no **W**; later ones say “Zero 2 W”. Same chip, same 2.4 GHz Wi-Fi, same image. In Imager, pick **Raspberry Pi Zero 2 W**.

That is the Lite image in [Raspberry Pi Imager](https://www.raspberrypi.com/software/) — not “Raspberry Pi OS (desktop)”, and not the 32-bit image. Lite has no PIXEL desktop; the installer adds a tiny X session whose only job is the dashboard.

| Board | OS | Browser |
| --- | --- | --- |
| Raspberry Pi Zero 2 / Zero 2 W (preferred) | Raspberry Pi OS Lite **64-bit** | Chromium kiosk; install Cog if it is too slow |
| Original Raspberry Pi Zero / Zero W | Raspberry Pi OS Lite **32-bit** | Cog (WPE). Chromium is usually too heavy |
| Banana Pi M2 Zero v1.0 | Armbian (Jammy/Bookworm CLI) | Chromium or Cog; fit the external Wi-Fi antenna |

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

On the Pi, install git and clone the household repo (public HTTPS is the easy path):

```bash
sudo apt-get update
sudo apt-get install -y git
git clone https://github.com/<you>/household.git
cd household/deploy/kiosk
chmod +x install.sh kiosk.sh
```

Replace the URL with whatever GitHub (or GitLab) shows after you create the repository.

If the repo is **private**, either clone with a [personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) when git asks for a password, or add an SSH deploy key:

```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519
cat ~/.ssh/id_ed25519.pub
# paste that public key as a read-only deploy key on the repo, then:
git clone git@github.com:<you>/household.git
cd household/deploy/kiosk
```

## 3. Point it at the dashboard and reboot

Still on the Pi, in `deploy/kiosk`:

```bash
HOUSEHOLD_URL=http://<home-server-ip>:3847 ./install.sh
sudo reboot
```

The installer:

- installs X, Openbox, and Chromium (Cog if Chromium is missing)
- adds 512MB swap on 512MB boards
- logs the user in on the console and starts a bare X session
- launches Chromium with `--kiosk --app=…` so only the dashboard is visible
- hides the pointer after a couple of seconds
- turns off screen blanking
- restarts the browser if it crashes

After reboot you should see the household week view and nothing else.

## Changing the URL later

```bash
echo 'http://192.168.1.10:3847' > ~/household-kiosk/url
sudo reboot
```

## If Chromium is too slow

On a Zero 2 this is uncommon; on an original Zero it is expected.

```bash
sudo apt-get update
sudo apt-get install -y cog
# remove Chromium so the launcher picks Cog
sudo apt-get remove -y chromium chromium-browser || true
sudo reboot
```

## If you still see a desktop or a login prompt

- You flashed the **desktop** image. Re-flash **Lite (64-bit)** and rerun `install.sh`.
- Autologin: `sudo raspi-config` → System Options → Boot / Auto Login → **Console autologin**.
- Blank HDMI: the installer sets `hdmi_force_hotplug=1` in `/boot/firmware/config.txt`. Reboot after a panel change.

## Banana Pi M2 Zero

Use a current Armbian CLI image, attach the external Wi-Fi antenna, then run the same `install.sh`. Keep the 15.6" panel on its own PSU. Mini-HDMI is video only; touch still needs OTG + a powered hub.
