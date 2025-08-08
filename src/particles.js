(function(){
  const MAX = 256;
  const pool = new Array(MAX).fill(0).map(() => ({active:false,x:0,y:0,vx:0,vy:0,life:0,max:0,size:2,color:'#fff'}));

  function spawnBurst(x, y, opts){
    const n = opts.n||12; const spread = opts.spread||Math.PI*2; const speed = opts.speed||120;
    const life = opts.life||0.4; const size = opts.size||2; const color = opts.color||'#fff';
    for (let i=0;i<n;i++){
      const p = pool.find(p=>!p.active); if (!p) break;
      const a = (opts.angle||0) + (Math.random()-0.5)*spread;
      const s = speed * (0.5 + Math.random()*0.75);
      p.active=true; p.x=x; p.y=y; p.vx=Math.cos(a)*s; p.vy=Math.sin(a)*s; p.life=life; p.max=life; p.size=size*(0.8+Math.random()*0.4); p.color=color;
    }
  }

  function updateAndRender(ctx, dt){
    for (let i=0;i<MAX;i++){
      const p = pool[i]; if (!p.active) continue;
      p.life -= dt; if (p.life<=0){p.active=false; continue;}
      p.x += p.vx*dt; p.y += p.vy*dt; p.vx *= 0.98; p.vy *= 0.98;
      const a = Math.max(0, p.life/p.max);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.size,0,Math.PI*2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  window.Particles = { spawnBurst, updateAndRender };
})();
