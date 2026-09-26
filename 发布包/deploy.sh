#!/usr/bin/env bash
set -Eeuo pipefail
version=0.10.3-native-weapons
cd -- "$(dirname -- "$(readlink -f -- "$0")")"
archive="$PWD/WarLords-$version.tar.gz"
release="/opt/warlords2/releases/$version-$(date +%Y%m%d-%H%M%S)"
service=/etc/systemd/system/warlords2-coop.service
assets=/www/server/panel/vhost/nginx/proxy/work.puluo.top/warlords2-assets.conf
node=/opt/warlords2/node-v24.21.0-linux-x64/bin
nginx=/www/server/nginx/sbin/nginx
test "$(id -u)" = 0
test -f "$service" && test -f "$assets" && test -x "$node/node"
printf '%s  %s\n' 28016f8579337880d0a5c969ca92b006a14f63f202306dfeaff9cd99d8190fb1 "$archive" | sha256sum -c -
mkdir -p /opt/warlords2/downloads /opt/warlords2/backups
old=$(python3 - "$service" "$assets" <<'PY'
import re,sys
from pathlib import Path
a=set(re.findall(r'/opt/warlords2/releases/[^/\s";]+',Path(sys.argv[1]).read_text()))
b=set(re.findall(r'/opt/warlords2/releases/[^/\s";]+',Path(sys.argv[2]).read_text()))
assert len(a)==1 and a==b, 'Service and assets release paths disagree; stopped without changes'
print(next(iter(a)))
PY
)
echo "Current: $old"
echo "Preparing: $release"
mkdir "$release"
tar -xzf "$archive" -C "$release"
chmod -R a+rX "$release"
echo 'Running tests before switching (log: /opt/warlords2/downloads/0.10.3-tests.log)...'
cd "$release"
if ! PATH="$node:$PATH" npm test > /opt/warlords2/downloads/0.10.3-tests.log 2>&1; then
  tail -60 /opt/warlords2/downloads/0.10.3-tests.log
  echo 'Tests failed; online service was not changed.'
  exit 1
fi
backup="/opt/warlords2/backups/$version-$(date +%Y%m%d-%H%M%S)"
mkdir "$backup"
cp -a "$service" "$backup/service"
cp -a "$assets" "$backup/assets"
cat > "$backup/rollback.sh" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$(readlink -f -- "$0")")"
cp -a service /etc/systemd/system/warlords2-coop.service
cp -a assets /www/server/panel/vhost/nginx/proxy/work.puluo.top/warlords2-assets.conf
systemctl daemon-reload
systemctl restart warlords2-coop.service
/www/server/nginx/sbin/nginx -t
/www/server/nginx/sbin/nginx -s reload
echo ROLLED_BACK
SH
rollback() {
  trap - ERR
  echo 'Deployment failed, restoring previous release...'
  bash "$backup/rollback.sh"
  exit 1
}
trap rollback ERR
python3 - "$service" "$assets" "$old" "$release" <<'PY'
import sys
from pathlib import Path
for name in sys.argv[1:3]:
 p=Path(name);s=p.read_text();assert sys.argv[3] in s;p.write_text(s.replace(sys.argv[3],sys.argv[4]))
PY
"$nginx" -t
systemctl daemon-reload
systemctl restart warlords2-coop.service
ok=0
for i in {1..20}; do
 if curl --max-time 3 -fsS http://127.0.0.1:18643/warlords2/coop-health | grep -q "$version"; then ok=1; break; fi
 sleep 1
done
test "$ok" = 1
"$nginx" -s reload
systemctl is-active warlords2-coop.service
curl --max-time 10 -fsS http://127.0.0.1:18643/warlords2/coop-health
trap - ERR
echo
echo "DEPLOY_OK version=$version"
echo "Rollback: bash $backup/rollback.sh"
