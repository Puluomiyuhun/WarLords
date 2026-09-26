'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),C=require('./content'),{Battle}=require('./engine');
for(const id of [0,1,2]){
 const m=C.atlas['persian-'+id],d=C.units[id];assert(m.fullResolution);assert.equal(m.frames,d.totalFrames);assert.equal(m.frameRects.length,d.totalFrames);assert.deepEqual(m.labels,C.atlas['human-'+id].labels);
 for(const page of m.pages){const png=fs.readFileSync(path.join(__dirname,'assets',page.file));assert.equal(png.readUInt32BE(16),page.width);assert.equal(png.readUInt32BE(20),page.height);}
 for(const r of m.frameRects){const p=m.pages[r.page];assert(p);assert(r.x>=0&&r.y>=0&&r.x+r.w<=p.width&&r.y+r.h<=p.height);for(const n of ['ox','oy','dw','dh'])assert(Number.isFinite(r[n]));assert(r.dw>0&&r.dh>0);}
 const walk=d.labels.walk,end=Object.keys(d.frames).map(Number).find(f=>f>walk&&d.frames[f].reset);assert(new Set(m.frameRects.slice(walk-1,end).map(r=>[r.page,r.x,r.y].join(','))).size>=10,'walk must retain in-between poses');
 for(const [f,e]of Object.entries(d.frames))if(e.hit||e.arrow||e.impact){const r=m.frameRects[f-1];assert(r.w>1&&r.h>1,'hit/release frame cannot be blank');}
 const create=race=>new Battle({mode:'duel',races:[race,'human'],rosters:[[id],[0,1,2]],seed:721});const a=create('persian'),b=create('human');
 for(const sim of [a,b]){sim.spawn(0,id,3,-300);sim.spawn(1,1,3,300);sim.spawn(1,2,3,700);}
 for(let tick=0;tick<500;tick++){a.step();b.step();}
 const normalize=s=>JSON.stringify(s).replaceAll('persian','human');assert.equal(normalize(a.snapshot()),normalize(b.snapshot()),'reskin must not alter combat');
}
console.log('PASS Persian infantry: all 448 timeline frames, PNG dimensions, walk in-betweens, hit/release frames, identical combat outcomes');
