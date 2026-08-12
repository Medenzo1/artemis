async function doLogin(){
 const user=document.getElementById('loginUser').value.trim();
 const pass=document.getElementById('loginPass').value;
 try{
  await _auth.signInWithEmailAndPassword(user, pass);
  // L'écran d'accueil est affiché par le listener onAuthStateChanged (js/02-state-core.js)
 }catch(e){
  const err=document.getElementById('loginError');
  err.style.display='block';
  document.getElementById('loginPass').value='';
  document.getElementById('loginPass').focus();
  setTimeout(()=>err.style.display='none', 3000);
 }
}
(function(){
 const cv=document.getElementById('loginCanvas');
 if(!cv)return;
 const cx=cv.getContext('2d');
 let W,H,t=0,pts=[];

 function resize(){
  W=cv.width=innerWidth;
  H=cv.height=innerHeight;
  pts=Array.from({length:120},()=>mkPt());
 }
 function mkPt(){
  return {x:Math.random()*W,y:Math.random()*H,r:Math.random()*.9+.1,a:Math.random()*.7+.1,vx:(Math.random()-.5)*.15,vy:(Math.random()-.5)*.15};
 }
 function draw(){
  t+=.005;
  cx.clearRect(0,0,W,H);

  // Deep background
  const bg=cx.createLinearGradient(0,0,W*.3,H);
  bg.addColorStop(0,'#010b14');
  bg.addColorStop(.5,'#020d1c');
  bg.addColorStop(1,'#010810');
  cx.fillStyle=bg;cx.fillRect(0,0,W,H);

  // Aurora blobs
  function blob(x,y,rx,ry,ro,go,bo,alpha){
   const mx=Math.max(rx,ry);
   const g=cx.createRadialGradient(x,y,0,x,y,mx);
   g.addColorStop(0,'rgba('+ro+','+go+','+bo+','+alpha+')');
   g.addColorStop(1,'rgba(0,0,0,0)');
   cx.save();cx.transform(rx/mx,0,0,ry/mx,x*(1-rx/mx),y*(1-ry/mx));
   cx.beginPath();cx.arc(x,y,mx,0,6.28);
   cx.fillStyle=g;cx.fill();cx.restore();
  }

  const a1=Math.sin(t*.6), a2=Math.sin(t*.4+1.2), a3=Math.sin(t*.5+2.4);

  // Vibrant aurora layers
  blob(W*(.15+a1*.04), H*(.35+a2*.06), W*.55, H*.4,  0,160,255, .11+a1*.04);
  blob(W*(.6+a2*.05),  H*(.2+a3*.05),  W*.5,  H*.35, 0,80,200,  .09+a2*.03);
  blob(W*(.85+a3*.04), H*(.5+a1*.05),  W*.4,  H*.3,  0,200,220, .08+a3*.03);
  blob(W*.45,          H*.6,           W*.7,  H*.4,  0,40,120,  .15);
  // Warm accent (cyan-teal)
  blob(W*(.3+a2*.03),  H*(.15+a1*.04), W*.3,  H*.2,  0,220,200, .07+a2*.02);

  // Grid
  cx.strokeStyle='rgba(0,150,220,.022)';cx.lineWidth=.6;
  for(let x=0;x<W;x+=55){cx.beginPath();cx.moveTo(x,0);cx.lineTo(x,H);cx.stroke();}
  for(let y=0;y<H;y+=55){cx.beginPath();cx.moveTo(0,y);cx.lineTo(W,y);cx.stroke();}

  // Stars
  pts.forEach(p=>{
   p.x+=p.vx;p.y+=p.vy;
   if(p.x<0||p.x>W)p.vx*=-1;
   if(p.y<0||p.y>H)p.vy*=-1;
   cx.globalAlpha=p.a*(0.5+0.5*Math.sin(t*2+p.x));
   cx.fillStyle='#a0d8ff';
   cx.beginPath();cx.arc(p.x,p.y,p.r,0,6.28);cx.fill();
  });
  cx.globalAlpha=1;

  // Bright orb top-right
  const ox=W*.82,oy=H*.1,or=Math.min(W,H)*.09;
  if (!or || or <= 0) return;
  const og=cx.createRadialGradient(ox,oy,0,ox,oy,or*3);
  og.addColorStop(0,'rgba(0,200,255,.2)');
  og.addColorStop(.35,'rgba(0,140,220,.07)');
  og.addColorStop(1,'rgba(0,0,0,0)');
  cx.fillStyle=og;cx.beginPath();cx.arc(ox,oy,or*3,0,6.28);cx.fill();
  const oc=cx.createRadialGradient(ox,oy,0,ox,oy,or*.6);
  oc.addColorStop(0,'rgba(180,240,255,.35)');
  oc.addColorStop(1,'rgba(0,180,220,.0)');
  cx.fillStyle=oc;cx.beginPath();cx.arc(ox,oy,or*.6,0,6.28);cx.fill();

  // ── Skyline ──
  const GH=H*.86; // ground horizon
  // Precomputed buildings (seeded from W so they resize correctly)
  if(!draw._bld||draw._bldW!==W){
   draw._bldW=W;
   const seed=[
    // [xFrac, wFrac, hFrac, floors, windowCols, glowR,glowG,glowB]
    [.00,.055,.48,6,2, 0,160,220],
    [.05,.04, .32,4,1, 0,120,180],
    [.09,.06, .58,7,2, 0,180,230],
    [.14,.035,.28,3,1, 0,100,160],
    [.17,.07, .72,9,3, 0,200,255],
    [.23,.05, .42,5,2, 0,140,200],
    [.27,.04, .30,4,1, 0,120,180],
    [.30,.09, .65,8,3, 0,180,240],
    [.38,.05, .38,5,2, 0,130,190],
    [.42,.04, .26,3,1, 0,100,160],
    [.45,.06, .55,7,2, 0,160,220],
    [.50,.045,.35,4,1, 0,120,180],
    [.54,.08, .80,10,3,0,210,255], // tallest center
    [.61,.05, .45,6,2, 0,150,210],
    [.65,.04, .28,3,1, 0,100,160],
    [.68,.07, .62,8,3, 0,180,235],
    [.74,.05, .38,5,2, 0,140,200],
    [.78,.04, .24,3,1, 0,110,170],
    [.81,.065,.50,6,2, 0,160,220],
    [.86,.04, .30,4,1, 0,120,180],
    [.89,.07, .68,8,3, 0,190,245],
    [.95,.05, .40,5,2, 0,140,200],
    [.99,.04, .22,3,1, 0,100,160],
   ];
   draw._bld=seed.map(([xf,wf,hf,fl,wc,r,g,b])=>({
    x:xf*W, w:wf*W, h:hf*GH*.85,
    fl,wc,r,g,b,
    // randomise some window lights
    wins:Array.from({length:fl*wc},(_,i)=>({
      lit:Math.random()>.35,
      col:Math.floor(Math.random()*3),        // current color index 0=yellow 1=blue 2=orange
      nextSwitch:Math.random()*300+60,         // frame countdown to next color change
      timer:Math.floor(Math.random()*300)      // staggered start
     }))
   }));
  }

  const blds=draw._bld;

  // Ground glow (reflected city light on the "water/street")
  const gg=cx.createLinearGradient(0,GH,0,GH+H*.12);
  gg.addColorStop(0,'rgba(0,120,200,.12)');
  gg.addColorStop(1,'rgba(0,0,0,0)');
  cx.fillStyle=gg; cx.fillRect(0,GH,W,H*.12);

  // Draw buildings back→front (darker ones first for depth)
  blds.forEach((b,bi)=>{
   const by=GH-b.h;
   const depth=1-b.h/(GH*.85); // 0=tall(front) 1=short(back)

   // Building body - gradient from slightly lighter top to dark base
   const bg2=cx.createLinearGradient(0,by,0,GH);
   const br=Math.round(3+depth*6), bg=Math.round(8+depth*16), bb2=Math.round(16+depth*28);
   bg2.addColorStop(0,`rgb(${br+8},${bg+14},${bb2+22})`);
   bg2.addColorStop(1,`rgb(${br},${bg},${bb2})`);
   cx.fillStyle=bg2;
   cx.fillRect(b.x,by,b.w,b.h);

   // Subtle left-edge highlight
   cx.fillStyle=`rgba(0,160,230,${.06+depth*.04})`;
   cx.fillRect(b.x,by,2,b.h);

   // Windows - blink & cycle yellow / blue / orange
   const wPal=[[255,210,70],[70,160,255],[255,130,30]];
   const ww=b.w/(b.wc*2+1);
   const wh=ww*1.1;
   const rowH=b.h/b.fl;
   b.wins.forEach((w,i)=>{
    // Advance timer and switch color+state when it hits zero
    w.timer--;
    if(w.timer<=0){
     w.lit=!w.lit;
     if(w.lit) w.col=(w.col+1)%3;   // change color each time window turns on
     w.timer=w.lit
      ? Math.floor(400+Math.random()*800)   // on duration  (400–1200 frames)
      : Math.floor(100+Math.random()*300);  // off duration (100–400 frames)
    }
    if(!w.lit) return;
    const gc=i%b.wc, row=Math.floor(i/b.wc);
    const wx=b.x+ww*(gc*2+.8);
    const wy=by+row*rowH+rowH*.25;
    if(wy+wh>GH) return;
    const [wr,wg,wb]=wPal[w.col];
    // Soft fade-in using sin ramp from timer
    const age=1-w.timer/300;
    const alpha=Math.min(age*4,.88);
    cx.fillStyle=`rgba(${wr},${wg},${wb},${alpha})`;
    cx.fillRect(wx,wy,ww*.9,wh*.75);
    cx.fillStyle=`rgba(255,255,255,${alpha*.1})`;
    cx.fillRect(wx+1,wy+1,ww*.9-2,wh*.75-2);
   });

   // Rooftop antenna on tall buildings
   if(b.h>GH*.55){
    const ax=b.x+b.w/2;
    cx.strokeStyle=`rgba(${b.r},${b.g},${b.b},.4)`;
    cx.lineWidth=1.2;
    cx.beginPath();cx.moveTo(ax,by);cx.lineTo(ax,by-18);cx.stroke();
    // Blinking red light
    const blink=.5+.5*Math.sin(t*3+bi);
    cx.fillStyle=`rgba(255,80,80,${blink*.9})`;
    cx.beginPath();cx.arc(ax,by-18,2,0,6.28);cx.fill();
   }
  });

  // Ground line
  const gl=cx.createLinearGradient(0,GH-1,0,GH+3);
  gl.addColorStop(0,'rgba(0,180,230,.35)');
  gl.addColorStop(1,'rgba(0,0,0,0)');
  cx.fillStyle=gl; cx.fillRect(0,GH-1,W,4);

  // (reflection removed)

  // Bottom vignette (over everything)
  const vg=cx.createLinearGradient(0,GH+H*.02,0,H);
  vg.addColorStop(0,'rgba(1,8,18,0)');
  vg.addColorStop(1,'rgba(1,6,14,1)');
  cx.fillStyle=vg;cx.fillRect(0,GH+H*.02,W,H);

  if (!window._homeCanvasStop) requestAnimationFrame(draw);
 }
 window.addEventListener('resize',resize);
 resize(); draw();
})();

