
function mountGame(root){
const controller = new AbortController();
const listen = (target, event, handler, options = {}) => target.addEventListener(event, handler, {...(typeof options === "object" ? options : {}), signal: controller.signal});
let frame = 0;
'use strict';
/* ================= LOGIKA (tanpa DOM) ================= */
var COLS=12, ROWS=18;
var TYPES=['beam','corner','bridge','cross','step','dot'];
var SHAPES={
 beam:[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
 corner:[[0,0,1],[1,1,1],[0,0,0]],
 bridge:[[0,1,0],[1,1,1],[0,0,0]],
 cross:[[0,1,1],[1,1,0],[0,0,0]],
 step:[[1,1,0],[0,1,1],[0,0,0]],
 dot:[[1,1],[1,1]]
};
var LINES_PER_LEVEL=10;
var LOCK_MS=500, MAX_RESETS=15, DAS=170, ARR=50, SOFT_MS=40;

var G={};

function shuffle(a){
  for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t;}
  return a;
}
/* 7-bag: tas baru dikocok HANYA saat tas sekarang sudah kosong */
function drawPiece(){
  if(G.bag.length===0)G.bag=shuffle(TYPES.slice());
  return G.bag.shift();
}
function copyM(m){var r=[];for(var i=0;i<m.length;i++)r.push(m[i].slice());return r;}
function rotCW(m){
  var n=m.length,r=[];
  for(var i=0;i<n;i++){r.push([]);for(var j=0;j<n;j++)r[i].push(m[n-1-j][i]);}
  return r;
}
function collide(m,x,y){
  for(var r=0;r<m.length;r++)for(var c=0;c<m[r].length;c++){
    if(!m[r][c])continue;
    var nx=x+c,ny=y+r;
    if(nx<0||nx>=COLS||ny>=ROWS)return true;
    if(ny>=0&&G.board[ny][nx])return true;
  }
  return false;
}
function gravityMs(l){return 1000*Math.pow(Math.max(0.8-(l-1)*0.007,0.05),l-1);}
function emptyRow(){var r=[];for(var c=0;c<COLS;c++)r.push(null);return r;}

function resetGame(){
  G.board=[];for(var r=0;r<ROWS;r++)G.board.push(emptyRow());
  G.bag=[];G.next=drawPiece();G.hold=null;G.canHold=true;
  G.score=0;G.coins=0;G.lines=0;G.level=1;G.cur=null;
  G.dropAcc=0;G.lockT=0;G.resets=0;G.lowest=0;
  G.soft=false;G.das={left:null,right:null};
  G.state='ready';G.events=[];
}
function spawn(t){
  var m=copyM(SHAPES[t]),x=Math.floor((COLS-m.length)/2);
  G.cur={t:t,m:m,x:x,y:0,r:0};
  G.dropAcc=0;G.lockT=0;G.resets=0;G.lowest=0;
  if(collide(m,x,0)){gameOver();return false;}
  return true;
}
function gameOver(){if(G.state==='play'||G.state==='pause'){try{parent.postMessage({type:'nimiq-run',slug:'blocks',score:G.score,durationSec:(Date.now()-(G.wall0||Date.now()))/1000,wave:G.level,kills:{line:G.lines},coins:G.coins},location.origin);}catch(e){}}G.state='over';G.soft=false;G.das={left:null,right:null};G.events.push('over');}
function nextPiece(){var t=G.next;G.next=drawPiece();G.canHold=true;spawn(t);}
function startGame(){resetGame();G.state='play';G.wall0=Date.now();try{parent.postMessage({type:'nimiq-start',slug:'blocks'},location.origin);}catch(e){}nextPiece();}

function grounded(){return collide(G.cur.m,G.cur.x,G.cur.y+1);}
function afterMove(){if(grounded()&&G.resets<MAX_RESETS){G.lockT=0;G.resets++;}}
function fall1(){
  G.cur.y++;
  if(G.cur.y>G.lowest){G.lowest=G.cur.y;G.resets=0;G.lockT=0;}
}
function move(dx){
  var c=G.cur;
  if(collide(c.m,c.x+dx,c.y))return false;
  c.x+=dx;afterMove();return true;
}
function rotate(){
  var c=G.cur;
  if(c.t==='dot')return false;
  var nm=rotCW(c.m),kicks=[[0,0],[-1,0],[1,0],[0,1],[-2,0],[2,0]];
  for(var i=0;i<kicks.length;i++){
    var dx=kicks[i][0],dy=-kicks[i][1];
    if(!collide(nm,c.x+dx,c.y+dy)){
      c.m=nm;c.x+=dx;c.y+=dy;c.r=(c.r+1)%4;
      if(c.y>G.lowest){G.lowest=c.y;G.resets=0;G.lockT=0;}
      afterMove();return true;
    }
  }
  return false;
}
function softStep(){
  if(grounded())return false;
  fall1();G.dropAcc=0;return true;
}
function hardDrop(){
  while(!grounded())fall1();
  lockPiece();
}
function lockPiece(){
  var c=G.cur,out=false;
  for(var r=0;r<c.m.length;r++)for(var k=0;k<c.m[r].length;k++){
    if(!c.m[r][k])continue;
    var ny=c.y+r,nx=c.x+k;
    if(ny<0)out=true;else G.board[ny][nx]=c.t;
  }
  if(out){gameOver();return;}
  clearLines();
  nextPiece();
}
function clearLines(){
  var n=0,r=ROWS-1;
  while(r>=0){
    var full=true;
    for(var c=0;c<COLS;c++)if(!G.board[r][c]){full=false;break;}
    if(full){G.board.splice(r,1);G.board.unshift(emptyRow());n++;}
    else r--;
  }
  if(n>0){
    G.score+=(n*n*120)*G.level;
    G.lines+=n;G.coins+=n*5;
    G.level=1+Math.floor(G.lines/LINES_PER_LEVEL);
  }
  return n;
}
/* hold: sekali per bidak (aktif lagi setelah bidak terkunci) */
function holdPiece(){
  if(!G.canHold)return false;
  var t=G.cur.t;
  if(G.hold===null){
    G.hold=t;
    var n=G.next;G.next=drawPiece();spawn(n);
  }else{
    var h=G.hold;G.hold=t;spawn(h);
  }
  G.canHold=false;
  return true;
}
function togglePause(){
  if(G.state==='play'){G.state='pause';G.soft=false;G.das={left:null,right:null};}
  else if(G.state==='pause'){G.state='play';}
}

/* aksi input */
function press(act){
  if(act==='pause'){togglePause();return;}
  if(act==='restart'){startGame();return;}
  if(G.state!=='play')return;
  if(act==='left'){move(-1);G.das.left={t:0,next:DAS};G.das.right=null;}
  else if(act==='right'){move(1);G.das.right={t:0,next:DAS};G.das.left=null;}
  else if(act==='rot')rotate();
  else if(act==='soft'){G.soft=true;softStep();}
  else if(act==='hard')hardDrop();
}
function release(act){
  if(act==='left')G.das.left=null;
  else if(act==='right')G.das.right=null;
  else if(act==='soft')G.soft=false;
}

function tick(dt){
  if(G.state!=='play')return;
  var dirs=['left','right'];
  for(var i=0;i<2;i++){
    var d=G.das[dirs[i]];if(!d)continue;
    d.t+=dt;
    while(d.t>=d.next){move(i===0?-1:1);d.next+=ARR;}
  }
  var iv=gravityMs(G.level);
  if(G.soft)iv=Math.min(iv,SOFT_MS);
  if(grounded()){
    G.dropAcc=0;
    G.lockT+=dt;
    if(G.lockT>=LOCK_MS)lockPiece();
  }else{
    G.dropAcc+=dt;
    while(G.dropAcc>=iv&&!grounded()){G.dropAcc-=iv;fall1();}
  }
}
/* ================= TAMPILAN & INPUT ================= */
var theme=getComputedStyle(root);
var color=(name)=>theme.getPropertyValue('--'+name).trim();
var COLORS={beam:color('primary'),corner:color('piece-coral'),bridge:color('piece-mint'),cross:color('piece-lilac'),step:color('piece-gold'),dot:color('piece-sky')};
var $=function(id){return root.querySelector("#"+id);};
var bc=$('bc'),bx=bc.getContext('2d'),nc=$('nc'),nx=nc.getContext('2d');
var ov=$('ov'),ovt=$('ovt'),ovs=$('ovs'),ovp=$('ovp'),ovb=$('ovb'),pbtn=$('pbtn');
var CELL=24,PREV=0,DPR=1,lastKey='',shownNext;
var C_ETCH=color('block-etch'),C_BOARD=color('board'),C_GRID=color('grid'),C_SHINE=color('block-shine');

function setCanvas(cv,ctx,w,h){
  cv.width=Math.floor(w*DPR);cv.height=Math.floor(h*DPR);
  cv.style.width=w+'px';cv.style.height=h+'px';
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
function layout(){
  DPR=Math.min(window.devicePixelRatio||1,2);
  var area=$('arena'), W=area.clientWidth, H=area.clientHeight;
  CELL=Math.max(1,Math.min(Math.floor((W-2)/COLS),Math.floor((H-2)/ROWS),36));
  PREV=80;
  var key=CELL+'x'+DPR;if(key===lastKey)return;lastKey=key;shownNext=undefined;
  setCanvas(bc,bx,COLS*CELL,ROWS*CELL);
  setCanvas(nc,nx,PREV,Math.round(PREV*0.75));
}
listen(window,'resize',layout);
var resizeObserver=new ResizeObserver(layout);
resizeObserver.observe($('arena'));
if(window.visualViewport)listen(window.visualViewport,'resize',layout);

/* heksagon sisi atas datar di dalam sel s×s */
function hexPath(ctx,x,y,s,inset){
 var cx=x+s/2,cy=y+s/2,r=s/2-inset,h=r*0.866;
 ctx.beginPath();
 ctx.moveTo(cx-r/2,cy-h);ctx.lineTo(cx+r/2,cy-h);ctx.lineTo(cx+r,cy);
 ctx.lineTo(cx+r/2,cy+h);ctx.lineTo(cx-r/2,cy+h);ctx.lineTo(cx-r,cy);ctx.closePath();
}
function cell(ctx,x,y,s,col,alpha){
 ctx.globalAlpha=alpha;ctx.fillStyle=col;
 hexPath(ctx,x,y,s,1);ctx.fill();
 ctx.globalAlpha=1;
}
function ghostY(){var c=G.cur,y=c.y;while(!collide(c.m,c.x,y+1))y++;return y;}
function drawBoard(){
  var w=COLS*CELL,h=ROWS*CELL,r,c;
  bx.fillStyle=C_BOARD;bx.fillRect(0,0,w,h);
  bx.strokeStyle=C_GRID;bx.lineWidth=1;bx.beginPath();
  for(c=1;c<COLS;c++){bx.moveTo(c*CELL+.5,0);bx.lineTo(c*CELL+.5,h);}
  for(r=1;r<ROWS;r++){bx.moveTo(0,r*CELL+.5);bx.lineTo(w,r*CELL+.5);}
  bx.stroke();
  for(r=0;r<ROWS;r++)for(c=0;c<COLS;c++){var t=G.board[r][c];if(t)cell(bx,c*CELL,r*CELL,CELL,COLORS[t],1);}
  if(G.cur&&(G.state==='play'||G.state==='pause'||G.state==='over')){
    var p=G.cur,gy=ghostY();
    for(r=0;r<p.m.length;r++)for(c=0;c<p.m[r].length;c++){
      if(!p.m[r][c])continue;
      if(G.state==='play'&&gy+r>=0){bx.strokeStyle=COLORS[p.t];bx.globalAlpha=.45;bx.lineWidth=2;
        hexPath(bx,(p.x+c)*CELL,(gy+r)*CELL,CELL,2);bx.stroke();bx.globalAlpha=1;}
    }
    for(r=0;r<p.m.length;r++)for(c=0;c<p.m[r].length;c++)
      if(p.m[r][c]&&p.y+r>=0)cell(bx,(p.x+c)*CELL,(p.y+r)*CELL,CELL,COLORS[p.t],1);
  }
}
function drawPreview(ctx,t,dim){
  var w=PREV,h=Math.round(PREV*0.75);
  ctx.clearRect(0,0,w,h);
  if(!t)return;
  var m=SHAPES[t],minr=9,maxr=-1,minc=9,maxc=-1,r,c;
  for(r=0;r<m.length;r++)for(c=0;c<m[r].length;c++)if(m[r][c]){minr=Math.min(minr,r);maxr=Math.max(maxr,r);minc=Math.min(minc,c);maxc=Math.max(maxc,c);}
  var s=Math.floor(Math.min(w/4.6,h/2.8)),pw=(maxc-minc+1)*s,ph=(maxr-minr+1)*s,ox=(w-pw)/2,oy=(h-ph)/2;
  for(r=minr;r<=maxr;r++)for(c=minc;c<=maxc;c++)if(m[r][c])cell(ctx,ox+(c-minc)*s,oy+(r-minr)*s,s,COLORS[t],dim?0.35:1);
}
var shown={};
function setText(id,v){if(shown[id]!==v){shown[id]=v;$(id).textContent=v;}}
function updateUI(){
  setText('sc',String(G.score));setText('lv',String(G.level));setText('ln',String(G.lines));setText('cn',String(G.coins));
  if(shown.state===G.state)return;
  shown.state=G.state;
  root.dataset.state=G.state;
  var paused=G.state==='pause';
  pbtn.setAttribute('aria-label',paused?'Resume':'Pause');
  pbtn.setAttribute('title',paused?'Resume (P)':'Pause (P)');
  pbtn.setAttribute('aria-pressed',String(paused));
  pbtn.disabled=G.state==='ready'||G.state==='over';
  root.querySelectorAll('#pad [data-act]').forEach(function(b){b.disabled=G.state!=='play';b.classList.remove('on');});
  $('status').textContent=G.state==='play'?'PLAYING':paused?'PAUSED':G.state==='over'?'GAME OVER':'READY';
  ov.classList.toggle('hidden',G.state==='play');
  $('ove').textContent=G.state==='ready'?'NEW SESSION':paused?'TAKE A BREATH':'SESSION OVER';
  ovp.style.display='none';
  if(G.state==='ready'){ovt.textContent='Ready to drop?';ovs.textContent='';$('ovlabel').textContent='Start playing';}
  else if(paused){ovt.textContent='Keep your rhythm.';ovs.textContent='Score '+G.score;$('ovlabel').textContent='Resume';}
  else if(G.state==='over'){ovt.textContent='One more round?';ovs.textContent='Score '+G.score+' · Level '+G.level+' · '+G.lines+' lines';$('ovlabel').textContent='Play again';}
}
listen(ovb,'pointerdown',function(e){
  if(e.button!==0)return;e.preventDefault();
  if(G.state==='pause')togglePause();else startGame();
  ovb.blur();
});

/* keyboard */
var KEYS={ArrowLeft:'left',ArrowRight:'right',ArrowDown:'soft',ArrowUp:'rot',KeyX:'rot',Space:'hard',KeyP:'pause',Escape:'pause',KeyR:'restart'};
var held={};
listen(window,'keydown',function(e){
  var a=KEYS[e.code];if(!a)return;
  e.preventDefault();
  if(held[e.code])return;          /* abaikan auto-repeat OS; DAS/ARR ditangani sendiri */
  held[e.code]=true;
  if(a==='hard'&&G.state!=='play'&&G.state!=='pause'){startGame();return;}
  press(a);
},{passive:false});
listen(window,'keyup',function(e){var a=KEYS[e.code];if(!a)return;held[e.code]=false;release(a);});
listen(window,'blur',function(){if(G.state==='play')togglePause();held={};release('left');release('right');release('soft');});

/* tombol layar sentuh / mouse (tombol tahan untuk geser & soft drop) */
var btns=root.querySelectorAll('[data-act]');
function bindBtn(b){
  var act=b.getAttribute('data-act');
  function up(){b.classList.remove('on');release(act);}
  listen(b,'pointerdown',function(e){
    if(b.disabled||e.button!==0)return;
    e.preventDefault();b.setPointerCapture(e.pointerId);b.classList.add('on');press(act);
  });
  listen(b,'pointerup',up);
  listen(b,'pointercancel',up);
  listen(b,'lostpointercapture',up);
  listen(b,'click',function(e){if(e.detail===0&&!b.disabled){press(act);release(act);}});
}
for(var i=0;i<btns.length;i++)bindBtn(btns[i]);

/* ===== GESTUR DI PAPAN =====
   geser kiri/kanan = gerak per kotak, tarik bawah = soft drop,
   usap bawah cepat = hard drop, usap atas = hold, tap = putar */
var bw=$('bw'),gs=null;
function gStart(x,y){gs={x0:x,y0:y,lx:x,ly:y,t0:Date.now(),axis:null,steps:0};}
function gMove(x,y){
  if(!gs||G.state!=='play')return;
  var tx=x-gs.x0,ty=y-gs.y0,st=Math.max(14,CELL*0.85);
  if(!gs.axis&&(Math.abs(tx)>10||Math.abs(ty)>10))gs.axis=Math.abs(tx)>Math.abs(ty)?'x':'y';
  if(gs.axis==='x'){
    while(x-gs.lx>=st){move(1);gs.lx+=st;gs.steps++;}
    while(gs.lx-x>=st){move(-1);gs.lx-=st;gs.steps++;}
  }else if(gs.axis==='y'){
    while(y-gs.ly>=st){softStep();gs.ly+=st;gs.steps++;}
  }
}
function gEnd(x,y){
  if(!gs)return;
  var g=gs;gs=null;
  if(G.state!=='play')return;
  var dx=x-g.x0,dy=y-g.y0,ms=Math.max(1,Date.now()-g.t0),dist=Math.sqrt(dx*dx+dy*dy);
  var act=classifyGesture(dx,dy,ms,dist);
  if(act==='rot')rotate();
  else if(act==='hard')hardDrop();
}
function classifyGesture(dx,dy,ms,dist){
  if(dist<12&&ms<300)return 'rot';
  var vy=dy/ms;
  if(dy>CELL*1.5&&vy>0.9&&Math.abs(dy)>Math.abs(dx)*1.5)return 'hard';
  return null;
}
function inBoardUI(e){return e.target===ovb||G.state!=='play';}
listen(bw,'touchstart',function(e){
  if(inBoardUI(e))return;e.preventDefault();
  var t=e.changedTouches[0];gStart(t.clientX,t.clientY);},{passive:false});
listen(bw,'touchmove',function(e){
  if(!gs)return;e.preventDefault();
  var t=e.changedTouches[0];gMove(t.clientX,t.clientY);},{passive:false});
listen(bw,'touchend',function(e){
  if(!gs)return;e.preventDefault();
  var t=e.changedTouches[0];gEnd(t.clientX,t.clientY);},{passive:false});
listen(bw,'touchcancel',function(){gs=null;});

listen(document,'visibilitychange',function(){if(document.hidden&&G.state==='play')togglePause();});

var last=0;
function loop(ts){
  if(!last)last=ts;
  var dt=Math.min(ts-last,100);last=ts;
  tick(dt);
  drawBoard();if(shownNext!==G.next){shownNext=G.next;drawPreview(nx,G.next,false);}updateUI();
  frame=requestAnimationFrame(loop);
}
layout();resetGame();frame=requestAnimationFrame(loop);
return () => { resizeObserver.disconnect(); controller.abort(); cancelAnimationFrame(frame); };
}

mountGame(document.querySelector('.game-app'));
