(function(){
  // Simple procedural pixel drone sprite factory with color + frame caching.
  const designs = {
    player_core: { size:16, frames:2, draw:(ctx,f)=>{
      ctx.clearRect(0,0,16,16);
      ctx.fillStyle='#808080'; ctx.fillRect(4,4,8,8);
      ctx.clearRect(4,4,2,2); ctx.clearRect(10,4,2,2); ctx.clearRect(4,10,2,2); ctx.clearRect(10,10,2,2); // octagon cut
      ctx.fillStyle=f? '#b0b0b0':'#c0c0c0'; ctx.fillRect(7,7,2,2); // eye flicker
      ctx.fillStyle='#999'; ctx.fillRect(2,6,2,4); ctx.fillRect(12,6,2,4); // antennae
      if(f){ ctx.fillStyle='#a0a0a0'; ctx.fillRect(6,12,4,2);} else { ctx.fillStyle='#909090'; ctx.fillRect(6,13,4,1);} // thruster
    }},
    enemy_basic: { size:12, frames:2, draw:(ctx,f)=>{
      ctx.clearRect(0,0,12,12);
      ctx.fillStyle='#808080'; ctx.fillRect(3,3,6,6);
      ctx.clearRect(3,3,1,1); ctx.clearRect(8,3,1,1); ctx.clearRect(3,8,1,1); ctx.clearRect(8,8,1,1);
      ctx.fillStyle=f? '#b5b5b5':'#c5c5c5'; ctx.fillRect(5,5,2,2);
    }},
    enemy_charger: { size:12, frames:3, draw:(ctx,f)=>{
      ctx.clearRect(0,0,12,12);
      ctx.fillStyle='#808080'; ctx.fillRect(4,4,4,4);
      const arms=[ [[0,5,4,2],[8,5,4,2]], [[5,0,2,4],[5,8,2,4]], [[0,5,4,2],[8,5,4,2]] ];
      for(const a of arms[f]) ctx.fillRect(...a);
      ctx.fillStyle='#b5b5b5'; ctx.fillRect(5,5,2,2);
    }},
    enemy_splinter: { size:12, frames:2, draw:(ctx,f)=>{
      ctx.clearRect(0,0,12,12);
      ctx.fillStyle='#808080'; ctx.fillRect(4,4,4,4);
      if(f){ ctx.fillStyle='#a0a0a0'; ctx.fillRect(3,4,1,4); ctx.fillRect(8,4,1,4);} else { ctx.fillStyle='#a0a0a0'; ctx.fillRect(4,3,4,1); ctx.fillRect(4,8,4,1);} // vibration
      ctx.fillStyle='#c5c5c5'; ctx.fillRect(5,5,2,2);
    }},
    enemy_fragment: { size:8, frames:2, draw:(ctx,f)=>{
      ctx.clearRect(0,0,8,8);
      ctx.fillStyle='#808080'; ctx.fillRect(2,2,4,4);
      ctx.fillStyle=f?'#b0b0b0':'#909090'; ctx.fillRect(3,3,2,2);
    }}
  };

  const cache = {}; // key: id|color -> [frames]

  function buildFrames(id){
    const d = designs[id]; if(!d) return null;
    const frames=[]; for(let f=0; f<d.frames; f++){ const c=document.createElement('canvas'); c.width=c.height=d.size; d.draw(c.getContext('2d'),f); frames.push(c); }
    return frames;
  }
  function tint(src,color){
    const c=document.createElement('canvas'); c.width=src.width; c.height=src.height; const ctx=c.getContext('2d');
    ctx.drawImage(src,0,0); ctx.globalCompositeOperation='source-in'; ctx.fillStyle=color; ctx.fillRect(0,0,c.width,c.height); return c;
  }
  function get(id, color, time){
    const baseKey = id+'|base';
    if(!cache[baseKey]) cache[baseKey] = buildFrames(id);
    if(!cache[baseKey]) return null;
    const colorKey = id+'|'+color;
    if(!cache[colorKey]){ cache[colorKey] = cache[baseKey].map(f=>tint(f,color)); }
    const frames = cache[colorKey];
    const d = designs[id];
    const frame = frames.length === 1 ? frames[0] : frames[Math.floor((time*6)%frames.length)];
    return { canvas: frame, size: d.size };
  }
  window.SpriteFactory = { get };
})();
