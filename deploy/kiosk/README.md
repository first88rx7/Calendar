# Raspberry Pi Zero 2 W / Banana Pi M2 Zero kiosk

This board is the **display**, not the app server. The dashboard runs on the machine that already hosts Mealie.

## Hardware

- Mini-HDMI to HDMI for the 15.6" panel
- Micro-USB OTG adapter + powered hub for the USB touch digitizer
- Independent PSU for the monitor — do not power a 15.6" panel from the Pi 5V rail
- 1920×1080 landscape
- Raspberry Pi Zero 2 W is the preferred board (64-bit Raspberry Pi OS)
- Banana Pi M2 Zero v1.0 works with Armbian; fit the external Wi-Fi antenna

ESP32 boards are not used for this HDMI kiosk.

## Install

On Raspberry Pi OS Lite or Armbian, as the auto-login user:

```bash
sudo apt-get update
# copy this folder onto the Pi, then:
HOUSEHOLD_URL=http://<home-server-ip>:3847 ./install.sh
sudo reboot
```

The installer adds 512MB swap, Openbox, Chromium (or Cog if present), and a user systemd unit that restarts the browser if it crashes.

If Chromium still pages too hard, install Cog and rerun:

```bash
sudo apt-get install -y cog
```

`kiosk.sh` will use Cog when Chromium is missing.

## Do not

Do not run Docker / Node for this app on the Zero. Two-way Google OAuth, SQLite, and the Mealie proxy belong on the home server.
