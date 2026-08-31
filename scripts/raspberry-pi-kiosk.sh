#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────
# BeZhas War Room — Raspberry Pi Kiosk Setup
#
# Configures a Raspberry Pi (Raspberry Pi OS / Debian) to boot
# directly into a fullscreen Chromium browser showing the
# BeZhas War Room monitoring dashboard.
#
# Usage:
#   chmod +x raspberry-pi-kiosk.sh
#   sudo ./raspberry-pi-kiosk.sh [WAR_ROOM_URL]
#
# Default URL: http://control-center:3000/monitor?kiosk=1
#
# NOTE on auth: /monitor lives OUTSIDE the cookie-authenticated /dashboard
# tree on purpose — a fresh Pi browser has no session cookie, so putting it
# under /dashboard would just show the login screen forever. No login step
# is needed here.
#
# NOTE on access control: if the control-center server has MONITOR_ACCESS_TOKEN
# set (recommended once this leaves a trusted LAN — it gates gas balances,
# Aegis status and Brain telemetry), the token lives server-side only
# (control-center/frontend's env) and is injected by app/api/monitor/route.ts.
# The Pi's URL never needs to carry it.
# ──────────────────────────────────────────────────────────────────
set -euo pipefail

WAR_ROOM_URL="${1:-http://localhost:3000/monitor?kiosk=1}"
KIOSK_USER="${SUDO_USER:-pi}"
AUTOSTART_DIR="/home/${KIOSK_USER}/.config/autostart"
LXDE_AUTOSTART="/etc/xdg/lxsession/LXDE-pi/autostart"

echo "══════════════════════════════════════════"
echo "  BeZhas War Room — Raspberry Pi Kiosk"
echo "══════════════════════════════════════════"
echo "  URL:  ${WAR_ROOM_URL}"
echo "  User: ${KIOSK_USER}"
echo ""

# ── 1. Install dependencies ──
echo "[1/5] Installing dependencies..."
apt-get update -qq
apt-get install -y -qq \
  chromium-browser \
  unclutter \
  xdotool \
  xscreensaver \
  > /dev/null 2>&1

# ── 2. Disable screen blanking / screensaver ──
echo "[2/5] Disabling screen blanking..."

# Disable via lightdm
if [ -f /etc/lightdm/lightdm.conf ]; then
  if ! grep -q "xserver-command" /etc/lightdm/lightdm.conf; then
    sed -i '/^\[Seat:\*\]/a xserver-command=X -s 0 -dpms' /etc/lightdm/lightdm.conf
  fi
fi

# Disable DPMS in X
cat > "/home/${KIOSK_USER}/.xsessionrc" << 'XSESSION'
xset s off
xset -dpms
xset s noblank
XSESSION
chown "${KIOSK_USER}:${KIOSK_USER}" "/home/${KIOSK_USER}/.xsessionrc"

# ── 3. Create the kiosk launcher script ──
echo "[3/5] Creating kiosk launcher..."

cat > "/home/${KIOSK_USER}/bezhas-kiosk.sh" << KIOSK
#!/usr/bin/env bash
# BeZhas War Room Kiosk Launcher
# Auto-generated — do not edit manually

WAR_ROOM_URL="${WAR_ROOM_URL}"

# Wait for the desktop to be ready
sleep 5

# Hide mouse cursor after 3 seconds of inactivity
unclutter -idle 3 -root &

# Disable screen blanking
xset s off
xset -dpms
xset s noblank

# Clean up Chromium crash flags (prevents "restore session" dialogs)
CHROMIUM_DIR="/home/${KIOSK_USER}/.config/chromium"
mkdir -p "\${CHROMIUM_DIR}/Default"
sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' "\${CHROMIUM_DIR}/Default/Preferences" 2>/dev/null || true
sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/' "\${CHROMIUM_DIR}/Default/Preferences" 2>/dev/null || true

# Launch Chromium in kiosk mode
chromium-browser \\
  --noerrdialogs \\
  --disable-infobars \\
  --disable-session-crashed-bubble \\
  --disable-translate \\
  --no-first-run \\
  --start-fullscreen \\
  --kiosk \\
  --incognito \\
  --disable-pinch \\
  --overscroll-history-navigation=0 \\
  --check-for-update-interval=31536000 \\
  --disable-features=TranslateUI \\
  --autoplay-policy=no-user-gesture-required \\
  "\${WAR_ROOM_URL}" &

# Auto-refresh every 6 hours (force reload to pick up frontend deploys)
while true; do
  sleep 21600
  xdotool key F5
done
KIOSK

chmod +x "/home/${KIOSK_USER}/bezhas-kiosk.sh"
chown "${KIOSK_USER}:${KIOSK_USER}" "/home/${KIOSK_USER}/bezhas-kiosk.sh"

# ── 4. Register autostart ──
echo "[4/5] Configuring autostart..."

# Method A: LXDE autostart (standard Raspberry Pi OS)
if [ -f "${LXDE_AUTOSTART}" ]; then
  # Remove existing kiosk entries
  sed -i '/bezhas-kiosk/d' "${LXDE_AUTOSTART}"
  echo "@/home/${KIOSK_USER}/bezhas-kiosk.sh" >> "${LXDE_AUTOSTART}"
  echo "  -> Added to LXDE autostart"
fi

# Method B: XDG autostart (fallback for other desktops)
mkdir -p "${AUTOSTART_DIR}"
cat > "${AUTOSTART_DIR}/bezhas-kiosk.desktop" << DESKTOP
[Desktop Entry]
Type=Application
Name=BeZhas War Room
Exec=/home/${KIOSK_USER}/bezhas-kiosk.sh
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
DESKTOP
chown -R "${KIOSK_USER}:${KIOSK_USER}" "${AUTOSTART_DIR}"

# ── 5. Optional: set GPU memory split for better rendering ──
echo "[5/5] Optimizing GPU memory..."
if [ -f /boot/config.txt ]; then
  if ! grep -q "gpu_mem=" /boot/config.txt; then
    echo "gpu_mem=128" >> /boot/config.txt
    echo "  -> Set GPU memory to 128MB"
  fi
fi

echo ""
echo "══════════════════════════════════════════"
echo "  Setup complete!"
echo ""
echo "  The Raspberry Pi will boot into the"
echo "  BeZhas War Room on next restart."
echo ""
echo "  URL: ${WAR_ROOM_URL}"
echo ""
echo "  To change the URL later, edit:"
echo "    /home/${KIOSK_USER}/bezhas-kiosk.sh"
echo ""
echo "  To exit kiosk mode:"
echo "    Alt+F4 or Ctrl+Alt+Del"
echo ""
echo "  Reboot now with:  sudo reboot"
echo "══════════════════════════════════════════"
