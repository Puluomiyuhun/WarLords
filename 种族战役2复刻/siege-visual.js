/* One projectile presentation for single-player, co-op and the siege preview. */
(function(g){'use strict';
function draw(c,p,x,y,sx,sy,sprite){
 const m=CONTENT.projectileAtlas[p.visual];if(!m)return;
 const magic=p.visual==='fire'||p.visual==='obelisk';
 const frame=p.frame??(magic?1:1+p.age%m.frames);
 const angle=magic?0:Number.isFinite(p.rotation)?p.rotation:['axe','stone','skull'].includes(p.visual)?p.age*.3:Math.atan2(p.vy,p.vx)+Math.PI/2;
 c.save();c.translate(x,y);c.scale(sx,sy);c.rotate(angle);
 sprite(m,0,0,1,1,p.dir??1,frame,p.alpha??1);c.restore();
}
g.SiegeVisual={draw};
})(globalThis);
