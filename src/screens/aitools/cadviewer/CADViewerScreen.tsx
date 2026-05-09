import React, { FC, useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions,
  ScrollView, TextInput, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import DocumentPicker from 'react-native-document-picker';
import RNFS from 'react-native-fs';
import DxfParser from 'dxf-parser';
import iconv from 'iconv-lite';
import { Buffer } from 'buffer';
import type { RootStackScreenProps } from '@/navigation/types';
import { API_CONFIG } from '@/constants';
import { useAIToolGuard } from '@/hooks';
import { Loading } from '@/components/common/Loading';
import { ChevronLeft } from 'lucide-react-native';
import { BottomSearchBar } from '@/components/common/BottomSearchBar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';

const { width: SCREEN_W } = Dimensions.get('window');
type PageMode = 'select' | 'viewer';
type ViewerMode = 'local' | 'tile' | 'cadviewer';  // local=前端渲染, tile=后端瓦片, cadviewer=cad-viewer WASM
type ToolMode = 'none' | 'measure_dist' | 'measure_area' | 'annotate_text' | 'annotate_draw';
type Props = RootStackScreenProps<'CADViewer'>;

// 文件大小阈值：超过此值走后端瓦片渲染
const TILE_THRESHOLD_BYTES = 1024 * 1024; // 1MB

// baseUrl lets WebView resolve <script src="three.min.js"> from android_asset
const BASE_URL = 'file:///android_asset/';

// Small HTML shell (~3KB). Three.js loaded via relative src resolved by baseUrl.
const VIEWER_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;overflow:hidden;background:#222427;touch-action:none}canvas{display:block}
#mi{position:fixed;bottom:60px;left:50%;transform:translateX(-50%);background:rgba(178,0,0,.9);color:#fff;padding:8px 18px;border-radius:20px;font:bold 14px sans-serif;pointer-events:none;z-index:99;display:none;white-space:nowrap}
#wm{position:fixed;left:12px;bottom:80px;z-index:1000;pointer-events:none;opacity:0.25;font-size:12px;color:#fff;font-family:sans-serif;}
</style></head><body>
<div id="mi"></div>
<div id="wm">领建APP</div>
<script src="three.min.js"></script>
<script>
(function(){
var mi=document.getElementById('mi');
function post(o){try{window.ReactNativeWebView.postMessage(JSON.stringify(o));}catch(e){}}

if(typeof THREE==='undefined'){
  post({type:'diag',value:'THREE is undefined'});
  return;
}


var W=window.innerWidth,H=window.innerHeight;
var scene,cam,renderer,cadG,annG;
try{
  scene=new THREE.Scene();scene.background=new THREE.Color(0x222427);
  cam=new THREE.OrthographicCamera(-W/2,W/2,H/2,-H/2,-1000,1000);
  cam.position.set(0,0,100);cam.lookAt(0,0,0);
  renderer=new THREE.WebGLRenderer({antialias:true});
  renderer.setSize(W,H);renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  document.body.appendChild(renderer.domElement);
  cadG=new THREE.Group();scene.add(cadG);
  annG=new THREE.Group();cadG.add(annG);
}catch(e){
  post({type:'diag',value:'WebGL init error: '+e.message});
  return;
}

var totalL=0,totalT=0;
var center=new THREE.Vector3(),fitScale=1,curScale=1,panX=0,panY=0;
// Store raw data as Float64 arrays — normalization happens in finishRender
var rawLines=[];  // [x1,y1,x2,y2,color, ...]
var rawTexts=[];  // [{t,x,y,h,c}, ...]
var offsetX=0,offsetY=0; // normalization offset (set in finishRender)


post({type:'webviewReady'});
// 如果后端解析数据已嵌入 HTML，直接渲染
if(window._fromServer && window._serverFlat){
  window.addFlat(window._serverFlat);
  if(window._serverTexts) window.addTexts(window._serverTexts);
  window.finishRender();
}
// 如果有服务器数据URL，从后端直接拉取
if(window._serverDataUrl){
  post({type:'loading',msg:'下载数据...'});
  fetch(window._serverDataUrl)
    .then(function(r){return r.json();})
    .then(function(d){
      if(d.flat){window.addFlat(d.flat);}
      if(d.texts){window.addTexts(d.texts);}
      window.finishRender();
    })
    .catch(function(e){post({type:'error',msg:e.message});});
}

window.addFlat=function(a){
  for(var i=0;i<a.length;i++) rawLines.push(a[i]);
  totalL+=Math.floor(a.length/5);

};
window.addTexts=function(ts){
  for(var i=0;i<ts.length;i++) rawTexts.push(ts[i]);
  totalT+=ts.length;
};
window.finishRender=function(){
  var diag='lines='+totalL+' texts='+totalT;

  // ── Step 1: Compute median for normalization ──
  var n=rawLines.length/5;
  if(n===0 && rawTexts.length===0){post({type:'renderDone',diag:'NO_DATA'});return;}

  var allX=[],allY=[];
  // Include line coordinates
  for(var i=0;i<rawLines.length;i+=5){
    allX.push(rawLines[i],rawLines[i+2]);
    allY.push(rawLines[i+1],rawLines[i+3]);
  }
  // Include text coordinates to ensure texts are properly positioned
  for(var i=0;i<rawTexts.length;i++){
    allX.push(rawTexts[i].x);
    allY.push(rawTexts[i].y);
  }
  allX.sort(function(a,b){return a-b;});
  allY.sort(function(a,b){return a-b;});

  var mx=allX[Math.floor(allX.length/2)];
  var my=allY[Math.floor(allY.length/2)];
  offsetX=mx; offsetY=my;
  diag+=' median='+mx.toFixed(1)+','+my.toFixed(1);

  // ── Step 2: Normalize in-place (subtract median) ──
  for(var i=0;i<rawLines.length;i+=5){
    rawLines[i]-=mx; rawLines[i+1]-=my;
    rawLines[i+2]-=mx; rawLines[i+3]-=my;
  }
  // Also normalize text coordinates
  for(var i=0;i<rawTexts.length;i++){
    rawTexts[i].x-=mx;
    rawTexts[i].y-=my;
  }

  // ── Step 3: Detect and remove outliers ──
  // Re-sort normalized coordinates
  var nx=[],ny=[];
  for(var i=0;i<rawLines.length;i+=5){
    nx.push(rawLines[i],rawLines[i+2]);
    ny.push(rawLines[i+1],rawLines[i+3]);
  }
  nx.sort(function(a,b){return a-b;});
  ny.sort(function(a,b){return a-b;});

  var p2=Math.floor(nx.length*0.02);
  var p98=Math.min(nx.length-1,Math.floor(nx.length*0.98));
  var coreW=nx[p98]-nx[p2], coreH=ny[p98]-ny[p2];
  var fullW=nx[nx.length-1]-nx[0], fullH=ny[ny.length-1]-ny[0];
  var needFilter=(coreW>0&&fullW/coreW>2)||(coreH>0&&fullH/coreH>2);
  diag+=' core='+coreW.toFixed(1)+'x'+coreH.toFixed(1)+' full='+fullW.toFixed(1)+'x'+fullH.toFixed(1)+' filter='+needFilter;

  var xLo,xHi,yLo,yHi;
  if(needFilter){
    xLo=nx[p2]-coreW; xHi=nx[p98]+coreW;
    yLo=ny[p2]-coreH; yHi=ny[p98]+coreH;
  }

  // ── Step 4: Build geometry with normalized Float32 data ──
  var buckets={};
  var keptLines=0;
  for(var i=0;i<rawLines.length;i+=5){
    var x1=rawLines[i],y1=rawLines[i+1],x2=rawLines[i+2],y2=rawLines[i+3],k=rawLines[i+4];
    if(needFilter){
      var in1=x1>=xLo&&x1<=xHi&&y1>=yLo&&y1<=yHi;
      var in2=x2>=xLo&&x2<=xHi&&y2>=yLo&&y2<=yHi;
      if(!in1&&!in2) continue;
    }
    if(!buckets[k])buckets[k]=[];
    buckets[k].push(x1,y1,0,x2,y2,0);
    keptLines++;
  }
  rawLines=[];  // free memory

  var colorCount=Object.keys(buckets).length;
  Object.keys(buckets).forEach(function(k){
    var v=buckets[k];var g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));
    cadG.add(new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:parseInt(k)})));
  });
  buckets={};

  var renderedTexts=0;
  rawTexts.forEach(function(t){try{
    var cv=document.createElement('canvas'),ctx=cv.getContext('2d');
    // 使用原始文字高度，保持比例
    var fs=Math.max(12,Math.min(32,Math.round(t.h*3)));
    ctx.font=fs+'px sans-serif';var tw=ctx.measureText(t.t).width+6;
    cv.width=Math.min(2048,Math.max(24,Math.ceil(tw)));cv.height=fs+4;
    ctx.font=fs+'px sans-serif';
    // 确保文字颜色在深色背景上可见
    var textColor = parseInt(t.c) || 0xFFFFFF;
    if (textColor === 0xFFFFFF || textColor === 0xCCCCCC || textColor === 0xC0C0C0 || textColor === 0x000000) {
      textColor = 0xFFFFFF;
    }
    ctx.fillStyle='#'+('000000'+textColor.toString(16)).slice(-6);
    ctx.textBaseline='top';ctx.fillText(t.t,3,2);
    var tex=new THREE.CanvasTexture(cv);tex.minFilter=THREE.LinearFilter;
    var mat=new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false});
    var sp=new THREE.Sprite(mat);
    // CAD 文字锚点在左下角，Sprite 默认锚点在正中心(0.5,0.5)
    // 设置为左下角(0,0)才能正确对齐
    sp.center.set(0, 0);
    var textScale = 1.8; // 放大文字，手机屏幕上更清晰
    sp.scale.set(t.h*textScale*(cv.width/cv.height), t.h*textScale, 1);
    // 文字坐标已经在预处理阶段归一化，这里直接使用
    sp.position.set(t.x, t.y, 1);
    cadG.add(sp);
    renderedTexts++;
  }catch(e){diag+=' TXT_ERR:'+e.message;}});
  diag+=' renderedTexts='+renderedTexts;
  rawTexts=[];

  // ── Step 6: Fit view ──
  var box=new THREE.Box3().setFromObject(cadG);
  if(!box.isEmpty()){
    box.getCenter(center);var sz=new THREE.Vector3();box.getSize(sz);
    fitScale=Math.min(W/(sz.x*1.1),H/(sz.y*1.1));curScale=fitScale;
    cadG.position.set(-center.x*curScale,-center.y*curScale,0);
    cadG.scale.set(curScale,curScale,1);
  }
  post({type:'renderDone'});
};

function upd(){cadG.scale.set(curScale,curScale,1);cadG.position.set(-center.x*curScale+panX,-center.y*curScale+panY,0);}

var touches={},lpd=0,lpx=0,lpy=0,isPan=false,tapS=null;
var tool='none',mPts=[],mLines=[],annots=[],drawPts=[],drawLines=[],pendTP=null;
renderer.domElement.addEventListener('touchstart',function(ev){ev.preventDefault();for(var i=0;i<ev.changedTouches.length;i++){var t=ev.changedTouches[i];touches[t.identifier]={x:t.clientX,y:t.clientY};}var ks=Object.keys(touches);if(ks.length===2){var t1=touches[ks[0]],t2=touches[ks[1]];lpd=Math.hypot(t2.x-t1.x,t2.y-t1.y);}if(ks.length===1){lpx=touches[ks[0]].x;lpy=touches[ks[0]].y;isPan=tool!=='annotate_draw';if(tool!=='none')tapS={x:lpx,y:lpy,time:Date.now()};if(tool==='annotate_draw'){var w=s2w(lpx,lpy);drawPts.push(w);}}},{passive:false});
renderer.domElement.addEventListener('touchmove',function(ev){ev.preventDefault();for(var i=0;i<ev.changedTouches.length;i++){var t=ev.changedTouches[i];touches[t.identifier]={x:t.clientX,y:t.clientY};}var ks=Object.keys(touches);if(ks.length===2){isPan=false;var t1=touches[ks[0]],t2=touches[ks[1]];var d=Math.hypot(t2.x-t1.x,t2.y-t1.y);if(lpd>0){var pmx=(t1.x+t2.x)/2,pmy=(t1.y+t2.y)/2;var wx=s2w(pmx,pmy).x;var wy=s2w(pmx,pmy).y;curScale*=d/lpd;curScale=Math.max(fitScale*0.1,Math.min(fitScale*200,curScale));panX=pmx-(wx-center.x)*curScale-W/2;panY=-(wy-center.y)*curScale-pmy+H/2;upd();}lpd=d;}else if(ks.length===1&&isPan){panX+=touches[ks[0]].x-lpx;panY-=touches[ks[0]].y-lpy;lpx=touches[ks[0]].x;lpy=touches[ks[0]].y;upd();}else if(ks.length===1&&tool==='annotate_draw'){var cx=touches[ks[0]].x;var cy=touches[ks[0]].y;var w=s2w(cx,cy);if(drawPts.length>0){var last=drawPts[drawPts.length-1];var dist=Math.hypot(w.x-last.x,w.y-last.y);if(dist>0.5/curScale){drawPts.push(w);var g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([last.x,last.y,2,w.x,w.y,2],3));var dl=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:0xff6600,linewidth:2}));annG.add(dl);drawLines.push(dl);}}}},{passive:false});
renderer.domElement.addEventListener('touchend',function(ev){for(var i=0;i<ev.changedTouches.length;i++)delete touches[ev.changedTouches[i].identifier];if(Object.keys(touches).length<2)lpd=0;isPan=false;if(tapS&&ev.changedTouches.length>0){var ct=ev.changedTouches[0];if(Date.now()-tapS.time<400&&Math.hypot(ct.clientX-tapS.x,ct.clientY-tapS.y)<15)onTap(ct.clientX,ct.clientY);tapS=null;}});

function s2w(sx,sy){return{x:(sx-panX-W/2)/curScale+center.x,y:-(sy+panY-H/2)/curScale+center.y};}
function mk(w,cl){var s=8/curScale;var c=cl||0xff3333;var g1=new THREE.BufferGeometry();g1.setAttribute('position',new THREE.Float32BufferAttribute([w.x-s,w.y,2,w.x+s,w.y,2],3));var g2=new THREE.BufferGeometry();g2.setAttribute('position',new THREE.Float32BufferAttribute([w.x,w.y-s,2,w.x,w.y+s,2],3));var m1=new THREE.LineSegments(g1,new THREE.LineBasicMaterial({color:c,linewidth:3}));var m2=new THREE.LineSegments(g2,new THREE.LineBasicMaterial({color:c,linewidth:3}));annG.add(m1);annG.add(m2);mLines.push(m1,m2);}
function ml(p1,p2){var g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([p1.x,p1.y,2,p2.x,p2.y,2],3));var l=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:0xff3333,linewidth:2}));annG.add(l);return l;}
function clrM(){mPts=[];drawPts=[];mLines.forEach(function(l){annG.remove(l);l.geometry.dispose();});mLines=[];drawLines.forEach(function(l){annG.remove(l);l.geometry.dispose();});drawLines=[];mi.style.display='none';}
function fD(d){if(d>=1000)return(d/1000).toFixed(2)+' km';if(d>=1)return d.toFixed(2)+' m';return(d*1000).toFixed(1)+' mm';}
function fA(a){if(a>=1e6)return(a/1e6).toFixed(2)+' km²';if(a>=1)return a.toFixed(2)+' m²';return(a*1e6).toFixed(0)+' mm²';}
function cA(pts){var a=0;for(var i=0;i<pts.length;i++){var j=(i+1)%pts.length;a+=pts[i].x*pts[j].y-pts[j].x*pts[i].y;}return Math.abs(a)/2;}
function onTap(sx,sy){var w=s2w(sx,sy);
  if(tool==='measure_dist'){mPts.push(w);mk(w);if(mPts.length===2){mLines.push(ml(mPts[0],mPts[1]));var d=Math.hypot(mPts[1].x-mPts[0].x,mPts[1].y-mPts[0].y);var t='距离: '+fD(d);mi.textContent=t;mi.style.display='block';post({type:'measureResult',value:t});mPts=[];}}
  else if(tool==='measure_area'){mPts.push(w);mk(w,0x33cc33);if(mPts.length>=2)mLines.push(ml(mPts[mPts.length-2],mPts[mPts.length-1]));if(mPts.length>=3){mi.textContent='面积: '+fA(cA(mPts));mi.style.display='block';}}
  else if(tool==='annotate_text'){pendTP=w;post({type:'requestText'});}
  else if(tool==='annotate_draw'){drawPts=[];}
}
window.handleRNMessage=function(msg){
  if(msg.type==='setTool'){tool=msg.value||'none';clrM();drawPts=[];}
  else if(msg.type==='placeText'&&pendTP){try{var cv=document.createElement('canvas'),ctx=cv.getContext('2d'),fs=20;ctx.font='bold '+fs+'px sans-serif';var tw=ctx.measureText(msg.value).width;var pw=tw+20,ph=fs+14;cv.width=pw;cv.height=ph;ctx.fillStyle='rgba(178,0,0,.85)';ctx.fillRect(0,0,pw,ph);ctx.fillStyle='#fff';ctx.font='bold '+fs+'px sans-serif';ctx.textBaseline='middle';ctx.fillText(msg.value,10,ph/2);var tex=new THREE.CanvasTexture(cv);tex.minFilter=THREE.LinearFilter;var mat=new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false});var sp=new THREE.Sprite(mat);var sc=8/curScale;sp.scale.set(sc*pw/ph,sc,1);sp.position.set(pendTP.x,pendTP.y,3);annG.add(sp);annots.push(sp);}catch(e){}pendTP=null;}
  else if(msg.type==='fitView'){curScale=fitScale;panX=0;panY=0;upd();}
  else if(msg.type==='clearAnnotations'){annots.forEach(function(a){annG.remove(a);});annots=[];clrM();}
  else if(msg.type==='endArea'&&mPts.length>=3){mLines.push(ml(mPts[mPts.length-1],mPts[0]));var t='面积: '+fA(cA(mPts));mi.textContent=t;post({type:'measureResult',value:t});mPts=[];}
};
function animate(){requestAnimationFrame(animate);renderer.render(scene,cam);}animate();
window.addEventListener('resize',function(){W=window.innerWidth;H=window.innerHeight;cam.left=-W/2;cam.right=W/2;cam.top=H/2;cam.bottom=-H/2;cam.updateProjectionMatrix();renderer.setSize(W,H);});
})();
</script></body></html>`;

// ── ACI color ──────────────────────────────────────────────────────────
// AutoCAD Color Index (ACI) to RGB hex conversion
// Based on AutoCAD standard color palette
function aciToHex(c: number): number {
  // Standard ACI color palette (0-255)
  const aciPalette: number[] = [
    0x000000, 0xFF0000, 0xFFFF00, 0x00FF00, 0x00FFFF, 0x0000FF, 0xFF00FF, 0xFFFFFF,
    0x808080, 0xC0C0C0, 0xFF0000, 0xFF7F7F, 0xA50000, 0xA55252, 0x7F0000, 0x7F3F3F,
    0x4C0000, 0x4C2626, 0x260000, 0x261313, 0xFF3F00, 0xFF9F7F, 0xA52900, 0xA56752,
    0x7F1F00, 0x7F4F3F, 0x4C1300, 0x4C2F26, 0x260900, 0x261713, 0xFF7F00, 0xFFBF7F,
    0xA55200, 0xA57C52, 0x7F3F00, 0x7F5F3F, 0x4C2600, 0x4C3926, 0x261300, 0x261C13,
    0xFFBF00, 0xFFDF7F, 0xA57C00, 0xA59152, 0x7F5F00, 0x7F6F3F, 0x4C3900, 0x4C4226,
    0x261C00, 0x262113, 0xFFFF00, 0xFFFF7F, 0xA5A500, 0xA5A552, 0x7F7F00, 0x7F7F3F,
    0x4C4C00, 0x4C4C26, 0x262600, 0x262613, 0xBFFF00, 0xDFFF7F, 0x7CA500, 0x91A552,
    0x5F7F00, 0x6F7F3F, 0x394C00, 0x424C26, 0x1C2600, 0x212613, 0x7FFF00, 0xBFFF7F,
    0x52A500, 0x7CA552, 0x3F7F00, 0x5F7F3F, 0x264C00, 0x394C26, 0x132600, 0x1C2613,
    0x3FFF00, 0x9FFF7F, 0x29A500, 0x67A552, 0x1F7F00, 0x4F7F3F, 0x134C00, 0x2F4C26,
    0x092600, 0x172613, 0x00FF00, 0x7FFF7F, 0x00A500, 0x52A552, 0x007F00, 0x3F7F3F,
    0x004C00, 0x264C26, 0x002600, 0x132613, 0x00FF3F, 0x7FFF9F, 0x00A529, 0x52A567,
    0x007F1F, 0x3F7F4F, 0x004C13, 0x264C2F, 0x002609, 0x132617, 0x00FF7F, 0x7FFFBF,
    0x00A552, 0x52A57C, 0x007F3F, 0x3F7F5F, 0x004C26, 0x264C39, 0x002613, 0x13261C,
    0x00FFBF, 0x7FFFDF, 0x00A57C, 0x52A591, 0x007F5F, 0x3F7F6F, 0x004C39, 0x264C42,
    0x00261C, 0x132621, 0x00FFFF, 0x7FFFFF, 0x00A5A5, 0x52A5A5, 0x007F7F, 0x3F7F7F,
    0x004C4C, 0x264C4C, 0x002626, 0x132626, 0x00BFFF, 0x7FDFFF, 0x007CA5, 0x5291A5,
    0x005F7F, 0x3F6F7F, 0x00394C, 0x26424C, 0x001C26, 0x132126, 0x007FFF, 0x7FBFFF,
    0x0052A5, 0x527CA5, 0x003F7F, 0x3F5F7F, 0x00264C, 0x26394C, 0x001326, 0x131C26,
    0x003FFF, 0x7F9FFF, 0x0029A5, 0x5267A5, 0x001F7F, 0x3F4F7F, 0x00134C, 0x262F4C,
    0x000926, 0x131726, 0x0000FF, 0x7F7FFF, 0x0000A5, 0x5252A5, 0x00007F, 0x3F3F7F,
    0x00004C, 0x26264C, 0x000026, 0x131326, 0x3F00FF, 0x9F7FFF, 0x2900A5, 0x6752A5,
    0x1F007F, 0x4F3F7F, 0x13004C, 0x2F264C, 0x090026, 0x171326, 0x7F00FF, 0xBF7FFF,
    0x5200A5, 0x7C52A5, 0x3F007F, 0x5F3F7F, 0x26004C, 0x39264C, 0x130026, 0x1C1326,
    0xBF00FF, 0xDF7FFF, 0x7C00A5, 0x9152A5, 0x5F007F, 0x6F3F7F, 0x39004C, 0x42264C,
    0x1C0026, 0x211326, 0xFF00FF, 0xFF7FFF, 0xA500A5, 0xA552A5, 0x7F007F, 0x7F3F7F,
    0x4C004C, 0x4C264C, 0x260026, 0x261326, 0xFF00BF, 0xFF7FDF, 0xA5007C, 0xA55291,
    0x7F005F, 0x7F3F6F, 0x4C0039, 0x4C2642, 0x26001C, 0x261321, 0xFF007F, 0xFF7FBF,
    0xA50052, 0xA5527C, 0x7F003F, 0x7F3F5F, 0x4C0026, 0x4C2639, 0x260013, 0x26131C,
    0xFF003F, 0xFF7F9F, 0xA50029, 0xA55267, 0x7F001F, 0x7F3F4F, 0x4C0013, 0x4C262F,
    0x260009, 0x261317
  ];
  
  if (c >= 0 && c < aciPalette.length) {
    return aciPalette[c];
  }
  
  // Default colors
  if (c === 7 || c === 0) return 0xFFFFFF;
  if (c === 256) return 0xCCCCCC; // ByLayer
  return 0xCCCCCC;
}

// ── Extract ATTRIB entities from raw DXF text ──────────────────────────
// dxf-parser doesn't parse ATTRIB entities (only ATTDEF in block definitions).
// In DXF files, INSERT entities are followed by ATTRIB entities (INSERT → ATTRIB × N → SEQEND).
// These ATTRIBs contain the actual filled-in values for title blocks, revision tables, etc.
function extractAttribsFromRawDxf(content: string): { t: string; x: number; y: number; h: number; c: number }[] {
  const attribs: { t: string; x: number; y: number; h: number; c: number }[] = [];
  // 只搜索 ENTITIES section（ATTRIB 只出现在这里）
  let entStart = content.indexOf('\nENTITIES\r\n');
  if (entStart < 0) entStart = content.indexOf('\nENTITIES\n');
  if (entStart < 0) return attribs;
  let entEnd = content.indexOf('\nENDSEC\r\n', entStart);
  if (entEnd < 0) entEnd = content.indexOf('\nENDSEC\n', entStart);
  const entSection = entEnd > 0 ? content.substring(entStart, entEnd) : content.substring(entStart);
  const lines = entSection.split(/\r?\n/);
  let i = 0;
  while (i < lines.length - 1) {
    const code = lines[i]?.trim();
    const val = lines[i + 1]?.trim();
    if (code === '0' && val === 'ATTRIB') {
      let text = '', tag = '';
      let x1 = 0, y1 = 0, x2 = NaN, y2 = NaN;
      let h = 2.5, color = 0xCCCCCC, hJust = 0, vJust = 0;
      let j = i + 2;
      while (j < lines.length - 1) {
        const gc = lines[j]?.trim();
        const gv = lines[j + 1]?.trim();
        if (gc === '0') break;
        const cn = parseInt(gc);
        switch (cn) {
          case 1: text = gv || ''; break;
          case 2: tag = gv || ''; break;
          case 10: x1 = parseFloat(gv) || 0; break;
          case 20: y1 = parseFloat(gv) || 0; break;
          case 11: x2 = parseFloat(gv) || 0; break;
          case 21: y2 = parseFloat(gv) || 0; break;
          case 40: h = parseFloat(gv) || 2.5; break;
          case 62: { const ci = parseInt(gv); if (ci >= 0 && ci <= 256) color = aciToHex(ci); break; }
          case 72: hJust = parseInt(gv) || 0; break;
          case 74: vJust = parseInt(gv) || 0; break;
        }
        j += 2;
      }
      const finalText = (text || tag).trim();
      if (finalText) {
        if (h <= 0 || h > 1000) h = 2.5;
        let finalX = x1, finalY = y1;
        if ((hJust !== 0 || vJust !== 0) && !isNaN(x2) && !isNaN(y2)) {
          finalX = x2; finalY = y2;
        }
        attribs.push({ t: finalText.substring(0, 60), x: finalX, y: finalY, h, c: color });
      }
      i = j;
    } else {
      i += 2;
    }
  }
  return attribs;
}

// ── Preprocess DXF ─────────────────────────────────────────────────────
function preprocessDxf(dxf: any, rawAttribs?: { t: string; x: number; y: number; h: number; c: number }[]) {
  const flat: number[] = [];
  const texts: { t: string; x: number; y: number; h: number; c: number }[] = [];
  const layerSet = new Set<string>();
  const layerColors: Record<string, number> = {};
  if (dxf.tables?.layer?.layers) {
    for (const n of Object.keys(dxf.tables.layer.layers)) {
      const layer = dxf.tables.layer.layers[n];
      // dxf-parser: layer.color 已是 RGB 值，layer.colorIndex 是 ACI 索引
      if (layer.color !== undefined && layer.color !== 0) {
        layerColors[n] = layer.color;
      } else if (layer.colorIndex !== undefined) {
        layerColors[n] = aciToHex(layer.colorIndex);
      } else {
        layerColors[n] = 0xFFFFFF; // 默认白色
      }
    }
  }
  const gc = (e: any) => {
    // dxf-parser 存储方式：
    // e.colorIndex = 原始 ACI 索引 (0=ByBlock, 256=ByLayer, 1-255=ACI)
    // e.color = 已转换的 RGB 值 (通过 getAcadColor 转换)，或 TrueColor (code 420)
    // 判断 ByBlock/ByLayer 需要用 colorIndex，不能用 color
    const ci = e.colorIndex;
    if (ci === undefined || ci === 0 || ci === 256) {
      // ByLayer 或 ByBlock：使用图层颜色
      return layerColors[e.layer] ?? 0xCCCCCC;
    }
    // 如果有已转换的颜色值（RGB），直接使用
    if (e.color !== undefined && e.color !== 0) {
      return e.color;
    }
    // fallback: 用 ACI 索引转换
    return aciToHex(ci);
  };
  const L = (x1: number, y1: number, x2: number, y2: number, c: number) => {
    if (isFinite(x1) && isFinite(y1) && isFinite(x2) && isFinite(y2))
      flat.push(+x1.toFixed(2), +y1.toFixed(2), +x2.toFixed(2), +y2.toFixed(2), c);
  };
  const WX = (px: number, py: number, bx: number, by: number, sx: number, sy: number, cs: number, sn: number) => (px*sx)*cs-(py*sy)*sn+bx;
  const WY = (px: number, py: number, bx: number, by: number, sx: number, sy: number, cs: number, sn: number) => (px*sx)*sn+(py*sy)*cs+by;
  function arcSeg(cx: number, cy: number, r: number, sa: number, ea: number, c: number, seg = 32) {
    if (ea < sa) ea += Math.PI * 2;
    for (let i = 0; i < seg; i++) { const a1=sa+(i/seg)*(ea-sa), a2=sa+((i+1)/seg)*(ea-sa); L(cx+r*Math.cos(a1),cy+r*Math.sin(a1),cx+r*Math.cos(a2),cy+r*Math.sin(a2),c); }
  }
  function proc(e: any, depth: number, bx: number, by: number, sx: number, sy: number, cs: number, sn: number) {
    if (!e?.type || depth > 8) return;
    if (e.layer) layerSet.add(e.layer);
    const c = gc(e);
    const id = bx===0&&by===0&&sx===1&&sy===1&&cs===1&&sn===0;
    const px = (p: any) => id ? (p?.x??0) : WX(p?.x??0,p?.y??0,bx,by,sx,sy,cs,sn);
    const py = (p: any) => id ? (p?.y??0) : WY(p?.x??0,p?.y??0,bx,by,sx,sy,cs,sn);
    try { switch(e.type) {
      case 'LINE': { const v=e.vertices; if(v?.length>=2) L(px(v[0]),py(v[0]),px(v[1]),py(v[1]),c); break; }
      case 'LWPOLYLINE': case 'POLYLINE': { const v=e.vertices??[]; for(let i=0;i<v.length-1;i++) if(v[i]&&v[i+1]) L(px(v[i]),py(v[i]),px(v[i+1]),py(v[i+1]),c); if(e.shape&&v.length>1) L(px(v[v.length-1]),py(v[v.length-1]),px(v[0]),py(v[0]),c); break; }
      case 'CIRCLE': if(e.center) arcSeg(px(e.center),py(e.center),(e.radius??0)*Math.abs(sx),0,Math.PI*2,c,48); break;
      case 'ARC': if(e.center) arcSeg(px(e.center),py(e.center),(e.radius??0)*Math.abs(sx),(e.startAngle??0)*Math.PI/180,(e.endAngle??360)*Math.PI/180,c,32); break;
      case 'ELLIPSE': { if(!e.center||!e.majorAxisEndPoint) break; const cx2=px(e.center),cy2=py(e.center); const mxr=(e.majorAxisEndPoint.x??0)*sx,myr=(e.majorAxisEndPoint.y??0)*sy; const rmx=mxr*cs-myr*sn,rmy=mxr*sn+myr*cs; const a=Math.hypot(rmx,rmy); if(a<1e-10) break; const b=a*(e.axisRatio??1),ang=Math.atan2(rmy,rmx); let sa=e.startAngle??0,ea=e.endAngle??Math.PI*2; if(ea<sa) ea+=Math.PI*2; for(let i=0;i<48;i++){const t1=sa+(i/48)*(ea-sa),t2=sa+((i+1)/48)*(ea-sa); L(cx2+a*Math.cos(t1)*Math.cos(ang)-b*Math.sin(t1)*Math.sin(ang),cy2+a*Math.cos(t1)*Math.sin(ang)+b*Math.sin(t1)*Math.cos(ang),cx2+a*Math.cos(t2)*Math.cos(ang)-b*Math.sin(t2)*Math.sin(ang),cy2+a*Math.cos(t2)*Math.sin(ang)+b*Math.sin(t2)*Math.cos(ang),c);} break; }
      case 'SPLINE': { const pts2=e.controlPoints??e.fitPoints??[]; for(let i=0;i<pts2.length-1;i++) if(pts2[i]&&pts2[i+1]) L(px(pts2[i]),py(pts2[i]),px(pts2[i+1]),py(pts2[i+1]),c); break; }
      case 'INSERT': {
        const blk=dxf.blocks?.[e.name];
        if(!blk?.entities?.length && !e.attribs?.length) break;
        const nbx=px(e.position),nby=py(e.position);
        const nsx=(e.xScale??1)*sx,nsy=(e.yScale??1)*sy;
        const rot=(e.rotation??0)*Math.PI/180;
        const ncs=Math.cos(rot)*cs-Math.sin(rot)*sn,nsn=Math.sin(rot)*cs+Math.cos(rot)*sn;
        // 处理块定义中的实体（线条、弧线等几何图形）
        if (blk?.entities?.length) {
          for(const be of blk.entities) try{proc(be,depth+1,nbx,nby,nsx,nsy,ncs,nsn);}catch{}
        }
        // 处理 INSERT 自身携带的 attribs（属性值覆盖）
        // 这些是块插入时填写的实际文字内容，如标题栏中的公司名、日期、图号等
        // attribs 的坐标是相对于 INSERT 的插入点的，需要应用相同的变换
        if (e.attribs?.length) {
          for (const attr of e.attribs) {
            try {
              const attrText = (attr.text ?? attr.textTag ?? attr.tag ?? '').trim();
              if (!attrText) continue;
              // attrib 的坐标处理：
              // dxf-parser 中 attrib 的 startPoint/position 通常是绝对坐标（世界坐标）
              // 而不是相对于块插入点的坐标，所以应该直接使用，不需要块变换
              const atp = attr.startPoint ?? attr.position;
              if (!atp) continue;
              let th = attr.textHeight ?? 2.5;
              if (th <= 0 || th > 1000) th = 2.5;
              const ac = gc(attr);
              // 尝试用块变换坐标
              const ax = WX(atp.x ?? 0, atp.y ?? 0, nbx, nby, nsx, nsy, ncs, nsn);
              const ay = WY(atp.x ?? 0, atp.y ?? 0, nbx, nby, nsx, nsy, ncs, nsn);
              // 同时也计算不经过块变换的坐标（有些 DXF 文件 attrib 坐标是绝对坐标）
              const absX = id ? (atp.x ?? 0) : WX(atp.x ?? 0, atp.y ?? 0, bx, by, sx, sy, cs, sn);
              const absY = id ? (atp.y ?? 0) : WY(atp.x ?? 0, atp.y ?? 0, bx, by, sx, sy, cs, sn);
              texts.push({t: attrText.substring(0, 60), x: absX, y: absY, h: th, c: ac});
            } catch {}
          }
        }
        break;
      }
      case 'TEXT': case 'MTEXT': { 
        // TEXT 有两个对齐点：startPoint(code10) 和 endPoint(code11)
        // 当有水平/垂直对齐(halign≠0 或 valign≠0)时，实际显示在 endPoint
        // MTEXT 只使用 position(code10)
        let tp;
        if (e.type === 'TEXT' && (e.halign || e.valign) && e.endPoint) {
          tp = e.endPoint;
        } else {
          tp = e.startPoint ?? e.position;
        }
        let txt=e.text??''; 
        if(e.type==='MTEXT') {
          // MTEXT 格式清理：保留文字内容，只移除格式控制码
          // 注意：{} 是分组符号，内部包含实际文字，不能整体删除！
          // 例如 {\fSimSun;浙江天辰建筑设计有限公司} 应保留 "浙江天辰建筑设计有限公司"
          txt = txt
            .replace(/\\P/g, ' ')           // \P → 换行符替换为空格
            .replace(/\\~/g, ' ')           // \~ → 不间断空格
            .replace(/\{/g, '')             // 移除左花括号（保留内部内容）
            .replace(/\}/g, '')             // 移除右花括号（保留内部内容）
            .replace(/\\[fF][^;]*;/g, '')   // \fFontName; → 移除字体指定
            .replace(/\\[hH][^;]*;/g, '')   // \Hvalue; → 移除高度
            .replace(/\\[wW][^;]*;/g, '')   // \Wvalue; → 移除宽度因子
            .replace(/\\[qQ][^;]*;/g, '')   // \Qangle; → 移除倾斜角度
            .replace(/\\[aA][^;]*;/g, '')   // \Aalignment; → 移除对齐
            .replace(/\\[cC][^;]*;/g, '')   // \Ccolor; → 移除颜色
            .replace(/\\[tT][^;]*;/g, '')   // \Tvalue; → 移除字间距
            .replace(/\\[sS][^;]*;/g, '')   // \Svalue; → 移除堆叠分数
            .replace(/\\[pP]i[^;]*;/g, '')  // \pi...; → 移除段落缩进
            .replace(/\\[oOlLkK]/g, '')     // \O \o \L \l \K \k → 移除上划线/下划线/删除线开关
            .replace(/%%d/gi, '°')          // %%d → 度数符号
            .replace(/%%p/gi, '±')          // %%p → 正负号
            .replace(/%%c/gi, '⌀')          // %%c → 直径符号
            .replace(/%%u/gi, '')           // %%u → 下划线开关（仅格式，无显示字符）
            .replace(/%%[0-9]{3}/g, '')     // %%nnn → ASCII 字符代码
            .replace(/\\/g, '');            // 移除残余的反斜杠
        }
        txt=txt.trim().substring(0,60); 
        if(txt) {
          // 确保文字高度有效，如果太小则使用默认值
          // 注意：TEXT 实体用 textHeight，MTEXT 实体用 height
          let th = e.textHeight ?? e.height ?? 2.5;
          if (th <= 0 || th > 1000) th = 2.5; // 防止异常值
          const x = px(tp);
          const y = py(tp);

          texts.push({t:txt,x:x,y:y,h:th,c});
        }
        break; 
      }
      case 'ATTRIB': case 'ATTDEF': { 
        // ATTDEF 也有两个对齐点，当有对齐方式时用 endPoint
        let tpA;
        if ((e.horizontalJustification || e.verticalJustification) && e.endPoint) {
          tpA = e.endPoint;
        } else {
          tpA = e.startPoint ?? e.position;
        }
        const txt2=(e.text??e.tag??'').trim().substring(0,60); 
        if(txt2) {
          // 确保文字高度有效
          let th = e.textHeight ?? 2.5;
          if (th <= 0 || th > 1000) th = 2.5;
          texts.push({t:txt2,x:px(tpA),y:py(tpA),h:th,c});
        }
        break; 
      }
      case 'POINT': { const s=0.5,ppx=px(e.position),ppy=py(e.position); L(ppx-s,ppy-s,ppx+s,ppy+s,c); L(ppx-s,ppy+s,ppx+s,ppy-s,c); break; }
      case 'SOLID': case '3DFACE': case 'TRACE': { const ptsa=e.points??[]; for(let i=0;i<ptsa.length;i++){const j=(i+1)%ptsa.length; if(ptsa[i]&&ptsa[j]) L(px(ptsa[i]),py(ptsa[i]),px(ptsa[j]),py(ptsa[j]),c);} break; }
      case 'DIMENSION': if(e.anchorPoint&&e.middleOfText) L(px(e.anchorPoint),py(e.anchorPoint),px(e.middleOfText),py(e.middleOfText),c); break;
      case 'LEADER': { const v2=e.vertices??[]; for(let i=0;i<v2.length-1;i++) if(v2[i]&&v2[i+1]) L(px(v2[i]),py(v2[i]),px(v2[i+1]),py(v2[i+1]),c); break; }
    }} catch{}
  }
  for (const e of (dxf.entities??[])) try{proc(e,0,0,0,1,1,1,0);}catch{}

  if (rawAttribs?.length) {
    for (const attr of rawAttribs) {
      const isDuplicate = texts.some(t =>
        t.t === attr.t && Math.abs(t.x - attr.x) < 1 && Math.abs(t.y - attr.y) < 1
      );
      if (!isDuplicate) {
        texts.push(attr);
      }
    }
  }

  // ── Phase 1: Always normalize coordinates (subtract median) ──
  if (flat.length >= 5) {
    const allX: number[] = [];
    const allY: number[] = [];
    for (let i = 0; i < flat.length; i += 5) {
      allX.push(flat[i], flat[i+2]);
      allY.push(flat[i+1], flat[i+3]);
    }
    allX.sort((a, b) => a - b);
    allY.sort((a, b) => a - b);

    const cx = allX[Math.floor(allX.length / 2)];
    const cy = allY[Math.floor(allY.length / 2)];

    for (let i = 0; i < flat.length; i += 5) {
      flat[i]   -= cx;
      flat[i+1] -= cy;
      flat[i+2] -= cx;
      flat[i+3] -= cy;
    }
    for (const t of texts) { t.x -= cx; t.y -= cy; }

    // ── Phase 2: Detect and remove extreme outliers ──
    const nx: number[] = [];
    const ny: number[] = [];
    for (let i = 0; i < flat.length; i += 5) {
      nx.push(flat[i], flat[i+2]);
      ny.push(flat[i+1], flat[i+3]);
    }
    for (const t of texts) { nx.push(t.x); ny.push(t.y); }
    nx.sort((a, b) => a - b);
    ny.sort((a, b) => a - b);

    const p2  = Math.floor(nx.length * 0.02);
    const p98 = Math.min(nx.length - 1, Math.floor(nx.length * 0.98));
    const coreW = nx[p98] - nx[p2];
    const coreH = ny[p98] - ny[p2];
    const fullW = nx[nx.length - 1] - nx[0];
    const fullH = ny[ny.length - 1] - ny[0];

    const needFilter = (coreW > 0 && fullW / coreW > 2) ||
                       (coreH > 0 && fullH / coreH > 2);

    if (needFilter) {
      const xLo = nx[p2]  - coreW;
      const xHi = nx[p98] + coreW;
      const yLo = ny[p2]  - coreH;
      const yHi = ny[p98] + coreH;

      const kept: number[] = [];
      for (let i = 0; i < flat.length; i += 5) {
        const x1 = flat[i], y1 = flat[i+1], x2 = flat[i+2], y2 = flat[i+3];
        const in1 = x1 >= xLo && x1 <= xHi && y1 >= yLo && y1 <= yHi;
        const in2 = x2 >= xLo && x2 <= xHi && y2 >= yLo && y2 <= yHi;
        if (in1 || in2) {
          kept.push(x1, y1, x2, y2, flat[i+4]);
        }
      }
      flat.length = 0;
      for (let i = 0; i < kept.length; i++) flat.push(kept[i]);
    }
  }

  return { flat, texts, layers: Array.from(layerSet).sort(), layerColors };
}

// Component
// 权限检查包装组件
const CADViewerGuard: FC<Props> = ({ navigation, route }) => {
  const guard = useAIToolGuard('cad_viewer');
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    console.log('[CADViewer] 检查权限...');
    guard().then((result) => {
      console.log('[CADViewer] 权限检查结果:', result);
      if (!result) navigation.goBack();
      setAllowed(result);
    }).catch((err) => {
      console.error('[CADViewer] 权限检查失败:', err);
      navigation.goBack();
      setAllowed(false);
    });
  }, []);

  if (allowed === null || !allowed) {
    return null;
  }

  return <CADViewerMainContent navigation={navigation} route={route} />;
};

// 主内容组件（确保 hooks 调用顺序一致）
const CADViewerMainContent: FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const hasSharedFile = !!route.params?.sharedFile;
  const [mode, setMode] = useState<PageMode>(hasSharedFile ? 'viewer' : 'select');
  const [viewerMode, setViewerMode] = useState<ViewerMode>('local');
  const [toolMode, setToolMode] = useState<ToolMode>('none');
  const [fileName, setFileName] = useState(hasSharedFile ? (route.params!.sharedFile!.name || '') : '');
  const [showViewer, setShowViewer] = useState(false);
  const [renderData, setRenderData] = useState<{ flat: number[]; texts: any[] } | null>(null);
  const [webViewReady, setWebViewReady] = useState(false);
  const [isLoading, setIsLoading] = useState(hasSharedFile);
  const [loadingMsg, setLoadingMsg] = useState('loading...');
  const [layerList, setLayerList] = useState<string[]>([]);
  const [showLayers, setShowLayers] = useState(false);
  const [annotateText, setAnnotateText] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [measureResult, setMeasureResult] = useState('');
  const [webViewKey, setWebViewKey] = useState(0);
  const [tileUrl, setTileUrl] = useState('');
  const [embeddedHtml, setEmbeddedHtml] = useState('');
  const [serverDataUrl, setServerDataUrl] = useState('');
  const webRef = useRef<WebView>(null);
  const tileWebRef = useRef<WebView>(null);
  const cadViewerRef = useRef<WebView>(null);
  const [cadViewerUrl, setCadViewerUrl] = useState('');
  const cadServerStarted = useRef(false);

  // ── 历史记录 ──
  interface CadHistoryItem { id: string; name: string; uri: string; time: number; }
  const [historyList, setHistoryList] = useState<CadHistoryItem[]>([]);
  const [searchText, setSearchText] = useState('');
  const HISTORY_KEY = 'cad_history_list';

  // 返回按钮组件 - 统一使用圆形黑色半透明样式
  const BackButton = ({ onPress, style }: { onPress: () => void; style?: any }) => (
    <TouchableOpacity style={[styles.backBtn, { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }, style]} onPress={onPress} activeOpacity={0.7}>
      <ChevronLeft size={24} color="#fff" />
    </TouchableOpacity>
  );

  useEffect(() => {
    AsyncStorage.getItem(HISTORY_KEY).then(raw => {
      if (raw) try { setHistoryList(JSON.parse(raw)); } catch {}
    });
  }, []);

  const addHistory = useCallback((name: string, uri: string) => {
    setHistoryList(prev => {
      const item: CadHistoryItem = { id: name + '_' + Date.now(), name, uri, time: Date.now() };
      const next = [item, ...prev.filter(i => i.name !== name)].slice(0, 50);
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const updateHistoryTime = useCallback((name: string) => {
    setHistoryList(prev => {
      const item = prev.find(i => i.name === name);
      if (!item) return prev;
      const updated = { ...item, time: Date.now() };
      const next = [updated, ...prev.filter(i => i.name !== name)].slice(0, 50);
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const formatTime = (t: number) => {
    const d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  const loadDwgWithCadViewer = async (uri: string, name: string) => {
    try {
      setFileName(name);
      setIsLoading(true);
      setLoadingMsg('启动 CAD-Viewer...');
      setMode('viewer');
      setViewerMode('cadviewer');
      setShowViewer(false);
      setWebViewKey(k => k + 1);

      // Read DWG file
      let fileUri = uri;
      if (Platform.OS === 'android' && fileUri.startsWith('content://')) {
        const dest = `${RNFS.CachesDirectoryPath}/${name}`;
        await RNFS.copyFile(fileUri, dest);
        fileUri = 'file://' + dest;
      }
      const filePath = fileUri.replace('file://', '');
      setLoadingMsg('读取图纸...');
      const b64 = await RNFS.readFile(filePath, 'base64');

      // Start local HTTP server (NativeModule) to serve assets via http://
      if (!cadServerStarted.current) {
        setLoadingMsg('启动本地服务...');
        const { NativeModules } = require('react-native');
        const url: string = await NativeModules.AssetServer.start();
        setCadViewerUrl(`${url}/cad-viewer.html`);
        cadServerStarted.current = true;
      }

      // Store DWG data; inject after WebView engineReady event
      (cadViewerRef as any)._pendingDwg = { b64, name };
      setShowViewer(true);
      setIsLoading(false);
    } catch (err: any) {
      Alert.alert('打开失败', err.message || String(err));
      setIsLoading(false);
    }
  };



  const loadViaTiles = async (uri: string, name: string) => {
    try {
      setFileName(name); setIsLoading(true); setMode('viewer');
      setViewerMode('local'); setShowViewer(false);
      // 重置状态
      setWebViewReady(false);
      setRenderData(null);
      setServerDataUrl('');
      setEmbeddedHtml('');

      const apiBase = API_CONFIG.BASE_URL;
      let fileHash = '';
      let layers: string[] = [];

      // 尝试上传并解析
      setLoadingMsg('上传解析中...');
      const formData = new FormData();
      formData.append('file', {
        uri: uri,
        type: 'application/octet-stream',
        name: name,
      } as any);

      const resp = await fetch(`${apiBase}/api/cad/parse`, {
        method: 'POST',
        body: formData,
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`服务器错误 (${resp.status}): ${errText}`);
      }

      const result = await resp.json();
      if (!result.success) throw new Error('解析失败');
      fileHash = result.file_hash;
      layers = result.layers ?? [];

      setLoadingMsg('下载数据...');
      setLayerList(layers);

      // 从后端拉取完整矢量数据（gzip 压缩，~1MB 代替 ~10MB）
      const dataResp = await fetch(`${apiBase}/api/cad/parsed/${fileHash}`);
      if (!dataResp.ok) throw new Error('获取数据失败');
      const data = await dataResp.json();

      setLoadingMsg('渲染中...');
      setRenderData({ flat: data.flat, texts: data.texts });
      setShowViewer(true);
    } catch (err: any) {
      Alert.alert('打开失败', err.message || String(err));
      setIsLoading(false);
    }
  };

  // ── 本地渲染模式（小文件 DXF） ──
  const loadDxfFile = async (uri: string, name: string) => {
    try {
      setFileName(name); setIsLoading(true); setWebViewReady(false);
      setRenderData(null); setMode('viewer'); setViewerMode('local');
      setLoadingMsg('加载中...');
      setWebViewKey(k => k + 1);
      setShowViewer(true);


      let fileUri = uri;
      if (Platform.OS === 'android' && fileUri.startsWith('content://')) {
        const dest = `${RNFS.CachesDirectoryPath}/${name}`;
        await RNFS.copyFile(fileUri, dest);
        fileUri = 'file://' + dest;
      }
      const filePath = fileUri.replace('file://', '');
      const b64 = await RNFS.readFile(filePath, 'base64');
      const rawBytes = Buffer.from(b64, 'base64');
      let content = rawBytes.toString('utf8');
      if (content.includes('\ufffd') || !content.includes('SECTION')) content = iconv.decode(rawBytes, 'gbk');
      if (!content || content.length < 10) { Alert.alert('错误', '文件为空'); setIsLoading(false); return; }


      // 先从原始 DXF 文本提取 ATTRIB 实体（dxf-parser 不支持解析 ATTRIB）
      const rawAttribs = extractAttribsFromRawDxf(content);
      const parser = new DxfParser();
      const dxf = parser.parseSync(content);
      if (!dxf) { Alert.alert('解析失败', '无效格式'); setIsLoading(false); return; }


      const result = preprocessDxf(dxf, rawAttribs);
      setLayerList(result.layers);
      setRenderData({ flat: result.flat, texts: result.texts });
    } catch (err: any) { Alert.alert('失败', err.message || String(err)); setIsLoading(false); }
  };

  useEffect(() => {
    if (!webViewReady || !renderData) return;
    const { flat, texts } = renderData;
    // 一次性注入所有数据（~3MB JSON，WebView 可以处理）
    const js = `try{
      window.addFlat(${JSON.stringify(flat)});
      window.addTexts(${JSON.stringify(texts)});
      window.finishRender();
    }catch(e){window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',msg:e.message}));}true;`;
    webRef.current?.injectJavaScript(js);
  }, [webViewReady, renderData]);

  // 后端解析：WebView ready 后注入数据 URL，让 WebView 自己拉取
  useEffect(() => {
    if (!webViewReady || !serverDataUrl) return;
    const js = `
      (function(){
        var url="${serverDataUrl}";
        var xhr=new XMLHttpRequest();
        xhr.open("GET",url,true);
        xhr.responseType="json";
        xhr.onload=function(){
          try{
            var d=xhr.response;
            if(d&&d.flat){window.addFlat(d.flat);}
            if(d&&d.texts){window.addTexts(d.texts);}
            window.finishRender();
          }catch(e){
            window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',msg:'render:'+e.message}));
          }
        };
        xhr.onerror=function(){
          window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',msg:'xhr failed: '+url}));
        };
        xhr.send();
      })();
      true;
    `;
    webRef.current?.injectJavaScript(js);
  }, [webViewReady, serverDataUrl]);

  // 智能选择加载方式
  const smartLoadFile = async (uri: string, name: string, fileSize?: number) => {
    const ext = name.toLowerCase().split('.').pop() || '';

    // DWG 文件 → 使用 CAD-Viewer WASM（纯前端，无需后端）
    if (ext === 'dwg') {
      await loadDwgWithCadViewer(uri, name);
      return;
    }

    // DXF 文件 → 后端瓦片渲染（后端不可用时回退本地）
    if (ext === 'dxf') {
      try {
        await loadViaTiles(uri, name);
      } catch {
        await loadDxfFile(uri, name);
      }
      return;
    }
  };

  useEffect(() => {
    const sf = route.params?.sharedFile;
    if (sf?.uri && sf?.name) {
      smartLoadFile(sf.uri, sf.name);
      // 从第三方打开也添加到历史记录
      addHistory(sf.name, sf.uri);
    }
  }, [route.params]);

  const pickFile = async () => {
    try {
      const res = await DocumentPicker.pick({ type: [DocumentPicker.types.allFiles] });
      const file = res[0];
      const ext = (file.name || '').toLowerCase().split('.').pop() || '';
      if (ext !== 'dxf' && ext !== 'dwg') {
        Alert.alert('格式错误', '请选择 .dxf 或 .dwg 文件');
        return;
      }
      // DocumentPicker 直接提供 file.size（字节数）
      const fileSize = file.size ?? undefined;
      await smartLoadFile(file.uri, file.name || `未命名.${ext}`, fileSize);
      // 文件成功加载后才添加到历史记录
      addHistory(file.name || `未命名.${ext}`, file.uri);
    } catch (err: any) { if (!DocumentPicker.isCancel(err)) Alert.alert('错误', err.message || ''); }
  };

  const sendMsg = (type: string, value?: any) => {
    webRef.current?.injectJavaScript(`try{window.handleRNMessage(${JSON.stringify({type,value})});}catch(e){}true;`);
  };

  const onWebMessage = useCallback((event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'debug') {
        // Debug logs from cad-viewer.html - visible in LogBox/Metro console
        console.log('[CAD-WebView]', msg.msg);
      } else if (msg.type === 'webviewReady') {
        setWebViewReady(true);
      } else if (msg.type === 'engineReady') {
        // CAD-Viewer 引擎已就绪，注入 DWG 文件数据
        const pending = (cadViewerRef as any)._pendingDwg;
        if (pending) {
          (cadViewerRef as any)._pendingDwg = null;
          // Step 1: Store base64 data on window (avoids escaping issues in strings)
          const b64 = pending.b64;
          const name = pending.name;
          // Split into chunks to avoid JS engine limits
          const CHUNK = 512 * 1024; // 512KB chunks
          const chunks = [];
          for (let i = 0; i < b64.length; i += CHUNK) {
            chunks.push(b64.slice(i, i + CHUNK));
          }
          // First chunk initializes
          cadViewerRef.current?.injectJavaScript(
            `window._dwgB64="${chunks[0]}"; true;`
          );
          // Remaining chunks append
          for (let i = 1; i < chunks.length; i++) {
            cadViewerRef.current?.injectJavaScript(
              `window._dwgB64+="${chunks[i]}"; true;`
            );
          }
          // Step 2: Call openFile with the stored data
          cadViewerRef.current?.injectJavaScript(
            `openFile(window._dwgB64, ${JSON.stringify(name)}); window._dwgB64=null; true;`
          );
        }
      } else if (msg.type === 'renderDone') {
        setIsLoading(false);
      } else if (msg.type === 'tileReady') {
        setIsLoading(false);
      } else if (msg.type === 'error') {
        console.warn('WebView error:', msg.msg);
        Alert.alert('渲染错误', msg.msg || '未知错误');
        setIsLoading(false);
      } else if (msg.type === 'measureResult') setMeasureResult(msg.value || '');
      else if (msg.type === 'requestText') setShowTextInput(true);
    } catch {}
  }, []);

  const toggleTool = (tool: ToolMode) => { const n = toolMode === tool ? 'none' : tool; setToolMode(n); setMeasureResult(''); sendMsg('setTool', n); };
  const submitAnnotateText = () => { if (annotateText.trim()) sendMsg('placeText', annotateText.trim()); setShowTextInput(false); setAnnotateText(''); };

  const filteredHistory = historyList.filter(h => h.name.toLowerCase().includes(searchText.toLowerCase()));

  if (mode === 'select') return (
    <LinearGradient colors={['#80011A', '#000000']} style={styles.container}>
      {/* 顶部标题栏 */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          style={styles.headerBackBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <ChevronLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>CAD 看图</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      {historyList.length === 0 ? (
        /* 空状态 - 直接显示在背景中 */
        <View style={styles.selectContent}>
          <TouchableOpacity style={styles.pickBtn} onPress={pickFile} activeOpacity={0.8}>
            <Text style={styles.pickBtnText}>选择指定文件</Text>
          </TouchableOpacity>
          <Text style={styles.selectDesc}>支持 DXF / DWG 格式图纸{'\n'}云端极速解析 · 全量矢量渲染</Text>
        </View>
      ) : (
        /* 历史记录列表 */
        <>
          <ScrollView style={styles.historyScroll} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            {filteredHistory.map(item => (
              <TouchableOpacity
                key={item.id}
                style={styles.historyItem}
                activeOpacity={0.7}
                onPress={() => {
                  smartLoadFile(item.uri, item.name);
                  updateHistoryTime(item.name);
                }}
              >
                <View style={styles.historyInfo}>
                  <Text style={styles.historyName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.historyTime}>{formatTime(item.time)}</Text>
                </View>
                <Text style={styles.historyOpen}>打开</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      {historyList.length > 0 && (
        /* 底部搜索/新建栏 — 仅有历史记录时显示 */
        <View style={{ paddingBottom: Math.max(insets.bottom, 12) + 8 }}>
          <BottomSearchBar
            value={searchText}
            onChangeText={setSearchText}
            onSubmit={() => {}}
            placeholder="搜索图纸名称..."
            absolute={false}
            avoidKeyboard={true}
            showAddButton={true}
            onAddPress={pickFile}
            enableVoice
          />
        </View>
      )}
    </LinearGradient>
  );

  const tools: { key: ToolMode; label: string; icon: string }[] = [
    { key: 'measure_dist', label: '测距', icon: '📏' },
    { key: 'measure_area', label: '面积', icon: '⬛' },
    { key: 'annotate_text', label: '批注', icon: '💬' },
    { key: 'annotate_draw', label: '画线', icon: '✏️' },
  ];

  return (
    <View style={styles.container}>
      {showViewer && viewerMode === 'local' && (
        <WebView key={webViewKey} ref={webRef}
          source={{ html: embeddedHtml || VIEWER_HTML, baseUrl: BASE_URL }}
          style={[styles.webview, { backgroundColor: '#000000' }]}
          javaScriptEnabled domStorageEnabled scrollEnabled={false}
          originWhitelist={['*']} allowFileAccess allowUniversalAccessFromFileURLs
          mixedContentMode="always" onMessage={onWebMessage}
          onError={(e) => Alert.alert('WebView Error', JSON.stringify(e.nativeEvent))}
        />
      )}
      {/* CAD-Viewer（DWG文件，通过本地 HTTP 服务加载） */}
      {showViewer && viewerMode === 'cadviewer' && cadViewerUrl ? (
        <WebView
          key={`cadviewer-${webViewKey}`}
          ref={cadViewerRef}
          source={{ uri: cadViewerUrl }}
          style={[styles.webview, { backgroundColor: '#1a1a1a' }]}
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled={false}
          originWhitelist={['*']}
          mixedContentMode="always"
          onMessage={onWebMessage}
          onError={(e) => Alert.alert('CAD-Viewer Error', JSON.stringify(e.nativeEvent))}
        />
      ) : null}
      {showViewer && viewerMode === 'tile' && tileUrl ? (
        <WebView key={`tile-${webViewKey}`} ref={tileWebRef}
          source={{ uri: tileUrl }}
          style={[styles.webview, { backgroundColor: '#222427' }]}
          javaScriptEnabled domStorageEnabled scrollEnabled={false}
          originWhitelist={['*']}
          mixedContentMode="always" onMessage={onWebMessage}
          onError={(e) => Alert.alert('WebView Error', JSON.stringify(e.nativeEvent))}
        />
      ) : null}

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#B20000" />
          <Text style={styles.loadingText}>{loadingMsg}</Text>
        </View>
      )}
      <View style={[styles.topBar, { top: insets.top }]}>
        <BackButton
          onPress={() => { setMode('select'); setShowViewer(false); setRenderData(null); setWebViewReady(false); setTileUrl(''); setEmbeddedHtml(''); setServerDataUrl(''); setViewerMode('local'); }}
          size={40}
          iconSize={24}
          backgroundColor="rgba(0,0,0,0.5)"
        />
        <Text style={styles.topFileName} numberOfLines={1}>{fileName}</Text>
        <TouchableOpacity style={styles.topBtn} onPress={() => setShowLayers(!showLayers)}>
          <Text style={styles.topBtnText}>图层</Text>
        </TouchableOpacity>
      </View>
      {viewerMode === 'local' && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 8 }]}>
          {measureResult ? <View style={styles.measureResultBar}><Text style={styles.measureResultText}>{measureResult}</Text></View> : null}
          <View style={styles.toolRow}>
            {tools.map(t => (
              <TouchableOpacity key={t.key} style={[styles.toolBtn, toolMode === t.key && styles.toolBtnActive]} onPress={() => toggleTool(t.key)} activeOpacity={0.7}>
                <Text style={styles.toolIcon}>{t.icon}</Text>
                <Text style={[styles.toolLabel, toolMode === t.key && styles.toolLabelActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.toolBtn} onPress={() => { sendMsg('clearAnnotations'); setMeasureResult(''); }} activeOpacity={0.7}>
              <Text style={styles.toolIcon}>🗑️</Text><Text style={styles.toolLabel}>清除</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolBtn} onPress={() => sendMsg('fitView')} activeOpacity={0.7}>
              <Text style={styles.toolIcon}>🎯</Text><Text style={styles.toolLabel}>归位</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {showLayers && (
        <View style={[styles.layerPanel, { top: insets.top + 50 }]}>
          <View style={styles.layerHeader}><Text style={styles.layerTitle}>图层 ({layerList.length})</Text><TouchableOpacity onPress={() => setShowLayers(false)}><Text style={styles.layerClose}>✕</Text></TouchableOpacity></View>
          <ScrollView style={styles.layerScroll}>{layerList.map(l => (<TouchableOpacity key={l} style={styles.layerRow}><View style={[styles.layerDot,{backgroundColor:'#4a90d9'}]}/><Text style={styles.layerName} numberOfLines={1}>{l}</Text></TouchableOpacity>))}</ScrollView>
        </View>
      )}

      {showTextInput && (
        <View style={styles.textInputOverlay}>
          <View style={styles.textInputCard}>
            <Text style={styles.textInputTitle}>添加文字标注</Text>
            <TextInput style={styles.textInput} value={annotateText} onChangeText={setAnnotateText} placeholder="输入标注文字..." placeholderTextColor="rgba(255,255,255,0.3)" autoFocus />
            <View style={styles.textInputBtns}>
              <TouchableOpacity style={styles.textCancelBtn} onPress={() => setShowTextInput(false)}><Text style={styles.textCancelText}>取消</Text></TouchableOpacity>
              <TouchableOpacity style={styles.textConfirmBtn} onPress={submitAnnotateText}><Text style={styles.textConfirmText}>确定</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#222427' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webview: { flex: 1 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(34,36,39,0.95)', justifyContent: 'center', alignItems: 'center', zIndex: 50 },
  loadingText: { fontSize: 13, color: 'rgba(255,255,255,0.65)', fontWeight: '600', marginTop: 12, textAlign: 'center', paddingHorizontal: 24 },
  backBtn: { position: 'absolute', left: 12, zIndex: 100, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  backBtnText: { fontSize: 14, color: '#fff', fontWeight: '600' },
  selectContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  selectIcon: { fontSize: 48, marginBottom: 16 },
  selectTitle: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 8 },
  selectDesc: { fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 20, marginTop: 16 },
  pickBtn: { backgroundColor: '#B20000', paddingHorizontal: 36, paddingVertical: 14, borderRadius: 28, marginBottom: 0 },
  pickBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  topBar: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 50 },
  topBtn: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16 },
  topBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  topFileName: { flex: 1, color: 'rgba(255,255,255,0.7)', fontSize: 12, textAlign: 'center', marginHorizontal: 8 },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', paddingTop: 8, paddingHorizontal: 8 },
  measureResultBar: { backgroundColor: 'rgba(178,0,0,0.85)', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 16, marginBottom: 8, alignSelf: 'center' },
  measureResultText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  toolRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, flexWrap: 'wrap' },
  toolBtn: { alignItems: 'center', paddingVertical: 0, paddingHorizontal: 12, minWidth: 52 },
  toolBtnActive: { },
  toolIcon: { fontSize: 18, marginBottom: 2 },
  toolLabel: { fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  toolLabelActive: { color: '#fff' },
  layerPanel: { position: 'absolute', right: 8, width: 200, maxHeight: 400, backgroundColor: 'rgba(0,0,0,0.85)', borderRadius: 16, padding: 12, zIndex: 60 },
  layerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  layerTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  layerClose: { color: 'rgba(255,255,255,0.5)', fontSize: 18, padding: 4 },
  layerScroll: { maxHeight: 340 },
  layerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  layerDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  layerName: { color: 'rgba(255,255,255,0.7)', fontSize: 12, flex: 1 },
  textInputOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  textInputCard: { width: SCREEN_W * 0.8, backgroundColor: '#1a1a2e', borderRadius: 20, padding: 20 },
  textInputTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  textInput: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 15 },
  textInputBtns: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14, gap: 10 },
  textCancelBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)' },
  textCancelText: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
  textConfirmBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, backgroundColor: '#B20000' },
  textConfirmText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // 统一标题栏样式
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
  headerBackBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  headerRightPlaceholder: { width: 40 },

  // 历史列表
  historyHeader: { paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4 },
  historyHeaderText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  historyScroll: { flex: 1 },
  historyItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 16, marginBottom: 8 },
  historyIcon: { fontSize: 24, marginRight: 12 },
  historyInfo: { flex: 1 },
  historyName: { fontSize: 16, color: '#fff', fontWeight: '500' },
  historyTime: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 6 },
  historyOpen: { fontSize: 13, color: '#fff', fontWeight: '600', backgroundColor: '#B20000', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, overflow: 'hidden' },



});

export default CADViewerGuard;
