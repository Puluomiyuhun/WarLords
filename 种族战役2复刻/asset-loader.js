/* Share in-flight image requests. HTTP caching is supplied by the asset server. */
(()=>{'use strict';
 const pending=new Map();
 function image(path){
  const url=path+'?v=art06';
  if(pending.has(url))return pending.get(url);
  const task=new Promise((resolve,reject)=>{
   const im=new Image();let timer;
   const finish=(error)=>{clearTimeout(timer);im.onload=im.onerror=null;error?reject(error):resolve(im);};
   im.onload=()=>finish();im.onerror=()=>finish(Error(path));
   timer=setTimeout(()=>{finish(Error(path+'（下载超时，请重试）'));im.src='';},45000);
   im.src=url;
  });
  pending.set(url,task);task.then(()=>pending.delete(url),()=>pending.delete(url));return task;
 }
 async function batch(files,load,progress=()=>{}){
  const list=[...new Set(files)];let cursor=0,done=0;progress(0,list.length);
  await Promise.all(Array.from({length:Math.min(6,list.length)},async()=>{
   while(cursor<list.length){const file=list[cursor++];await load(file);progress(++done,list.length);}
  }));
 }
 window.GameAssets={image,batch};
})();
