'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {startCoopServer}=require('../合作模式预研/coop-room-server.cjs');
const ROOT=__dirname,DEFAULT_PORT=18643;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg'};
function publicConfig(value=''){
 if(!value)return {origin:null,basePath:''};
 const u=new URL(value);
 if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.search||u.hash)throw Error('COOP_PUBLIC_URL must be an HTTP(S) URL without credentials, query or fragment');
 const basePath=u.pathname.replace(/\/+$/,'');
 if(basePath&&!/^\/[A-Za-z0-9_/-]+$/.test(basePath))throw Error('Invalid public path');
 return {origin:u.origin,basePath};
}
function createHandler({origin,basePath}){
 return (req,res)=>{
  const headers={'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'};
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,headers);return res.end();}
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400,headers);return res.end();}
  if(basePath&&pathname===basePath){res.writeHead(308,{...headers,Location:basePath+'/'});return res.end();}
  if(basePath&&!pathname.startsWith(basePath+'/')){res.writeHead(404,headers);return res.end();}
  pathname=pathname.slice(basePath.length);
  if(pathname==='/coop-health'){
   const body=JSON.stringify({app:'warlords2-local-coop',version:2,release:'0.10.8-defense-return',basePath,public:!!origin});
   res.writeHead(200,{...headers,'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)});
   return res.end(req.method==='HEAD'?undefined:body);
  }
  if(pathname==='/')pathname='/coop.html';
  // Serve only game content, never deployment configuration or server sources.
  if(!/^\/(?:[a-zA-Z0-9_-]+\.(?:html|js|css)|(?:assets|data)\/[a-zA-Z0-9_/-]+\.(?:json|png|jpg|mp3))$/.test(pathname)){res.writeHead(404,headers);return res.end();}
  const target=path.resolve(ROOT,'.'+pathname),ext=path.extname(target).toLowerCase();
  if(!target.startsWith(ROOT+path.sep)||!mime[ext]){res.writeHead(404,headers);return res.end();}
  fs.stat(target,(err,stat)=>{
   if(err||!stat.isFile()){res.writeHead(404,headers);return res.end();}
   res.writeHead(200,{...headers,'Content-Type':mime[ext],'Content-Length':stat.size});
   if(req.method==='HEAD')return res.end();
   const stream=fs.createReadStream(target);stream.on('error',()=>res.destroy());stream.pipe(res);
  });
 };
}
async function startLocal({port=DEFAULT_PORT,host='127.0.0.1',publicUrl='',manual=false,snapshotEvery=2,maxClients=64,maxRooms=16}={}){
 if(!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid COOP_PORT');
 const config=publicConfig(publicUrl);
 if(!['127.0.0.1','::1','localhost'].includes(host)&&!config.origin)throw Error('Non-loopback binding requires COOP_PUBLIC_URL');
 const server=http.createServer(createHandler(config));
 server.headersTimeout=10000;server.requestTimeout=15000;server.maxHeadersCount=40;
 const rooms=await startCoopServer({httpServer:server,manual,snapshotEvery,allowedOrigin:config.origin,basePath:config.basePath,maxClients,maxRooms});
 try{await new Promise((yes,no)=>{server.once('error',no);server.listen(port,host,yes);});}
 catch(e){await rooms.close();throw e;}
 return {server,rooms,port:server.address().port,basePath:config.basePath,close:async()=>{await rooms.close();await new Promise(resolve=>server.close(resolve));}};
}
function openBrowser(url){
 if(process.platform==='win32')require('node:child_process').spawn('cmd.exe',['/d','/c','start','',url],{windowsHide:true,stdio:'ignore'}).unref();
}
if(require.main===module){
 const port=Number(process.env.COOP_PORT||DEFAULT_PORT),host=process.env.COOP_HOST||'127.0.0.1',publicUrl=process.env.COOP_PUBLIC_URL||'';
 const config=publicConfig(publicUrl),url=publicUrl?publicUrl.replace(/\/+$/,'')+'/coop.html':'http://127.0.0.1:'+port+'/coop.html';
 startLocal({port,host,publicUrl,snapshotEvery:Number(process.env.COOP_SNAPSHOT_EVERY||2),maxRooms:Number(process.env.COOP_MAX_ROOMS||16)}).then(s=>{
  console.log('Co-op 0.10.8-defense-return ready: '+url+'\nListening: '+host+':'+s.port+'\nKeep this process running. Stopping it ends all rooms.');
  if(process.argv.includes('--open'))openBrowser(process.argv.includes('--solo')?url.replace(/coop\.html$/,'index.html'):url);
  let closing=false;const stop=async()=>{if(closing)return;closing=true;await s.close();process.exit(0);};
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
 }).catch(async e=>{
  if(e.code==='EADDRINUSE'){
   try{const r=await fetch('http://127.0.0.1:'+port+config.basePath+'/coop-health',{signal:AbortSignal.timeout(2000)}),v=await r.json();
    if(v.app==='warlords2-local-coop'&&v.version===2&&v.release==='0.10.8-defense-return'&&v.basePath===config.basePath&&v.public===!!publicUrl){
     console.log('Co-op 0.10.8-defense-return already running: '+url);if(process.argv.includes('--open'))openBrowser(process.argv.includes('--solo')?url.replace(/coop\.html$/,'index.html'):url);return;
    }
   }catch{}
  }
  console.error(e);process.exitCode=1;
 });
}
module.exports={startLocal,publicConfig};
