'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/coop.js','utf8');
const C=require('./content.js');require('./native-specials.js');require('./restoration-visual.js');
const P=require('./progression.js'),{CoopEndless}=require('../合作模式预研/coop-endless.cjs');
async function main(){
 const c=new CoopEndless({races:['orc','demon'],seed:1});c.command(0,'ready',true);c.command(1,'ready',true);
 const m={round:1,battleConfig:c.battle.options,campaign:{phase:'battle',solo:false},status:'loading',connected:[true,true],loaded:[false,false]};
 const elements=new Map(),$=id=>{if(!elements.has(id))elements.set(id,{hidden:true,style:{},parentElement:{append(){}}});return elements.get(id)};
 const sent=[];let seenProgress=false,fail=true;
 const ctx={C,Progression:P,RestorationVisual,$,SOLO:false,state:m,loadGeneration:0,loadTask:null,loadFailedRound:-1,loadedRound:-1,loadProgress:'',loadError:'',images:new Map(),small:false,atlasFiles:new Set(),message(){},send(v){sent.push(v)},GameAssets:{image:async()=>({}),batch:async(files,load,progress)=>{progress(0,files.length);await load(files[0]);progress(1,files.length);seenProgress=$('battleNoticeText').textContent.includes('1 / ');if(fail)throw Error('sample.png timeout');}}};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function updateBattleNotice'),source.indexOf('function sprite(')),ctx);
 await ctx.loadRound(m);
 assert(seenProgress,'progress must update without another server packet');
 assert.match($('battleNoticeText').textContent,/sample.png timeout/);assert.equal($('reloadAssets').hidden,false);assert.equal(ctx.loadTask,null);assert.equal(sent.length,0);
 fail=false;await ctx.loadRound(m);assert.equal(ctx.loadedRound,1);assert.equal(sent[0].type,'loaded');assert.match($('battleNoticeText').textContent,/本机已就绪/);assert.equal($('reloadAssets').hidden,true);
 console.log('PASS live progress, visible failure, retry and loaded handshake');
 const attempts=[];class Image{constructor(){attempts.push(this)}set src(v){this.url=v}}
 const asset={window:{},Image,setTimeout:(f,ms)=>ms===500?(queueMicrotask(f),1):1,clearTimeout(){}};
 vm.runInNewContext(fs.readFileSync(__dirname+'/asset-loader.js','utf8'),asset);const A=asset.window.GameAssets;
 const p=A.image('test.png');assert.equal(p,A.image('test.png'));attempts[0].onerror();await Promise.resolve();assert.equal(attempts.length,2);attempts[1].onload();await p;
 const q=A.image('bad.png');attempts[2].onerror();await Promise.resolve();attempts[3].onerror();await assert.rejects(q,/下载失败/);
 let active=0,max=0;await A.batch([1,2,3,4,4],async()=>{max=Math.max(max,++active);await new Promise(r=>setImmediate(r));active--});assert.equal(max,3);
 console.log('PASS shared requests, automatic retry, failure and bounded downloads');
}
main().catch(e=>{console.error(e);process.exitCode=1});
