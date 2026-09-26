/* Playable local comparison using the production simulation and original sprites. */
(async function(){'use strict';
const C=CONTENT,{Battle}=Warlords,canvas=document.getElementById('demo'),ctx=canvas.getContext('2d'),status=document.getElementById('status'),L=BATTLE_LAYOUT,images={};let b,paused=false,last=0,acc=0;
const files=['forest.jpg',...new Set([0,1,2].flatMap(id=>C.atlas['human-'+id].files)),...C.effects.human.files];
await Promise.all(files.map(file=>new Promise((ok,no)=>{const im=new Image();im.onload=()=>{images[file]=im;ok();};im.onerror=()=>no(Error(file));im.src='assets/'+file;})));
function wave(){for(const lane of [3,5])for(const side of [0,1]){b.spawn(side,1,lane,side?-(-900):-900);b.spawn(side,2,lane,side?1120:-1120);}}
function reset(){b=new Battle({mode:'duel',races:['human','human'],rosters:[[0,1,2,5,100],[0,1,2,5,100]],seed:2026});wave();paused=false;document.getElementById('pause').textContent='暂停';}
document.getElementById('reset').onclick=reset;
document.getElementById('send').onclick=()=>{b.spawn(0,100,3,-1050);};
document.getElementById('remove').onclick=()=>{for(const u of b.units)if(u.type===100&&u.side===0&&u.lane===3&&!u.dead){u.hp=0;u.dead=true;u.frame=C.units[100].labels.die1;u.ageDead=0;}};
document.getElementById('pause').onclick=()=>{paused=!paused;document.getElementById('pause').textContent=paused?'继续':'暂停';};
function sprite(u,x,y,sx,sy){const m=u.knockFrame?C.effects.human:C.atlas['human-'+u.type],r=m.frameRects[(u.knockFrame||u.frame)-1];if(!r)return;const fade=u.dead?Math.max(0,Math.min(1,(224-u.ageDead)/35)):1;
 if(!u.dead&&b.laneSupported(u.side,u.lane))BannerVisual.inspired(ctx,x,y,sx,sy,u.side,b.tick,u.id);
 if(u.type===100){ctx.save();ctx.globalAlpha=fade;BannerVisual.standard(ctx,x,y,sx,sy,u.dir,b.tick,!!(u.dead||u.knockFrame));ctx.restore();}
 ctx.save();ctx.translate(x,y);ctx.scale(u.dir*sx,sy);ctx.globalAlpha=fade;ctx.drawImage(images[m.files[r.page]],r.x,r.y,r.w,r.h,r.ox,r.oy,r.w,r.h);ctx.restore();
 if(!u.dead){ctx.fillStyle='#202b24';ctx.fillRect(x-9,y+4,18,2);ctx.fillStyle=u.side?'#e78d70':'#9bc5eb';ctx.fillRect(x-9,y+4,18*Math.max(0,u.hp/u.maxHp),2);}
}
function render(now){const dt=last?Math.min(.15,(now-last)/1000):0;last=now;if(!paused&&b.winner===null){acc+=dt;while(acc>=1/24){b.step();if(b.tick%192===0)wave();acc-=1/24;}}
 ctx.setTransform(2,0,0,2,0,0);ctx.drawImage(images['forest.jpg'],0,0,700,500);
 for(let lane=0;lane<8;lane++){const row=L.lanes[lane];if(b.laneSupported(0,lane))BannerVisual.lane(ctx,row.y,700,0);for(const u of b.units.filter(u=>u.lane===lane).sort((a,z)=>Number(z.dead)-Number(a.dead)||a.id-z.id))sprite(u,L.worldX(u.x,lane),row.y,2*row.sx,2*row.sy);for(const p of b.projectiles.filter(p=>p.lane===lane)){ctx.strokeStyle='#ddd0a9';ctx.beginPath();const x=L.worldX(p.x,lane),y=row.y+p.y*row.sy;ctx.moveTo(x-5,y);ctx.lineTo(x+5,y);ctx.stroke();}}
 status.textContent='第 4 路：'+(b.laneSupported(0,3)?'战旗生效 · 伤害 ×1.20 / 承伤 ×0.85':'无战旗加成')+'　|　第 6 路：无加成　|　突破 '+b.scores.join(' : ')+(b.winner!==null?' · 战斗结束，可重置':'');requestAnimationFrame(render);
}
reset();requestAnimationFrame(render);
})().catch(e=>{document.getElementById('status').textContent='载入失败：'+e.message;console.error(e);});
