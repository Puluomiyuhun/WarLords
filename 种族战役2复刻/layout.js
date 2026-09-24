/* Display geometry from the supplied SWF, independent of combat coordinates.
 * Root frame 5: game scale=0.245758056640625. DefineSprite_1755 creates Lane (1092).
 * Lane bounds: [-1428.35, -79.3, 1425.05, 83.4]. Lane 1 is nearest.
 * Renderer lane 0 is topmost, preserving the existing controls and v1 saves.
 */
(function(g){
 'use strict';
 const gameScale=0.245758056640625, perspective=0.09999815225601197;
 const sourceWidth=2853.4,sourceHeight=162.7,baseWidth=2703.1921875,baseHeight=162.69951171875;
 const lanes=[];let y=1788.19609375,previousHeight=0;
 for(let i=0;i<8;i++){
  const p=1+perspective*i,h=baseHeight/p;
  if(i)y-=previousHeight/2+h/2;
  lanes.unshift({x:1425.0951171875*gameScale,y:y*gameScale,sx:baseWidth/sourceWidth/p*gameScale,sy:h/sourceHeight*gameScale,halfWidth:baseWidth/p*gameScale/2});
  previousHeight=h;
 }
 const L={width:700,height:500,lanes,worldX:(x,lane)=>lanes[lane].x+x*lanes[lane].sx,
  pickLane:y=>lanes.reduce((best,row,i)=>Math.abs(row.y-y)<Math.abs(lanes[best].y-y)?i:best,0)};
 if(typeof module!=='undefined')module.exports=L;else g.BATTLE_LAYOUT=L;
})(typeof window!=='undefined'?window:globalThis);
