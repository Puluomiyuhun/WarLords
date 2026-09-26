/* Share in-flight image requests. HTTP caching is supplied by the asset server. */
(()=>{'use strict';
 const pending=new Map();
 function image(path){
  const url=path+'?v=art0103';
  if(pending.has(url))return pending.get(url);
  const task=new Promise((resolve,reject)=>{
   function attempt(retries){
    const im=new Image();let timer,settled=false;
    const finish=(error)=>{if(settled)return;settled=true;clearTimeout(timer);im.onload=im.onerror=null;
     if(error){im.src='';if(retries)setTimeout(()=>attempt(retries-1),500);else reject(error);}else resolve(im);
    };
    im.onload=()=>finish();im.onerror=()=>finish(Error(path+'（下载失败）'));
    timer=setTimeout(()=>finish(Error(path+'（下载超时）')),90000);
    im.src=url;
   }
   attempt(1);
  });
  pending.set(url,task);task.then(()=>pending.delete(url),()=>pending.delete(url));return task;
 }
 async function batch(files,load,progress=()=>{}){
  const list=[...new Set(files)];let cursor=0,done=0;progress(0,list.length);
  let failure;
  await Promise.all(Array.from({length:Math.min(3,list.length)},async()=>{
   while(!failure&&cursor<list.length){const file=list[cursor++];try{await load(file);progress(++done,list.length);}catch(e){failure=e;}}
  }));
  if(failure)throw failure;
 }
 window.GameAssets={image,batch};
})();
