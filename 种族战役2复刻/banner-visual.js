/* Original human animation stays untouched; the standard is a separate canvas layer. */
(function(g){'use strict';
function standard(c,x,y,sx,sy,dir,tick=0,fallen=false){
 c.save();c.translate(x,y);c.scale(dir*sx,sy);
 if(fallen){c.translate(-8,5);c.rotate(-1.35);c.globalAlpha=.55;}
 const sway=Math.sin(tick*.16)*2;
 c.translate(-12,sway*.3);
 c.strokeStyle='#302b24';c.lineWidth=4;c.beginPath();c.moveTo(0,-5);c.lineTo(0,-124);c.stroke();
 c.strokeStyle='#8c7050';c.lineWidth=2;c.stroke();
 c.fillStyle='#b5bdbe';c.beginPath();c.moveTo(0,-133);c.lineTo(-4,-121);c.lineTo(4,-121);c.closePath();c.fill();
 c.beginPath();c.moveTo(-1,-117);c.bezierCurveTo(-15,-122+sway,-25,-110-sway,-43,-116);c.lineTo(-38,-95);c.lineTo(-43,-75);c.bezierCurveTo(-26,-68-sway,-16,-84+sway,-1,-78);c.closePath();c.fillStyle='#234977';c.fill();c.strokeStyle='#152f4d';c.lineWidth=1.5;c.stroke();
 c.fillStyle='#49698b';c.beginPath();c.moveTo(-4,-114);c.lineTo(-11,-114);c.lineTo(-11,-82);c.lineTo(-4,-80);c.fill();
 c.fillStyle='#bbc3c5';c.fillRect(-29,-106,3,7);c.fillRect(-23,-106,3,7);c.fillRect(-17,-106,3,7);c.fillRect(-29,-100,15,4);c.fillRect(-26,-96,9,12);c.fillRect(-29,-85,15,3);c.fillStyle='#234977';c.fillRect(-23,-89,3,5);
 c.restore();
}
function lane(c,y,width,side){
 c.save();c.fillStyle=side===0?'rgba(117,166,218,.12)':'rgba(215,147,89,.12)';c.fillRect(0,y-18,width,21);
 c.font='bold 10px sans-serif';c.textAlign=side===0?'left':'right';c.fillStyle=side===0?'#d9e9ff':'#ffe1b8';c.strokeStyle='#1b2533';c.lineWidth=3;
 const text='⚑ 伤害 +20% · 减伤 15%',x=side===0?12:width-12;c.strokeText(text,x,y-21);c.fillText(text,x,y-21);c.restore();
}
// Pure visual feedback: simulation ticks keep paused/replayed battles stable.
function inspired(c,x,y,sx,sy,side,tick,id=0){
 const phase=((tick+id*13)%48)/48;
 c.save();c.translate(x,y);c.scale(sx,sy);
 c.strokeStyle=side===0?'#b8d9ee':'#f0c99b';c.fillStyle=side===0?'#b8d9ee':'#f0c99b';
 c.globalAlpha=.35+.12*Math.sin(tick*.12);c.lineWidth=2;
 c.beginPath();c.ellipse(0,1,23,6,0,0,Math.PI*2);c.stroke();
 c.globalAlpha=.7*Math.sin(phase*Math.PI);const top=-55-phase*25;
 for(const dx of [-7,7]){c.beginPath();c.moveTo(dx-4,top+5);c.lineTo(dx,top);c.lineTo(dx+4,top+5);c.stroke();}
 c.restore();
}
let previewImage;
async function portrait(canvas){
 const m=CONTENT.atlas['human-100'],f=m.frameRects[0];
 previewImage??=new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>{previewImage=null;reject(Error('战旗预览载入失败'));};im.src='assets/'+m.files[f.page];});
 const im=await previewImage,c=canvas.getContext('2d');
 canvas.width=320;canvas.height=320;c.clearRect(0,0,320,320);
 // Fit both the tall standard and original spear, preserving original proportions.
 c.save();c.translate(130,284);c.scale(1.8,1.8);standard(c,0,0,1,1,1);
 c.drawImage(im,f.x,f.y,f.w,f.h,f.ox,f.oy,f.dw||f.w,f.dh||f.h);c.restore();
}
g.BannerVisual={standard,lane,inspired,portrait};
})(globalThis);
