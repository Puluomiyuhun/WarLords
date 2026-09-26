"""Build a cumulative text-only patch atop the deployed 0.10.3 assets."""
from pathlib import Path
import base64, gzip, hashlib, json

root = Path(__file__).resolve().parents[1]
version = json.loads((root/'package.json').read_text(encoding='utf-8'))['version']
paths = [root / 'package.json']
for directory in ['种族战役2复刻', '合作模式预研', '联机预研']:
    paths.extend(p for p in (root / directory).iterdir() if p.is_file() and p.suffix in {'.js', '.cjs', '.html', '.css', '.json'})
files = {p.relative_to(root).as_posix(): p.read_text(encoding='utf-8-sig') for p in sorted(paths)}
payload = gzip.compress(json.dumps(files, ensure_ascii=False).encode(), mtime=0)
template = r'''#!/usr/bin/env bash
set -euo pipefail
python3 - <<'PYTHON'
from pathlib import Path, PurePosixPath
import base64,gzip,hashlib,json,re,datetime,os,subprocess,time,urllib.request,shlex,shutil
version='@VERSION@'
assert os.geteuid()==0,'Run in the BaoTa root terminal'
service=Path('/etc/systemd/system/warlords2-coop.service')
assets=Path('/www/server/panel/vhost/nginx/proxy/work.puluo.top/warlords2-assets.conf')
node=Path('/opt/warlords2/node-v24.21.0-linux-x64/bin/node')
nginx='/www/server/nginx/sbin/nginx'
configs={p:p.read_text() for p in [service,assets]}
roots=[set(re.findall(r'/opt/warlords2/releases/[^/\s";]+',s)) for s in configs.values()]
assert len(roots[0])==1 and roots[0]==roots[1],'Service and asset paths disagree; nothing changed'
old=Path(next(iter(roots[0])))
assert old.resolve().parent==Path('/opt/warlords2/releases') and old.is_dir(),'Invalid active release'
installed=(old/'种族战役2复刻/coop-local-server.cjs').read_text()
assert any(v in installed for v in ['0.10.3-native-weapons','0.10.4-coop-net','0.10.5-siege','0.10.6-endless','0.10.7-endless35',version]),'Unexpected installed version'
assert node.is_file(),'Bundled Node runtime missing'
payload=base64.b64decode('@PAYLOAD@')
assert hashlib.sha256(payload).hexdigest()=='@HASH@','Patch payload checksum mismatch'
files=json.loads(gzip.decompress(payload))
for name in files:
 p=PurePosixPath(name)
 assert not p.is_absolute() and '..' not in p.parts and p.parts[0] in ['package.json','种族战役2复刻','合作模式预研','联机预研'],'Invalid patch path'
stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')
release=old.parent/(version+'-'+stamp)
backup=Path('/opt/warlords2/backups')/(version+'-'+stamp)
downloads=Path('/opt/warlords2/downloads');downloads.mkdir(parents=True,exist_ok=True)
log=downloads/(version+'-tests.log')
print('Preparing: '+str(release),flush=True)
release.mkdir()
# Share immutable assets with the previous release; every changed file is replaced,
# never written through a hard link into the running release.
subprocess.run(['cp','-al',str(old)+'/.',str(release)+'/'],check=True,timeout=120)
for name,content in files.items():
 p=release/name;p.parent.mkdir(parents=True,exist_ok=True)
 temp=p.with_name(p.name+'.endless35.tmp');temp.write_text(content,encoding='utf-8');temp.chmod(0o644);os.replace(temp,p)
env=dict(os.environ);env['PATH']=str(node.parent)+os.pathsep+env.get('PATH','')
print('Running tests before switching: '+str(log),flush=True)
with log.open('w') as output:
 result=subprocess.run([str(node.parent/'npm'),'test'],cwd=release,env=env,stdout=output,stderr=subprocess.STDOUT,timeout=240)
if result.returncode:
 print('\n'.join(log.read_text(errors='replace').splitlines()[-50:]),flush=True)
 raise RuntimeError('Tests failed; online service was not changed')
subprocess.run([nginx,'-t'],check=True,timeout=15)
backup.mkdir(parents=True)
for p in configs:shutil.copy2(p,backup/('service' if p==service else 'assets'))
q=shlex.quote
rollback='#!/usr/bin/env bash\nset -euo pipefail\n'+''.join('cp -a '+q(str(backup/label))+' '+q(str(p))+'\n' for p,label in [(service,'service'),(assets,'assets')])+'systemctl daemon-reload\nsystemctl restart warlords2-coop.service\n'+nginx+' -t\n'+nginx+' -s reload\necho ROLLED_BACK\n'
(backup/'rollback.sh').write_text(rollback,encoding='utf-8')
print('Switching service; current rooms will close.',flush=True)
try:
 for p,content in configs.items():
  temp=p.with_name(p.name+'.endless35.tmp');temp.write_text(content.replace(str(old),str(release)));temp.chmod(p.stat().st_mode & 0o777);os.replace(temp,p)
 subprocess.run([nginx,'-t'],check=True,timeout=15)
 subprocess.run(['systemctl','daemon-reload'],check=True,timeout=30)
 subprocess.run(['systemctl','restart','warlords2-coop.service'],check=True,timeout=30)
 health=None
 for i in range(20):
  try:
   with urllib.request.urlopen('http://127.0.0.1:18643/warlords2/coop-health',timeout=3) as response:health=json.load(response)
   if health.get('release')==version:break
  except Exception:pass
  time.sleep(1)
 assert health and health.get('release')==version,'New service failed health check'
 subprocess.run([nginx,'-s','reload'],check=True,timeout=15)
 subprocess.run(['systemctl','is-active','warlords2-coop.service'],check=True,timeout=15)
except Exception:
 print('Switch failed. Restoring previous release...',flush=True)
 subprocess.run(['bash',str(backup/'rollback.sh')],check=True,timeout=90)
 raise
print(json.dumps(health,ensure_ascii=False),flush=True)
print('DEPLOY_OK version='+version,flush=True)
print('Rollback: bash '+str(backup/'rollback.sh'),flush=True)
print('Both players: Ctrl+F5, then create a new room. Q requires 35 kills.',flush=True)
PYTHON
'''
installer = template.replace('@VERSION@', version).replace('@PAYLOAD@', base64.b64encode(payload).decode()).replace('@HASH@', hashlib.sha256(payload).hexdigest())
path=root/'发布包'/('install-'+version+'.sh');path.write_text(installer,encoding='utf-8',newline='\n')
(path.parent/(version+'-patch-manifest.json')).write_text(json.dumps({'version':version,'installerSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'files':{name:hashlib.sha256(content.encode()).hexdigest() for name,content in files.items()}},ensure_ascii=False,indent=2),encoding='utf-8')
compile(installer.split("python3 - <<'PYTHON'\n",1)[1].rsplit('\nPYTHON',1)[0],str(path),'exec')
print(f'{path}: {len(files)} files, {path.stat().st_size:,} bytes; embedded Python syntax OK')
