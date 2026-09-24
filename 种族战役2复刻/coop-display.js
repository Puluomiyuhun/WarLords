/* Fullscreen is user initiated; unsupported browsers get Home Screen instructions. */
(()=>{'use strict';
 const help=document.getElementById('displayHelp'),status=document.getElementById('displayHelpStatus');
 const full=()=>document.fullscreenElement||document.webkitFullscreenElement;
 const standalone=()=>matchMedia('(display-mode:standalone)').matches||matchMedia('(display-mode:fullscreen)').matches||navigator.standalone===true;
 const request=()=>document.fullscreenEnabled!==false&&document.documentElement.requestFullscreen||document.webkitFullscreenEnabled!==false&&document.documentElement.webkitRequestFullscreen;
 function labels(){for(const b of document.querySelectorAll('[data-coop-fullscreen]'))b.textContent=full()?'退出全屏':standalone()?'屏幕说明':request()?'全屏':'主屏幕';}
 function explain(text){status.textContent=text;if(!help.open)help.showModal();}
 async function toggle(){
  if(standalone()&&!full())return explain('你已从主屏幕打开，当前没有浏览器标签栏。');
  try{
   if(full()){const exit=document.exitFullscreen||document.webkitExitFullscreen;if(exit)await exit.call(document);}
   else{const el=document.documentElement,enter=request();
    if(!enter)return explain('在这台设备上，请通过“添加到主屏幕”隐藏浏览器栏。添加一次，以后从桌面图标进入即可。');
    await enter.call(el,{navigationUI:'hide'});
   }
  }catch{explain('浏览器未能进入全屏。你仍可横屏游玩，或按下面的方法从主屏幕进入。');}
  labels();
 }
 document.querySelectorAll('[data-coop-fullscreen]').forEach(b=>b.addEventListener('click',toggle));
 document.querySelectorAll('[data-display-help]').forEach(b=>b.addEventListener('click',()=>explain('按下面的步骤，把游戏添加到 iPhone 主屏幕。')));
 document.addEventListener('fullscreenchange',labels);document.addEventListener('webkitfullscreenchange',labels);labels();
})();
