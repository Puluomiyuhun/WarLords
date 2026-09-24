#!/usr/bin/env bash
set -euo pipefail
# Run from the extracted release directory. Does not alter any Nginx site.
APP_ROOT=/opt/warlords2
RELEASE_DIR="$APP_ROOT/releases/0.6"
NODE_VERSION=v24.21.0
NODE_ARCHIVE="node-$NODE_VERSION-linux-x64.tar.xz"
NODE_DIR="$APP_ROOT/node-$NODE_VERSION-linux-x64"
SERVICE_PATH=/etc/systemd/system/warlords2-coop.service
SOURCE_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
test "$(id -u)" -eq 0
test "$(uname -m)" = x86_64
test -f "$SOURCE_DIR/种族战役2复刻/coop-local-server.cjs"
if test -e "$RELEASE_DIR" || test -e "$SERVICE_PATH"; then
  echo 'Existing release or service found; inspect it before installing.' >&2
  exit 1
fi
if ss -ltnH '( sport = :18643 )' | grep -q .; then
  echo 'Port 18643 is in use.' >&2
  exit 1
fi
install -d -m 755 "$APP_ROOT/downloads" "$APP_ROOT/releases"
cd "$APP_ROOT/downloads"
curl --fail --location --retry 2 --connect-timeout 15 --max-time 180 --output "$NODE_ARCHIVE" "https://nodejs.org/dist/$NODE_VERSION/$NODE_ARCHIVE"
curl --fail --location --retry 2 --connect-timeout 15 --max-time 30 --output SHASUMS256.txt "https://nodejs.org/dist/$NODE_VERSION/SHASUMS256.txt"
grep "  $NODE_ARCHIVE\$" SHASUMS256.txt | sha256sum --check --strict
test ! -e "$NODE_DIR"
tar -xJf "$NODE_ARCHIVE" -C "$APP_ROOT"
"$NODE_DIR/bin/node" --version
cp -a "$SOURCE_DIR" "$RELEASE_DIR"
if ! id warlords2 >/dev/null 2>&1; then useradd --system --home-dir "$APP_ROOT" --shell /sbin/nologin warlords2; fi
chmod -R a+rX "$RELEASE_DIR"
cat > "$SERVICE_PATH" <<EOF
[Unit]
Description=Warlords 2 private co-op test
After=network.target

[Service]
Type=simple
User=warlords2
Group=warlords2
WorkingDirectory=$RELEASE_DIR/种族战役2复刻
ExecStart=$NODE_DIR/bin/node "$RELEASE_DIR/种族战役2复刻/coop-local-server.cjs"
Environment=COOP_HOST=127.0.0.1
Environment=COOP_PORT=18643
Environment=COOP_PUBLIC_URL=https://work.puluo.top/warlords2
Environment=COOP_SNAPSHOT_EVERY=2
Environment=COOP_MAX_ROOMS=16
Restart=on-failure
RestartSec=3
TimeoutStopSec=10
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
MemoryMax=768M
Nice=5

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now warlords2-coop.service
for attempt in {1..15}; do
  if curl --fail --silent http://127.0.0.1:18643/warlords2/coop-health; then printf '\n'; exit 0; fi
  sleep 1
done
systemctl status warlords2-coop.service --no-pager
exit 1
