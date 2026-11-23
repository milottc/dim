'use strict';
const el=id=>document.getElementById(id), canvas=el('game'), ctx=canvas.getContext('2d');
const colors=['#79e5d1','#ff968c','#ae95ff','#ffcf73'],names=['Mason','Nickson','Buh','Jegatheeswaran'],marks=['âœ¦','â™¥','â˜¾','â˜…'];
el('roster').innerHTML=names.map((n,i)=>'<div class="crew"><i class="dot" style="background:'+colors[i]+'"></i>'+n+'</div>').join('');
const sprite=['  WW        WW  ',' WTTW      WTTW ',' WTTTWWWWWWTTTW ',' WTTTTTTTTTTTTW ','WTTTDDTTTTDDTTTW','WTTTTTTTTTTTTTTW','WTWKKWTTTTWKKWTW','WTWKKWTTTTWKKWTW','WTPPTTTNNTTTPPTW',' WTTTWWWWWWTTTW ','  WWWWWWWWWWWW  ','   VVVVGGVVVV   ','  VVVVVVVVVVVV  '];
function cat(g,x,y,s){const ink={W:'#dedfe1',T:'#a1a4ad',D:'#646977',K:'#282238',N:'#ae645b',P:'#ff9585',V:'#a38be6',G:'#80e8cf'};sprite.forEach((row,r)=>[...row].forEach((c,i)=>{if(ink[c]){g.fillStyle=ink[c];g.fillRect(x+i*s,y+r*s,s,s)}}));poly([[x+4*s,y+2*s],[x+7*s,y-5*s],[x+10*s,y+2*s]],'#c85567',g);poly([[x+5*s,y],[x+8.5*s,y-1.7*s],[x+9*s,y-.7*s],[x+5*s,y+1*s]],'#ffd781',g);ellipse(g,x+7*s,y-5*s,s*.75,s*.75,'#ffdf7e')}
let board,level,score,best=0,charge,combo,misses,current,next,angle,shot,state,particles,time=0,noticeUntil=0,on=true,audio;
try{best=Number(localStorage.orbitBest)||0}catch{}el('best').textContent=best;
const cols=18, turn=Math.PI*2/cols, key=(r,c)=>r+','+c;
const wrap=c=>(c%cols+cols)%cols;
function cell(r,c,k){return {r,c:wrap(c),k}}
function adjacent(b){return [[0,-1],[0,1],[-1,0],[1,0]].map(([a,d])=>cell(b.r+a,b.c+d,0)).filter(v=>v.r>=0)}
function pick(){const pool=[...new Set([...board.values()].map(b=>b.k))];return pool[Math.floor(Math.random()*pool.length)]??0}
const missions=[
 ['Meadow Gate','pop',26,4],['Bellflower Mill','rescue',3,4],['Fern Hollow','clear',0,4],
 ['Copper Crossing','pop',58,5],['Lantern Orchard','rescue',5,5],['Ember Keep','waves',2,4],
 ['Snowbell Pass','rescue',6,6],['Frostbridge','pop',80,6],['Glacier Watch','waves',2,5],
 ['Moonlit Pines','clear',0,6],['Starlight Spire','rescue',8,7],['Crown of Clouds','waves',3,6]
];
const regions=['Meadowlands','Autumn Valley','Glacier Ridge','Starfall Summit'];
let mission,region,wave,earned,shots,entryScore,totalAtStart,finished={},slots={},latest=1;
try{const data=JSON.parse(localStorage.catTrailV1||'{}');finished=data.finished||{};slots=data.slots||{};latest=data.latest||1}catch{}
let litCandles=0,confettiUntil=0;
try{litCandles=Math.min(6,Number(localStorage.dimDimSixCandles)||0)}catch{}
function birthdayMatch(){if(litCandles>=6)return false;litCandles++;try{localStorage.dimDimSixCandles=litCandles}catch{}if(litCandles===6){confettiUntil=time+6500;return true}return false}
function save(){try{if(state==='play'||state==='pause')slots[level]={board:[...board.values()],score,entryScore,charge,combo,misses,current,next,angle,aimCol,earned,shots,wave,totalAtStart};localStorage.catTrailV1=JSON.stringify({finished,slots,latest:state==='win'?level+1:level})}catch{}}
function populate(){
 board=new Map();const rows=mission[3],theme=level+wave;
 for(let c=0;c<cols;c++){
  const height=rows-((c+theme)%5===0?1:0);
  for(let r=0;r<height;r++){
   let k=(Math.floor((c+Math.floor(r/(2+theme%2)))/2)+Math.floor(r/2)+theme)%4;
   if(level%3===2)k=(Math.floor(c/3)+Math.floor((r+c%2)/2)+theme)%4;
   const b=cell(r,c,k);board.set(key(r,c),b)
  }
 }
 if(mission[1]==='rescue')for(let i=0;i<mission[2];i++){
  const c=wrap(Math.floor(i*cols/mission[2])+level-2),h=lowest(c).r;
  board.get(key(Math.max(0,h-1-(i%3)),c)).rescue=true
 }
 totalAtStart=board.size
}
function start(l,restore=false){
 level=l;mission=missions[l-1]||['Endless Peak '+(l-12),'waves',Math.min(5,2+Math.floor((l-13)/3)),6];
 region=Math.floor((l-1)/3)%4;wave=1;earned=shots=0;entryScore=0;score=0;
 combo=charge=misses=0;shot=null;particles=[];angle=0;aimCol=0;drag=null;populate();current=pick();next=pick();
 const s=restore&&slots[l];if(s&&Array.isArray(s.board)&&s.board.length){
 board=new Map(s.board.map(b=>[key(b.r,b.c),b]));({score,entryScore,charge,combo,misses,current,next,angle,aimCol,earned,shots,wave,totalAtStart}=s)
 }
 state='play';el('overlay').hidden=true;el('note').textContent='';landscape();sync();save()
}
function progress(){
 if(mission[1]==='clear')return [Math.max(0,totalAtStart-board.size),totalAtStart];
 if(mission[1]==='waves')return [wave-1,mission[2]];
 return [Math.min(earned,mission[2]),mission[2]]
}
function sync(){
 const [value,goal]=progress(),type=mission[1];
 el('candles').innerHTML=Array.from({length:6},(_,i)=>'<i class="'+(i<litCandles?'lit':'')+'"></i>').join('');
 el('wish').textContent=litCandles===6?'All six lit. Make a wish, Dim-Dim!':litCandles+' of 6 lit Â· Make a match to light one.';
 el('level').textContent='TOWER '+String(level).padStart(2,'0')+'  /  '+mission[0];
 el('miss').textContent='Row in '+(missLimit()-misses)+' misses';
 el('chapter').textContent=regions[region].toUpperCase();
 el('place').textContent=mission[0];el('objective').textContent={clear:'Clear every cat from the tower.',rescue:'Free the gold-bell kittens. Pop their group or drop it from above.',pop:'Pop or drop '+goal+' cats to open the trail.',waves:'Clear all '+goal+' waves of cats.'}[type];
 el('count').textContent=type==='clear'?board.size+' cats left':type==='waves'?'Wave '+wave+' of '+goal:value+' / '+goal+(type==='rescue'?' rescued':' cats');
 el('progress').style.width=100*value/goal+'%';el('shots').textContent=shots+' shots';
 el('score').textContent=String(score).padStart(5,'0');el('charge').style.width=(charge/3*100)+'%';el('chargeText').textContent=charge===3?'READY':charge+' / 3 matches';
 const preview=el('next').getContext('2d');preview.clearRect(0,0,38,38);bubble(19,20,next,15,preview);el('next').setAttribute('aria-label','Next cat: '+names[next]);
 if(score>best){best=score;el('best').textContent=best;try{localStorage.orbitBest=best}catch{}}
 const cleared=Object.keys(finished).filter(n=>+n<=12).length;
 el('trailCount').textContent=cleared+' / 12 cleared';
 el('route').innerHTML=missions.map((m,i)=>'<button class="station '+(level===i+1?'active':finished[i+1]?'done':'')+'" title="'+m[0]+'" aria-label="'+m[0]+'" data-l="'+(i+1)+'" '+(i&&!finished[i]&&level!==i+1?'disabled':'')+'>'+(finished[i+1]?'âœ“ ':'')+String(i+1).padStart(2,'0')+'</button>').join('')+(finished[12]?'<button class="station" data-l="13">âˆž</button>':'');scout()
}
function scout(){
 el('scout').innerHTML=Array.from({length:cols},(_,c)=>{const row=lowest(c).r,b=board.get(key(row-1,c));return '<button data-c="'+c+'" aria-pressed="'+(c===aimCol)+'" aria-label="Column '+(c+1)+', '+(b?names[b.k]:'empty')+'" style="background:'+(b?colors[b.k]:'#eae6d4')+'">'+(b?(b.rescue?'â™¢':marks[b.k]):'Â·')+'</button>'}).join('')
}
function missLimit(){return level<=3?7:level<=8?6:5}
el('scout').onclick=e=>{const c=e.target.dataset.c;if(c===undefined||state!=='play'||shot)return;aimCol=+c;angle=-aimCol*turn;scout()};
el('route').onclick=e=>{const l=Number(e.target.dataset.l);if(!l||e.target.disabled||shot||l===level&&state==='play')return;save();start(l,true)};
function tone(f){if(!on)return;try{audio??=new AudioContext();audio.resume();const osc=audio.createOscillator(),gain=audio.createGain();osc.type='sine';osc.frequency.setValueAtTime(f,audio.currentTime);osc.frequency.exponentialRampToValueAtTime(f*1.5,audio.currentTime+.09);gain.gain.setValueAtTime(.055,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.14);osc.connect(gain).connect(audio.destination);osc.start();osc.stop(audio.currentTime+.15)}catch{}}
function overlay(s,title,msg,btn){state=s;el('resultTag').textContent=s==='win'?'TRAIL STAMP EARNED':s==='loss'?'TRY THE TOWER AGAIN':'GAME PAUSED';el('headline').textContent=title;el('message').textContent=msg;el('resume').textContent=btn;el('overlay').hidden=false}
function pause(){if(state==='play')overlay('pause','Orbit paused','Dim-Dim is keeping your seat warm.','Resume game');else if(state==='pause'){state='play';el('overlay').hidden=true}}
el('pause').onclick=pause;el('resume').onclick=()=>{if(state==='pause')pause();else start(state==='win'?level+1:level,state==='win')};el('sound').onclick=()=>{on=!on;el('sound').textContent='â™« Sound '+(on?'on':'off');el('sound').setAttribute('aria-pressed',on);if(on)tone(450)};
function swap(){if(state==='play'&&!shot){[current,next]=[next,current];sync()}}el('swap').onclick=swap;
function cluster(seeds,allow){const found=new Set(seeds),q=[...seeds];while(q.length){for(const n of adjacent(q.pop())){const b=board.get(key(n.r,n.c));if(b&&!found.has(b)&&allow(b)){found.add(b);q.push(b)}}}return found}
const catHeads=[];
function bubble(x,y,k,r,g=ctx){
 if(!catHeads[k]){
  const tile=document.createElement('canvas');tile.width=tile.height=96;
  const p=tile.getContext('2d'),fur=colors[k]||'#ebb2ff';
  p.translate(48,48);p.scale(36,36);p.lineJoin='round';p.lineCap='round';
  const shade=p.createLinearGradient(-.6,-1,.65,1);
  if(k===4){['#ff9cb2','#ffd783','#9ee0c8','#99cfff','#d3a2ff'].forEach((c,i)=>shade.addColorStop(i/4,c))}
  else{shade.addColorStop(0,'#fffaeb');shade.addColorStop(.4,fur);shade.addColorStop(1,['#34ab98','#d87770','#8a70bc','#d49a46'][k])}
  p.beginPath();p.moveTo(-.85,-.28);p.lineTo(-.89,-1.04);p.quadraticCurveTo(-.89,-1.17,-.75,-1.08);p.lineTo(-.38,-.78);
  p.quadraticCurveTo(0,-.9,.38,-.78);p.lineTo(.75,-1.08);p.quadraticCurveTo(.89,-1.17,.89,-1.04);p.lineTo(.85,-.28);
  p.bezierCurveTo(1.26,.58,.62,.91,0,.92);p.bezierCurveTo(-.62,.91,-1.26,.58,-.85,-.28);
  p.fillStyle=shade;p.fill();p.strokeStyle='#483c47';p.lineWidth=.058;p.stroke();
  for(const side of [-1,1]){
   poly([[side*.76,-.89],[side*.73,-.49],[side*.49,-.67]],'#ee91a0',p);
   ellipse(p,side*.36,.02,.092,.125,'#342f40');ellipse(p,side*.36-.018,-.026,.03,.034,'white');
   ellipse(p,side*.61,.25,.115,.063,'#f99da1');
   p.strokeStyle='#594852';p.lineWidth=.045;
   for(let i=0;i<2;i++){p.beginPath();p.moveTo(side*.57,.14+i*.13);p.lineTo(side*1.05,.08+i*.23);p.stroke()}
   p.beginPath();p.moveTo(0,.25);p.quadraticCurveTo(side*.09,.41,side*.2,.29);p.stroke()
  }
  poly([[-.105,.155],[.105,.155],[0,.26]],'#8d555f',p);
  p.fillStyle='#594756';p.textAlign='center';p.font='bold .37px sans-serif';p.fillText(marks[k]||'âœ¦',0,-.31);
  catHeads[k]=tile;
 }
 g.drawImage(catHeads[k],x-r*4/3,y-r*4/3,r*8/3,r*8/3)
}
const W=840,H=540,mid=W/2,base=432;
let aimCol=0,drag=null,spin=0;
function project(theta,radius,height){
 const x=Math.sin(theta)*radius,z=Math.cos(theta)*radius,scale=700/(760-z);
 return {x:mid+x*scale,y:268+(base-height-268+z*.11)*scale,z,scale};
}
const theta=c=>c*turn+angle;
function pos(b){return project(theta(b.c),112,312-b.r*29)}
function lowest(c){let r=-1;for(const b of board.values())if(b.c===c)r=Math.max(r,b.r);return cell(r+1,c,0)}
function shoot(){if(state!=='play'||shot)return;const target=lowest(aimCol);shots++;shot={target,p:0,k:charge===3?4:current};tone(210)}
function rotate(step){if(state!=='play'||shot)return;angle+=step*turn;aimCol=wrap(Math.round(-angle/turn));scout()}
el('left').onclick=()=>rotate(1);el('right').onclick=()=>rotate(-1);
function pointer(e){const r=canvas.getBoundingClientRect();return (e.clientX-r.left)*W/r.width}
function select(x){const old=aimCol;let distance=Infinity;for(let c=0;c<cols;c++){if(Math.cos(theta(c))<.15)continue;const d=Math.abs(pos(cell(0,c,0)).x-x);if(d<distance){distance=d;aimCol=c}}if(old!==aimCol)scout()}
canvas.onpointerdown=e=>{if(state!=='play'||shot)return;canvas.focus();canvas.setPointerCapture(e.pointerId);drag={x:pointer(e),angle,moved:false}};
canvas.onpointermove=e=>{if(state!=='play'||shot)return;const x=pointer(e);if(drag){const dx=x-drag.x;if(Math.abs(dx)>4)drag.moved=true;if(drag.moved){angle=drag.angle+dx*.009;aimCol=wrap(Math.round(-angle/turn));scout()}}else select(x)};
canvas.onpointerup=e=>{if(!drag)return;if(!drag.moved){select(pointer(e));shoot()}drag=null};canvas.onpointercancel=()=>drag=null;
window.onkeydown=e=>{if(e.target.tagName==='BUTTON'&&e.code==='Space')return;if(['ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();if(e.code==='KeyP')pause();if(e.code==='ArrowLeft')rotate(1);if(e.code==='ArrowRight')rotate(-1);if(e.code==='Space')shoot();if(e.code==='KeyS')swap()};
function pop(b,drop){if(mission[1]==='pop'||b.rescue)earned++;board.delete(key(b.r,b.c));const p=pos(b);if(p.z<-30)return;if(drop)particles.push({x:p.x,y:p.y,k:b.k,vx:(Math.random()-.5)*4,vy:1,life:45,fall:true});for(let i=0;i<7;i++)particles.push({x:p.x,y:p.y,k:b.k%4,vx:(Math.random()-.5)*6,vy:drop?1+Math.random()*2:-Math.random()*4,life:30})}
function land(){const b=shot.target;b.k=shot.k;shot=null;board.set(key(b.r,b.c),b);const rainbow=b.k===4;const group=rainbow?[...board.values()].filter(n=>Math.hypot(Math.min(wrap(n.c-b.c),wrap(b.c-n.c)),n.r-b.r)<=2):[...cluster([b],n=>n.k===b.k)];
 if(rainbow||group.length>=3){const birthday=birthdayMatch();combo++;charge=rainbow?0:Math.min(3,charge+1);group.forEach(n=>pop(n,false));const held=cluster([...board.values()].filter(n=>!n.r),()=>true);let drops=0;for(const n of board.values())if(!held.has(n)){pop(n,true);drops++}const points=(group.length*10+drops*20)*combo;score+=points;el('note').textContent=(rainbow?'Rainbow burst! ':combo>1?'Combo Ã—'+combo+'! ':'')+(drops?'Drop Ã—'+drops+'! ':'')+'+'+points;if(birthday)el('note').textContent='Happy 6th birthday, Dim-Dim!';noticeUntil=time+(birthday?4000:850);tone(440+combo*40)}
 else{combo=0;if(++misses===missLimit()){misses=0;board=new Map([...board.values()].map(n=>[key(n.r+1,n.c),{...n,r:n.r+1}]));for(let c=0;c<cols;c++)board.set(key(0,c),cell(0,c,Math.floor(Math.random()*4)))}}
 const type=mission[1],done=type==='pop'||type==='rescue'?earned>=mission[2]||!board.size:!board.size;
 if(done&&type==='waves'&&wave<mission[2]){wave++;populate();misses=0;el('note').textContent='Wave '+wave+' incoming!';noticeUntil=time+1500}
 else if(done){finished[level]=Math.max(finished[level]||0,score||1);delete slots[level];overlay('win',level===12?'Summit rescued!':mission[0]+' cleared!',score+' points in '+shots+' shots. '+(level===12?'Your crew unlocked Endless Peak.':'Your trail stamp is in the map.'),level>=12?'Climb higher':'Next tower')}
 else if([...board.values()].some(n=>n.r>=10)){delete slots[level];overlay('loss','Tower overflowing!', 'Your cleared towers are safe. Try this layout again.','Retry this tower')}
 current=[...board.values()].some(n=>n.k===next)?next:pick();next=pick();sync();save()}
function poly(points,color,g=ctx){g.fillStyle=color;g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fill()}
function ellipse(g,x,y,rx,ry,color){g.fillStyle=color;g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fill()}
const scenery=document.createElement('canvas');scenery.width=W;scenery.height=H;
function landscape(){const g=scenery.getContext('2d'),sky=g.createLinearGradient(0,0,0,380);sky.addColorStop(0,['#69bce4','#d88278','#76a5cb','#202a55'][region]);sky.addColorStop(.75,['#d9ecda','#ffd6a6','#dfeef9','#9f92bb'][region]);sky.addColorStop(1,['#f6e7bd','#ffdfad','#e7f2ef','#f2bfab'][region]);g.fillStyle=sky;g.fillRect(0,0,W,H);
 ellipse(g,678,87,38,38,'#fff3bd');let seed=127+level*23;function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
 for(const [x,y,s] of [[130,75,1],[524,54,.57],[747,135,.8],[10,146,.63]]){for(let i=0;i<7;i++)ellipse(g,x+(i-3)*18*s,y-Math.sin(i*Math.PI/6)*15*s,(24+i%3*4)*s,(9+Math.sin(i*Math.PI/6)*10)*s,'#fffff2')}
 for(const [x,y,w,h] of [[-50,192,138,130],[96,142,169,170],[234,194,110,100],[624,147,150,170],[788,179,147,133]]){poly([[x-w,y+h],[x,y],[x+w,y+h]],'#86b6bc',g);poly([[x,y],[x+w,y+h],[x+30,y+h],[x-12,y+61]],'#6b9da8',g);poly([[x-w*.31,y+h*.31],[x,y],[x+w*.32,y+h*.32],[x+17,y+29],[x+6,y+37],[x-4,y+22],[x-21,y+40]],'#f6f5df',g)}
 for(let layer=0;layer<3;layer++){let y=x=>258+layer*48+Math.sin(x*.009+layer*2.6+region)*27+Math.cos(x*.015+layer)*16;const pts=[[0,H]];for(let x=0;x<=W;x+=5)pts.push([x,y(x)]);pts.push([W,H]);poly(pts,[['#83afa0','#6f9d79','#9db974'],['#c59986','#ba8865','#c89b63'],['#a5bfce','#94b4c4','#d1e2df'],['#8c8cab','#6e8590','#75938c']][region][layer],g);for(let i=0;i<110;i++){let x=rand()*W,yy=y(x)+rand()*24,h=7+rand()*18;poly([[x-h*.26,yy],[x,yy-h],[x+h*.26,yy]],['#77a59a','#558774','#789b66'][layer],g)}}
 poly([[0,441],[80,425],[269,443],[458,426],[652,415],[840,431],[840,540],[0,540]],['#a8c778','#d9b875','#e1eceb','#89a293'][region],g);poly([[203,540],[369,470],[416,429],[450,429],[430,462],[387,493],[349,540]],'#d8cb9c',g);
 for(let i=0;i<480;i++){let x=rand()*W,y=448+rand()*93;g.fillStyle=i%6?'#92ae66':'#f7e399';g.fillRect(x,y,2+rand()*3,2)}
 for(const [x,y,s] of [[34,463,1.3],[88,435,.83],[780,449,1.22],[818,464,1.65],[141,427,.54]]){g.fillStyle='#5b6045';g.fillRect(x-4*s,y-32*s,8*s,32*s);for(let j=0;j<3;j++){let yy=y-(13+18*j)*s,w=(25-5*j)*s;poly([[x-w,yy],[x,yy-(42-j*4)*s],[x+w,yy]],'#396b55',g);poly([[x,yy-(42-j*4)*s],[x+w,yy],[x+3*s,yy]],'#2f5b4c',g)}}
}
function face(corners,color){poly(corners.map(v=>[v.x,v.y]),color)}
function bricks(){let faces=[];const rings=25,segs=22,step=2*Math.PI/segs;
 for(let row=0;row<rings;row++){const h=row*14,r=row<2?108:row>22?105:99;for(let j=0;j<segs;j++){const a=angle+(j+(row%2)*.5)*step,b=a+step,m=(a+b)/2;if(Math.cos(m)<-.05)continue;
 const hue=12+(row*7+j*3)%8,light=45+12*Math.cos(m+.7)+(row*13+j*11)%9;
 const corners=[project(a,r,h),project(b,r,h),project(b,r,h+14),project(a,r,h+14)];
 faces.push({z:Math.cos(m),corners,fill:'hsl('+hue+' 48% '+light+'%)'})}}
 faces.sort((a,b)=>a.z-b.z);for(const f of faces){face(f.corners,f.fill);ctx.strokeStyle='#774f40aa';ctx.lineWidth=1.35;ctx.stroke();const [,,b,a]=f.corners;ctx.strokeStyle='#ffcb9f99';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(a.x,a.y+1);ctx.lineTo(b.x,b.y+1);ctx.stroke()}}
function crown(){const ring=Array.from({length:60},(_,i)=>project(i*Math.PI/30,105,350));face(ring,'#875946');const merlons=[];for(let j=0;j<16;j++){const a=angle+j*Math.PI/8,b=a+.23;const verts=[project(a,105,350),project(b,105,350),project(b,105,369),project(a,105,369),project(a,84,369),project(b,84,369)];merlons.push({z:Math.cos((a+b)/2),v:verts})}for(const {v,z} of merlons.sort((a,b)=>a.z-b.z)){face([v[0],v[1],v[2],v[3]],z>0?'#cc825d':'#a7674e');face([v[3],v[2],v[5],v[4]],'#edaa7a')}
 const mast=project(0,0,350);ctx.fillStyle='#644f41';ctx.fillRect(mast.x-2,mast.y-56,4,56);poly([[mast.x+2,mast.y-55],[mast.x+35,mast.y-49+Math.sin(time/350)*2],[mast.x+2,mast.y-37]],'#cf4a37')}
function landmark(){
 if(region===0){const x=166,y=341;poly([[x-14,y+28],[x-10,y-9],[x+9,y-9],[x+14,y+28]],'#e9ce9c');poly([[x-14,y-8],[x,y-24],[x+14,y-8]],'#9c6450');ctx.save();ctx.translate(x,y-6);ctx.rotate(time/4800);for(let i=0;i<4;i++){ctx.rotate(Math.PI/2);ctx.fillStyle='#795e45';ctx.fillRect(-1,-31,2,32);poly([[1,-30],[7,-28],[7,-12],[1,-10]],'#f8edcc')}ctx.restore()}
 if(region===1){ctx.fillStyle='#a37859';ctx.fillRect(535,343,195,5);for(let i=0;i<6;i++){const x=535+i*33;ctx.strokeStyle='#a37859';ctx.lineWidth=5;ctx.beginPath();ctx.arc(x+17,360,15,Math.PI,2*Math.PI);ctx.stroke();ctx.fillRect(x,358,5,18)}}
 if(region===2){ctx.strokeStyle='#566b72';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,266);ctx.lineTo(278,175);ctx.stroke();for(let i=0;i<3;i++){const x=(time*.009+i*94)%278,y=266-x*.327;ctx.fillStyle='#4e535b';ctx.fillRect(x,y,2,6);ctx.fillStyle='#b85b44';ctx.fillRect(x-7,y+6,15,11);ctx.fillStyle='#c3e5ea';ctx.fillRect(x-5,y+7,10,4)}}
 if(region===3){const x=634,y=300;ctx.fillStyle='#696a81';ctx.fillRect(x-22,y,44,30);ctx.fillStyle='#606581';ctx.beginPath();ctx.arc(x,y,24,Math.PI,Math.PI*2);ctx.fill();ctx.fillStyle='#f8dda6';for(let i=0;i<3;i++)ctx.fillRect(x-12+10*i,y+7,4,9)}
}
function weather(){
 if(region===3){for(let i=0;i<40;i++){const x=(i*137+21)%W,y=(i*i*11+17)%130;ctx.globalAlpha=.55+.35*Math.sin(i+time/800);ellipse(ctx,x,y,1.15,1.15,'#fff8cf')}ctx.globalAlpha=1}
 if(region===1||region===2){for(let i=0;i<20;i++){const x=(i*137+time*.016+Math.sin(i+time/1400)*17)%W,y=(i*51+time*(.012+i%3*.006))%H;ellipse(ctx,x,y,region===1?3.5:1.8,1.7,region===1?'#d17e39':'#ffffffca')}}
 if(region===0){ctx.strokeStyle='#416a72';ctx.lineWidth=1.6;for(let i=0;i<4;i++){const x=(time*.014+i*18+96)%(W+90)-45,y=112+Math.sin(i*4)*11,flap=Math.sin(time/220+i)*3;ctx.beginPath();ctx.moveTo(x-4,y+flap);ctx.lineTo(x,y+2);ctx.lineTo(x+4,y+flap);ctx.stroke()}}
}
function gateway(){
 for(let i=0;i<4;i++){const t=angle+i*Math.PI/2,co=Math.cos(t);if(co<.4)continue;const p=project(t,101,37);ctx.save();ctx.translate(p.x,p.y);ctx.scale(co*p.scale,p.scale);
 ctx.fillStyle='#835846';ctx.beginPath();ctx.arc(0,-11,12,Math.PI,Math.PI*2);ctx.lineTo(12,14);ctx.lineTo(-12,14);ctx.fill();ctx.fillStyle='#3c3932';ctx.beginPath();ctx.arc(0,-11,8,Math.PI,Math.PI*2);ctx.lineTo(8,14);ctx.lineTo(-8,14);ctx.fill();ctx.fillStyle='#997952';for(const x of [-5,-1,3])ctx.fillRect(x,-17,1.2,30);ctx.restore()}
}
function decorations(){
 for(const edge of [0,W]){ctx.save();ctx.translate(edge,0);if(edge)ctx.scale(-1,1);ctx.beginPath();ctx.moveTo(0,20);ctx.quadraticCurveTo(126,63,270,-4);ctx.strokeStyle='#746647';ctx.lineWidth=2;ctx.stroke();for(let i=0;i<10;i++){const t=(i+.5)/10,x=252*t+18*t*t,y=20+86*t-110*t*t;poly([[x-6,y-1],[x+7,y+1],[x+1,y+15]],colors[i%4])}ctx.restore()}
 const x=mid+81,y=482;ellipse(ctx,x,y+17,37,6,'#61764e55');ellipse(ctx,x,y+12,31,7,'#fff4d9');ctx.fillStyle='#d99395';ctx.fillRect(x-23,y-4,46,15);ellipse(ctx,x,y+10,23,5,'#d99395');ellipse(ctx,x,y-4,24,6,'#fff4cb');
 for(let i=0;i<6;i++){const xx=x-17+i*7,yy=y-12+(i%2)*2;ctx.fillStyle=colors[i%4];ctx.fillRect(xx-1.5,yy,3,9);ctx.fillStyle='#554237';ctx.fillRect(xx-.5,yy-2,1,2);if(i<litCandles){ellipse(ctx,xx,yy-4.4,2.5,4+Math.sin(time/150+i)*.5,'#ff9b33');ellipse(ctx,xx,yy-3.6,1.3,2.5,'#fff8a1')}}
 ctx.fillStyle='#a24e48';ctx.font='bold 13px Georgia';ctx.textAlign='center';ctx.fillText('6',x,y+9)
}
function confetti(){if(time>confettiUntil)return;for(let i=0;i<90;i++){const t=6500-confettiUntil+time;const x=(i*173+Math.sin(i+t/420)*17+W)%W,y=(i*43+t*(.11+i%7*.019))%(H+90)-45;ctx.fillStyle=colors[i%4];ctx.fillRect(x,y,4+2*Math.cos(i+t/140),6)}}
function draw(){ctx.drawImage(scenery,0,0);decorations();landmark();weather();ellipse(ctx,mid+12,439,135,13,'#58774b55');
 const visible=[...board.values()].map(b=>({b,p:pos(b)})).sort((a,b)=>a.p.z-b.p.z);
 function orb({b,p}){bubble(p.x,p.y,b.k,17*p.scale);if(b.rescue){const y=p.y+11*p.scale;ellipse(ctx,p.x,y,6,6,'#784115');ellipse(ctx,p.x,y,4.5,4.5,'#ffe56c');ctx.fillStyle='#795131';ctx.fillRect(p.x-2,y+1,4,1.5)}}
 visible.filter(v=>v.p.z<0).forEach(orb);bricks();gateway();crown();visible.filter(v=>v.p.z>=0).forEach(orb);
 const target=shot?shot.target:lowest(aimCol),p=pos(target);const start={x:mid,y:497},k=shot?shot.k:charge===3?4:current;
 if(!shot){const near=adjacent(target).map(v=>board.get(key(v.r,v.c))).filter(v=>v&&v.k===current);const good=charge===3||cluster(near,n=>n.k===current).size>=2;
 ctx.globalAlpha=.49+.13*Math.sin(time/200);bubble(p.x,p.y,k,16*p.scale);ctx.globalAlpha=1;ctx.strokeStyle=good?'#ffdc50':'#fff9db';ctx.lineWidth=2.5;ctx.setLineDash([3,8]);ctx.beginPath();ctx.moveTo(start.x,start.y);ctx.lineTo(p.x,p.y);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.arc(p.x,p.y,19,0,Math.PI*2);ctx.stroke()}
 ellipse(ctx,mid,521,45,8,'#5e725250');cat(ctx,mid-32,466,4);bubble(start.x,start.y,k,15);
 if(shot)bubble(start.x+(p.x-start.x)*shot.p,start.y+(p.y-start.y)*shot.p,k,16);
 for(const dust of particles){ctx.globalAlpha=Math.min(1,dust.life/30);if(dust.fall)bubble(dust.x,dust.y,dust.k,13);else{ctx.fillStyle=colors[dust.k];ctx.fillRect(dust.x,dust.y,5,5)}}ctx.globalAlpha=1;confetti()}
let prev=0;function frame(now){const dt=Math.min(40,now-prev);prev=now;time=now;if(state==='play'){if(shot){shot.p+=dt/310;if(shot.p>=1)land()}for(const p of particles){p.x+=p.vx*dt/16;p.y+=p.vy*dt/16;p.vy+=.1*dt/16;p.life-=dt/16}particles=particles.filter(p=>p.life>0)}if(time>noticeUntil)el('note').textContent='';draw();requestAnimationFrame(frame)}start(Math.max(1,Number(latest)||1),true);requestAnimationFrame(frame);
