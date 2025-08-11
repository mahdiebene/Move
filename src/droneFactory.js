(function(){
  // DroneFactory: procedural quad drone frames with cached composite animation.
  const TAU = Math.PI*2;
  const variants = {
    player: { size:26, spinMul:1.0 },
    enemy_basic: { size:20, spinMul:0.85 },
    enemy_charger: { size:20, spinMul:1.3, jitter:true },
    enemy_splinter: { size:18, spinMul:1.15 },
    enemy_fragment: { size:14, spinMul:1.05 }
  };
  const config = { rotorFrames:16, spinFPS:16, rotorRadiusPct:26, bladeCount:3 };
  const rotorCache = new Map(); // key: size|bladeColor|tipColor -> {frames:[]}
  const animCache = new Map(); // key: variant|color -> frames[] (composited body+rotors)

  function makeBody(size, color, role){
    const c=document.createElement('canvas'); c.width=c.height=size; const ctx=c.getContext('2d');
    ctx.translate(size/2,size/2);
    ctx.strokeStyle='rgba(255,255,255,0.25)';
    const innerArm=size*0.12, armLen=size*0.24;
    for(let i=0;i<4;i++){
      const a=i*TAU/4 + TAU/8;
      ctx.beginPath(); ctx.moveTo(Math.cos(a)*innerArm,Math.sin(a)*innerArm); ctx.lineTo(Math.cos(a)*armLen,Math.sin(a)*armLen); ctx.stroke();
    }
    // Body capsule
    const w=size*0.42, h=size*0.78, r=Math.min(w,h)*0.3;
    ctx.rotate(Math.PI/2);
    ctx.beginPath();
    ctx.moveTo(-w/2 + r, -h/2);
    ctx.lineTo(w/2 - r, -h/2);
    ctx.quadraticCurveTo(w/2, -h/2, w/2, -h/2 + r);
    ctx.lineTo(w/2, h/2 - r);
    ctx.quadraticCurveTo(w/2, h/2, w/2 - r, h/2);
    ctx.lineTo(-w/2 + r, h/2);
    ctx.quadraticCurveTo(-w/2, h/2, -w/2, h/2 - r);
    ctx.lineTo(-w/2, -h/2 + r);
    ctx.quadraticCurveTo(-w/2, -h/2, -w/2 + r, -h/2);
    ctx.closePath();
    ctx.fillStyle = role==='player'? '#1c3240' : '#20262c';
    ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.35)'; ctx.stroke();
    // Diode
    ctx.fillStyle = color; const d=Math.max(2,size*0.12); ctx.fillRect(-d/2,-d/2,d,d);
    return c;
  }
  function makeRotorFrames(size, bladeColor, tipColor){
    const r = size * (config.rotorRadiusPct/100);
    const w = Math.max(2, Math.round(size*0.10));
    const key=[size,bladeColor,tipColor,config.rotorFrames,config.bladeCount,r,w].join('|');
    if(rotorCache.has(key)) return rotorCache.get(key);
    const pack=[];
    for(let f=0; f<config.rotorFrames; f++){
      const ang=f/config.rotorFrames*TAU;
      const side=Math.ceil(r*2.2); const c=document.createElement('canvas'); c.width=c.height=side; const ctx=c.getContext('2d');
      ctx.translate(side/2,side/2); ctx.rotate(ang);
      for(let b=0;b<config.bladeCount;b++){
        ctx.save(); ctx.rotate(b*TAU/config.bladeCount);
        ctx.fillStyle=bladeColor; ctx.fillRect(0,-w/2,r,w);
        ctx.fillStyle=tipColor; ctx.fillRect(r-w,-w/2,w,w);
        ctx.restore();
      }
      ctx.fillStyle='rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.arc(0,0,w*0.9,0,TAU); ctx.fill();
      pack.push(c);
    }
    rotorCache.set(key,pack); return pack;
  }
  function buildVariantFrames(variantId, color){
    const v = variants[variantId]; if(!v) return null;
    const key=variantId+'|'+color; if(animCache.has(key)) return animCache.get(key);
    const frames=[]; const body=makeBody(v.size,color, variantId==='player'?'player':'enemy');
    const rotorFrames = makeRotorFrames(v.size,'#7f8890',color);
    for(let i=0;i<config.rotorFrames;i++){
      const c=document.createElement('canvas'); c.width=c.height=v.size; const ctx=c.getContext('2d');
      ctx.drawImage(body,0,0);
      const off=v.size*0.36; const rf=rotorFrames[i]; const rw=rf.width, rh=rf.height;
      // four rotors
      ctx.drawImage(rf, v.size/2-off - rw/2, v.size/2-off - rh/2);
      ctx.drawImage(rf, v.size/2+off - rw/2, v.size/2-off - rh/2);
      ctx.drawImage(rf, v.size/2+off - rw/2, v.size/2+off - rh/2);
      ctx.drawImage(rf, v.size/2-off - rw/2, v.size/2+off - rh/2);
      frames.push(c);
    }
    animCache.set(key,frames); return frames;
  }
  function get(id, color, t){
    const v=variants[id]; if(!v) return null; const frames=buildVariantFrames(id,color); if(!frames) return null;
    const spin = config.spinFPS * (v.spinMul||1); const idx=Math.floor((t*spin)%frames.length); const canvas=frames[idx];
    return { canvas, size: v.size, radius: v.size*0.43 };
  }
  window.DroneFactory = { get };
})();
