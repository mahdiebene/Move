(function(){
  // UI helpers for HUD
  function roundRectPath(ctx, x, y, w, h, r){
    const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }
  // Simple palette sets
  const Palettes = {
    base: { player: '#6cf', enemy: '#f66', orb: '#ffd66b' },
    colorblind: { player: '#5ad1ff', enemy: '#ff9f1a', orb: '#ffe066' },
    neon: { player: '#39a0ff', enemy: '#ff3b3b', orb: '#ffff6b' },
    sunset: { player: '#ff8e53', enemy: '#ff3b30', orb: '#ffd166' }
  };
  function multTierColor(tier){
    switch(tier){
      case 1: return '#6a7a8a';
      case 2: return '#88a9ff';
      case 3: return '#59e1d3';
      case 4: return '#b07cff';
      case 5: return '#ffd66b';
      default: return '#88a9ff';
    }
  }
  function Enemy(x, y, speed){
    this.x = x; this.y = y;
    this.r = 10; this.speed = (typeof speed === 'number') ? speed : 120;
    this.color = '#f66';
    this.nearMissTimer = 0;
    this.type = 'normal'; // 'normal' | 'charger' | 'splinter'
    this._t = 0; // internal timer for variants
  }
  Enemy.prototype.update = function(dt, game){
    this._t += dt;
    if (this.type === 'charger'){
      // wind-up then quick burst toward player
      const cycle = 1.2; // seconds
      const phase = (this._t % cycle);
      const dx = game.player.x - this.x;
      const dy = game.player.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      const dirx = dx / d, diry = dy / d;
      let sp = this.speed * 0.7;
      if (phase > 0.8){ sp = this.speed * 1.8; }
      this.x += dirx * sp * dt;
      this.y += diry * sp * dt;
    } else if (this.type === 'splinter'){
      // slightly slower, but on death will split (handled by game)
      const dx = game.player.x - this.x;
      const dy = game.player.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      this.x += (dx / d) * (this.speed * 0.9) * dt;
      this.y += (dy / d) * (this.speed * 0.9) * dt;
    } else {
      const dx = game.player.x - this.x;
      const dy = game.player.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      this.x += (dx / d) * this.speed * dt;
      this.y += (dy / d) * this.speed * dt;
    }
  };
  Enemy.prototype.render = function(ctx){
    // Use sprite if available
    if (window.SpriteFactory){
      let id = 'enemy_basic';
      if (this.type === 'charger') id = 'enemy_charger';
      else if (this.type === 'splinter') id = 'enemy_splinter';
      const spr = SpriteFactory.get(id, this.color, (performance.now||Date.now)()/1000 + this._t);
      if (spr){
        const s = spr.size; const half = s/2;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(spr.canvas, this.x - half, this.y - half, s, s);
      } else {
        ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI*2); ctx.fill();
      }
    } else {
      ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI*2); ctx.fill();
    }
  };

  const Game = {
    start(){
      this.canvas = document.getElementById('game');
      this.ctx = this.canvas.getContext('2d');
      this.width = this.canvas.width;
      this.height = this.canvas.height;
      // Difficulty menu state
    this.state = 'menu'; // 'menu' | 'playing'
      this.difficulties = {
        Chill: {
      spawnIntervalBase: 2.8, spawnIntervalMin: 1.2,
      enemyBaseSpeed: 90, enemyMaxSpeed: 180,
      maxEnemiesBase: 3, maxEnemiesCap: 12,
      orbSpawnInterval: 0.9,
      multDecayRate: 0.18, graceMax: 3.5,
      rampDuration: 150,
      initialEnemies: 1
        },
        Classic: {
      spawnIntervalBase: 2.0, spawnIntervalMin: 0.7,
      enemyBaseSpeed: 120, enemyMaxSpeed: 260,
      maxEnemiesBase: 6, maxEnemiesCap: 24,
      orbSpawnInterval: 1.4,
      multDecayRate: 0.30, graceMax: 2.5,
      rampDuration: 90,
      initialEnemies: 3
        },
        Frenzy: {
      spawnIntervalBase: 1.6, spawnIntervalMin: 0.5,
      enemyBaseSpeed: 140, enemyMaxSpeed: 300,
      maxEnemiesBase: 8, maxEnemiesCap: 32,
      orbSpawnInterval: 1.2,
      multDecayRate: 0.36, graceMax: 2.0,
      rampDuration: 60,
      initialEnemies: 4
        }
      };
      this.diffNames = Object.keys(this.difficulties);
      this.diffIndex = 1; // default Classic
      // Accessibility & UI options
      this.options = {
        screenShake: true,
        reducedFx: false,
        colorblind: false,
        highContrast: false,
        uiScale: 1.0,
        sound: true,
      };
  this.loadOptions();
  if (window.Sfx) Sfx.setEnabled(this.options.sound);
  // Cosmetics, achievements, and Daily mode
  this.loadCosmetics();
  this.loadAchievements();
  this.dailyMode = false; this.dailyDate = this.currentDate();
  // Daily modifiers (e.g., Thunderstorm)
  this.dailyMods = {};
  this.loadDailyScores(this.dailyDate);
      this.optionsOpen = false;
      this.paused = false;
      this._last = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      this.timeScale = 1; // 0..1
      this.targetTimeScale = 1;
  this.shakeMag = 0; this.shakeTime = 0; this.shakeT = 0;
  this.hitFlashTimer = 0; // red vignette on hit
  this.perfectFlashTimer = 0; // teal flash on perfect dash
      const loop = (t) => {
        const now = t || (typeof performance !== 'undefined' ? performance.now() : Date.now());
        const dt = Math.min(0.05, (now - this._last) / 1000);
        this._last = now;
        this.update(dt);
        this.render();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
      window.addEventListener('resize', () => this.fitToWindow());
      this.fitToWindow();
      this.loadBest();
    },
    // Daily RNG helpers
    currentDate(){ return new Date().toISOString().slice(0,10); },
    setSeedFromString(str){
      let h = 2166136261;
      for (let i=0;i<str.length;i++){
        h ^= str.charCodeAt(i);
        h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
      }
      this._rngState = h >>> 0;
    },
    rand(){
      if (!this.dailyMode) return Math.random();
      let x = this._rngState || 123456789;
      x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
      this._rngState = x >>> 0;
      return (this._rngState) / 0xFFFFFFFF;
    },
    enableDaily(){
      this.dailyMode = true; this.dailyDate = this.currentDate();
      this.setSeedFromString(this.dailyDate + '-minute-mage');
      // Example: Thunderstorm Day on specific weekday (e.g., Friday) or deterministic rule
      const day = new Date().getUTCDay(); // 0=Sun..6=Sat
      this.dailyMods = { thunderstorm: (day === 5) }; // Fridays are Thunderstorm
      this.loadDailyScores(this.dailyDate);
    },
    disableDaily(){ this.dailyMode = false; },
    loadDailyScores(date){
      try { const raw = localStorage.getItem('mm_daily_'+date); this.dailyScores = raw ? JSON.parse(raw) : []; }
      catch(e){ this.dailyScores = []; }
    },
    saveDailyScores(date){ try { localStorage.setItem('mm_daily_'+date, JSON.stringify(this.dailyScores||[])); } catch(e){} },
    loadBest(){
      try {
        const raw = localStorage.getItem('mm_best');
        this.best = raw ? JSON.parse(raw) : { score: 0, time: 0, maxMult: 1 };
      } catch(e){ this.best = { score: 0, time: 0, maxMult: 1 }; }
    },
    saveBest(){ try { localStorage.setItem('mm_best', JSON.stringify(this.best)); } catch(e){} },
    applyPalette(){
      const pal = this.getPalette();
      if (this.player) this.player.color = pal.player;
      if (this.enemies) for (const e of this.enemies) e.color = pal.enemy;
      if (this.orbs) for (const o of this.orbs) o.color = pal.orb;
    },
    getPalette(){
      if (this.options.colorblind) return Palettes.colorblind;
      const name = this.cosmetics && this.cosmetics.selectedPalette || 'base';
      return Palettes[name] || Palettes.base;
    },
    loadCosmetics(){
      const def = { selectedPalette: 'base', unlockedPalettes: ['base'], trail: 'default', unlockedTrails: ['default'] };
      try { const raw = localStorage.getItem('mm_cosmetics'); this.cosmetics = raw ? Object.assign(def, JSON.parse(raw)) : def; }
      catch(e){ this.cosmetics = def; }
    },
    saveCosmetics(){ try { localStorage.setItem('mm_cosmetics', JSON.stringify(this.cosmetics)); } catch(e){} },
    loadAchievements(){
      this.ach = { unlocked: {} };
      try { const raw = localStorage.getItem('mm_ach'); if (raw) this.ach = JSON.parse(raw); } catch(e){}
      const defStats = { totalRuns:0, totalOrbs:0, totalPerfects:0, longest:0 };
      try { const raw = localStorage.getItem('mm_stats'); this.statsLife = raw ? Object.assign(defStats, JSON.parse(raw)) : defStats; } catch(e){ this.statsLife = defStats; }
      this.achList = [
        { id:'score500', name:'Score 500', desc:'Reach 500 score in a run', check:(g)=>g.score>=500, reward:null },
        { id:'score1500', name:'Score 1500', desc:'Reach 1500 score in a run', check:(g)=>g.score>=1500, reward:{ type:'palette', key:'neon' } },
        { id:'score3000', name:'Score 3000', desc:'Reach 3000 score in a run', check:(g)=>g.score>=3000, reward:null },
        { id:'mult3', name:'Multiplier x3', desc:'Reach x3 multiplier', check:(g)=>g.stats && g.stats.maxMult>=3, reward:null },
        { id:'mult5', name:'Multiplier x5', desc:'Reach x5 multiplier', check:(g)=>g.stats && g.stats.maxMult>=5, reward:{ type:'palette', key:'sunset' } },
        { id:'perf5run', name:'Perfect 5', desc:'5 perfect dashes in one run', check:(g)=>g.stats && g.stats.perfectDashes>=5, reward:{ type:'trail', key:'comet' } },
        { id:'orbs100', name:'Collector 100', desc:'Collect 100 orbs lifetime', check:(g)=>g.statsLife && g.statsLife.totalOrbs>=100, reward:null },
        { id:'orbs500', name:'Collector 500', desc:'Collect 500 orbs lifetime', check:(g)=>g.statsLife && g.statsLife.totalOrbs>=500, reward:null },
        { id:'runs10', name:'Ten Runs', desc:'Play 10 runs', check:(g)=>g.statsLife && g.statsLife.totalRuns>=10, reward:null },
        { id:'survive90', name:"Stayin' Alive", desc:'Survive 90 seconds', check:(g)=>g.elapsed>=90, reward:null },
        { id:'survive120', name:'Endurer', desc:'Survive 120 seconds', check:(g)=>g.elapsed>=120, reward:null },
      ];
      this.achOpen = false;
    },
    tryUnlockAchievements(){
      let unlockedNow = [];
      for (const a of (this.achList||[])){
        if (this.ach.unlocked[a.id]) continue;
        if (a.check(this)){
          this.ach.unlocked[a.id] = true; unlockedNow.push(a);
          if (a.reward){
            if (a.reward.type==='palette' && !this.cosmetics.unlockedPalettes.includes(a.reward.key)){
              this.cosmetics.unlockedPalettes.push(a.reward.key);
            }
            if (a.reward.type==='trail' && !this.cosmetics.unlockedTrails.includes(a.reward.key)){
              this.cosmetics.unlockedTrails.push(a.reward.key);
            }
          }
        }
      }
      if (unlockedNow.length){ this.saveCosmetics(); try{ localStorage.setItem('mm_ach', JSON.stringify(this.ach)); }catch(e){} }
      return unlockedNow;
    },
    loadOptions(){
      try {
        const raw = localStorage.getItem('mm_options');
        if (raw){
          const o = JSON.parse(raw);
          Object.assign(this.options, o);
        }
      } catch(err){}
    },
    saveOptions(){
      try { localStorage.setItem('mm_options', JSON.stringify(this.options)); } catch(err){}
    },
    fitToWindow(){
      const aspect = this.width / this.height;
      const w = window.innerWidth, h = window.innerHeight;
      let cw = w, ch = Math.floor(w / aspect);
      if (ch > h){ ch = h; cw = Math.floor(h * aspect); }
      this.canvas.style.width = cw + 'px';
      this.canvas.style.height = ch + 'px';
    },
    reset(){
      this.player = new Player(this.width / 2, this.height / 2);
      this.enemies = [];
  this.orbs = [];
  this.floaters = [];
  this.stats = { orbs: 0, perfectDashes: 0, maxMult: 1 };
  this._recapped = false;
  this.power = { thunder: 0 }; // seconds remaining
  this.powerShield = 0; // shield duration in seconds
  this.powerMagnet = 0; // magnet duration in seconds
  this.zaps = []; // short-lived lightning visuals
      this.spawnTimer = 0;
    this.spawnInterval = 2.0; // will be tuned dynamically
  this.orbSpawnTimer = 0;
  this.orbSpawnInterval = this._diff.orbSpawnInterval;
  this.maxOrbs = 12;
      this.gameOver = false;
  this.score = 0;
  this.mult = 1; this.maxMult = 5;
  this.multGrace = 0; // time before decay
  this.multDecayRate = this._diff.multDecayRate; // per second
    this.graceMax = this._diff.graceMax;
      // Difficulty ramp
      this.elapsed = 0; // seconds since start
    this.spawnIntervalBase = this._diff.spawnIntervalBase; // seconds
    this.spawnIntervalMin = this._diff.spawnIntervalMin; // seconds at max difficulty
    this.enemyBaseSpeed = this._diff.enemyBaseSpeed;
    this.enemyMaxSpeed = this._diff.enemyMaxSpeed;
    this.maxEnemiesBase = this._diff.maxEnemiesBase;
    this.maxEnemiesCap = this._diff.maxEnemiesCap;
  const initEnemies = (this._diff && typeof this._diff.initialEnemies === 'number') ? this._diff.initialEnemies : 3;
  for (let i = 0; i < initEnemies; i++) this.spawnEnemy();
  // Apply current palette to all entities
  this.applyPalette();
    },
    spawnEnemy(speedOverride){
    const edge = Math.floor(Math.random() * 4);
      let x, y;
      if (edge === 0){ x = 20; y = Math.random() * this.height; }
      if (edge === 1){ x = this.width - 20; y = Math.random() * this.height; }
      if (edge === 2){ x = Math.random() * this.width; y = 20; }
      if (edge === 3){ x = Math.random() * this.width; y = this.height - 20; }
  const s = (typeof speedOverride === 'number') ? speedOverride : this.enemyBaseSpeed;
  const e = new Enemy(x, y, s);
  // Small chance to spawn a variant as difficulty ramps
  const prog = Math.min(1, (this.elapsed||0) / ((this._diff && this._diff.rampDuration)||90));
  const roll = Math.random();
  if (roll < 0.1 * prog){ e.type = 'charger'; e.color = '#ff7a7a'; }
  else if (roll < 0.18 * prog){ e.type = 'splinter'; e.color = '#ff5555'; e.r = 9; }
  e.color = this.getPalette().enemy;
  this.enemies.push(e);
  if (window.Particles && !this.options.reducedFx) Particles.spawnBurst(x, y, { n: 10, speed: 80, life: 0.3, size: 2, color: e.color });
    },
    addFloater(x, y, text, color, life){
      this.floaters.push({ x, y, text, color: color||'#fff', life: life||0.8, max: life||0.8, vy: -40 });
    },
    spawnOrb(){
      // Try a few times to avoid spawning directly on player
      let tries = 10;
      while (tries-- > 0){
        const margin = 20;
        const x = margin + Math.random() * (this.width - margin * 2);
        const y = margin + Math.random() * (this.height - margin * 2);
        const d = Math.hypot(x - this.player.x, y - this.player.y);
        if (d > 60){
          // Power orb chances
          let thunderChance = 0.12; // base 12% (higher as requested)
          const shieldChance = 0.07; // ~7%
          const magnetChance = 0.09; // ~9%
          if (this.dailyMode && this.dailyMods && this.dailyMods.thunderstorm) thunderChance *= 3.0; // Thunderstorm Day boost
          const roll = Math.random();
          let type = 'normal';
          if (roll < thunderChance) type = 'thunder';
          else if (roll < thunderChance + shieldChance) type = 'shield';
          else if (roll < thunderChance + shieldChance + magnetChance) type = 'magnet';
          const o = new Orb(x, y, type);
          if (type === 'thunder'){ o.color = '#6bd0ff'; o.r = 7; }
          else if (type === 'shield'){ o.color = '#7fff8a'; o.r = 7; }
          else if (type === 'magnet'){ o.color = '#c77dff'; o.r = 7; }
          else { o.color = this.getPalette().orb; }
          this.orbs.push(o); return;
        }
      }
      // Fallback
      const o = new Orb(Math.random() * this.width, Math.random() * this.height); o.color = this.getPalette().orb; this.orbs.push(o);
    },
    update(dt){
      // Global overlays
      if (Input.consumePressed('escape')){
        if (this.state === 'playing') this.paused = !this.paused;
      }
      if (Input.consumePressed('o')){
        this.optionsOpen = !this.optionsOpen;
      }
      if (this.state === 'menu' && Input.consumePressed('a')){ this.achOpen = !this.achOpen; }
      if (this.optionsOpen){
        if (Input.consumePressed('h')){ this.options.screenShake = !this.options.screenShake; this.saveOptions(); }
        if (Input.consumePressed('f')){ this.options.reducedFx = !this.options.reducedFx; this.saveOptions(); }
  if (Input.consumePressed('c')){ this.options.colorblind = !this.options.colorblind; this.saveOptions(); this.applyPalette(); }
        if (Input.consumePressed('b')){ this.options.highContrast = !this.options.highContrast; this.saveOptions(); }
  if (Input.consumePressed('m')){ this.options.sound = !this.options.sound; if (window.Sfx) Sfx.setEnabled(this.options.sound); this.saveOptions(); }
        // Palette cycling when not in colorblind mode
        if (!this.options.colorblind && (Input.consumePressed('[') || Input.consumePressed(']'))){
          const u = this.cosmetics.unlockedPalettes || ['base'];
          if (u.length>0){
            let idx = Math.max(0, u.indexOf(this.cosmetics.selectedPalette));
            idx = Input.consumePressed(']') ? (idx+1)%u.length : (idx-1+u.length)%u.length;
            this.cosmetics.selectedPalette = u[idx]; this.saveCosmetics(); this.applyPalette();
          }
        }
        if (Input.consumePressed('+') || Input.consumePressed('=')) { this.options.uiScale = Math.min(1.6, (this.options.uiScale||1) + 0.1); this.saveOptions(); }
        if (Input.consumePressed('-') || Input.consumePressed('_')) { this.options.uiScale = Math.max(0.8, (this.options.uiScale||1) - 0.1); this.saveOptions(); }
      }
      if (this.state === 'menu'){
        // simple selection: left/right or A/D changes, Space confirms
        if (Input.consumePressed('a') || Input.consumePressed('arrowleft')) this.diffIndex = (this.diffIndex + this.diffNames.length - 1) % this.diffNames.length;
        if (Input.consumePressed('d') || Input.consumePressed('arrowright')) this.diffIndex = (this.diffIndex + 1) % this.diffNames.length;
        // Toggle Daily Mode
        if (Input.consumePressed('y')){ this.dailyMode ? this.disableDaily() : this.enableDaily(); }
        if (Input.consumePressed('space') || Input.consumePressed('enter')){
          const name = this.diffNames[this.diffIndex];
          this._diff = this.difficulties[name];
          if (this.dailyMode){ this.setSeedFromString(this.dailyDate + '-minute-mage'); }
          this.reset();
          this.state = 'playing';
        }
        return;
      }
      if (this.paused || this.drafting){ return; }
      if (this.gameOver){
  if (Input.consumePressed('r')) this.reset();
  if (Input.consumePressed('backspace')){ this.state = 'menu'; }
        return;
      }
  // Difficulty progression over real time
  this.elapsed += dt;
  const ramp = (this._diff && this._diff.rampDuration) ? this._diff.rampDuration : 90;
  const prog = Math.min(1, this.elapsed / ramp); // reach max according to difficulty
  // Tune spawn interval and enemy speed
  this.spawnInterval = Utils.lerp(this.spawnIntervalBase, this.spawnIntervalMin, prog);
  const enemySpeedNow = Utils.lerp(this.enemyBaseSpeed, this.enemyMaxSpeed, prog);
  const maxEnemiesNow = Math.round(Utils.lerp(this.maxEnemiesBase, this.maxEnemiesCap, prog));
      // Time slow during dash
      this.targetTimeScale = this.player.isDashing() ? 0.25 : 1;
      // Ease timeScale toward target for smooth feel
      this.timeScale += (this.targetTimeScale - this.timeScale) * Math.min(1, dt * 10);
      const sdt = dt * this.timeScale;

      this.player.update(sdt, this);
      for (const e of this.enemies) {
        e.update(sdt, this);
        // Decrease near-miss timer
        if (e.nearMissTimer > 0) e.nearMissTimer -= dt;
      }
      this.spawnTimer += dt;
    if (this.spawnTimer > this.spawnInterval){
        this.spawnTimer = 0;
        // Spawn more as difficulty rises (1 to 3), but clamp to maxEnemies
        const burst = 1 + (this.elapsed > 60 ? 2 : (this.elapsed > 30 ? 1 : 0));
        const toSpawn = Math.min(burst, Math.max(0, maxEnemiesNow - this.enemies.length));
        for (let i = 0; i < toSpawn; i++){
      const jitter = (this.rand() * 2 - 1) * 20; // small speed variance (seeded in daily)
          this.spawnEnemy(Math.max(60, enemySpeedNow + jitter));
        }
      }
      // Orbs spawn on real time
      this.orbSpawnTimer += dt;
      if (this.orbSpawnTimer > this.orbSpawnInterval && this.orbs.length < this.maxOrbs){
        this.orbSpawnTimer = 0;
        this.spawnOrb();
      }
      // Orb magnetism: gentle attraction within radius
  // Base magnetism (coins to player). Buffed while powerMagnet active.
  const magnetMult = (this.powerMagnet>0 ? 2.2 : 1.0) * (this._magnetMult||1);
  const magnetR = 110 * magnetMult;
  const magnetAccel = 420 * magnetMult; // pixels/s^2 toward player
      for (const o of this.orbs){
        const dx = this.player.x - o.x;
        const dy = this.player.y - o.y;
        const d = Math.hypot(dx, dy);
        if (d > 0 && d < magnetR){
          const n = { x: dx / d, y: dy / d };
          // approach speed increases as it gets closer; scale by (1 - d/R)
          const strength = (1 - d / magnetR);
          const vx = (o.vx||0) + n.x * magnetAccel * strength * dt;
          const vy = (o.vy||0) + n.y * magnetAccel * strength * dt;
          // clamp max drift so it doesn't look like teleporting
          const maxV = 280;
          const sp = Math.hypot(vx, vy);
          const k = sp > maxV ? (maxV / sp) : 1;
          o.vx = vx * k; o.vy = vy * k;
          o.x += o.vx * dt; o.y += o.vy * dt;
        } else {
          // gentle friction when outside
          o.vx = (o.vx||0) * 0.95; o.vy = (o.vy||0) * 0.95;
        }
      }
      // Collect orbs
    for (let i = this.orbs.length - 1; i >= 0; i--){
        const o = this.orbs[i];
        const d = Math.hypot(o.x - this.player.x, o.y - this.player.y);
        if (d < o.r + this.player.r){
      this.orbs.splice(i, 1);
  this.stats.orbs++;
      const base = 10;
      const gain = Math.round(base * this.mult);
      this.score += gain;
          this.multGrace = Math.max(this.multGrace, 2.0);
          if (this.shake) this.shake(2, 0.05);
    if (this.addFloater) this.addFloater(o.x, o.y, '+' + gain, '#ffd66b', 0.8);
    if (window.Particles && !this.options.reducedFx) Particles.spawnBurst(o.x, o.y, { n: 14, speed: 150, life: 0.35, size: 2, color: (o.type==='thunder'?'#6bd0ff':this.getPalette().orb) });
  if (window.Sfx && this.options.sound) {
    if (o.type==='thunder') Sfx.play('dash');
    else if (o.type==='shield') Sfx.play('shield');
    else if (o.type==='magnet') Sfx.play('magnet');
    else Sfx.play('orb');
  }
          // Thunder power-up
          if (o.type === 'thunder'){
            this.power.thunder = Math.max(this.power.thunder, 1.5); // seconds
            // immediate zap effect: screen flash + burst
            this.perfectFlashTimer = Math.max(this.perfectFlashTimer, 0.18);
          }
          // Shield power-up
          if (o.type === 'shield'){
            this.powerShield = Math.max(this.powerShield, 1.2); // ~1.2s to give slight buffer
          }
          // Magnet power-up
          if (o.type === 'magnet'){
            this.powerMagnet = Math.max(this.powerMagnet, 3.0); // 3s strong magnet
          }
        }
      }
      // Decay multiplier if grace expired
      if (this.mult > 1){
        if (this.multGrace > 0){ this.multGrace -= dt; }
        else { this.mult = Math.max(1, this.mult - this.multDecayRate * dt); }
      }
      // Track max multiplier
      if (this.mult > this.stats.maxMult) this.stats.maxMult = this.mult;
      // Thunder power effect: zaps nearest enemies periodically
  if (this.power.thunder > 0){
        this.power.thunder -= dt;
        // Kill touch: enemy within a radius gets destroyed
        const zapR = 150; // slightly increased radius
        for (let i=this.enemies.length-1;i>=0;i--){
          const e = this.enemies[i];
          const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
          if (d < zapR){
            // Splinter on death: spawn small fragments once
            if (e.type === 'splinter'){
              const n = 2;
              for (let k=0;k<n;k++){
                const a = Math.random()*Math.PI*2; const s = this.enemyBaseSpeed*0.8;
                const c = new Enemy(e.x + Math.cos(a)*6, e.y + Math.sin(a)*6, s);
                c.r = 6; c.color = this.getPalette().enemy; c.type = 'normal';
                this.enemies.push(c);
              }
            }
            this.enemies.splice(i,1);
            if (window.Particles && !this.options.reducedFx) Particles.spawnBurst(e.x, e.y, { n: 18, speed: 200, life: 0.25, size: 2, color: '#6bd0ff' });
            // Lightning bolt visual from player to enemy
            this.zaps.push({ x1:this.player.x, y1:this.player.y, x2:e.x, y2:e.y, life:0.08, max:0.08 });
            // Tiny score bonus to reward aggression
            this.score += 2;
            if (window.Sfx && this.options.sound) Sfx.play('thunder');
          }
        }
      }
  // Decay temporary powers
  if (this.powerShield > 0) this.powerShield -= dt;
  if (this.powerMagnet > 0) this.powerMagnet -= dt;
      for (const e of this.enemies){
        const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
        const sumR = e.r + this.player.r;
        if (d < sumR){
          // If shield is active, knock enemies away instead of dying
          if (this.powerShield > 0){
            const nx = (this.player.x - e.x) / Math.max(1e-3, d);
            const ny = (this.player.y - e.y) / Math.max(1e-3, d);
            const kb = 320; // knockback speed
            e.x -= nx * 12; e.y -= ny * 12; // small separation
            e._t = 0; // reset behavior timer for charger wind-up
            // fling opposite direction
            e.x += -nx * kb * dt * 4;
            e.y += -ny * kb * dt * 4;
            if (window.Particles && !this.options.reducedFx) Particles.spawnBurst(this.player.x, this.player.y, { n: 12, speed: 200, life: 0.2, size: 2, color: '#7fff8a' });
            continue;
          }
          this.gameOver = true;
          this.hitFlashTimer = 0.3; // 300ms red vignette
          if (window.Sfx && this.options.sound) Sfx.play('over');
          if (!this._recapped){
            // Update bests once
            if (!this.best) this.best = { score: 0, time: 0, maxMult: 1 };
            if (this.score > (this.best.score||0)) this.best.score = this.score;
            if (this.elapsed > (this.best.time||0)) this.best.time = this.elapsed;
            if ((this.stats.maxMult||1) > (this.best.maxMult||1)) this.best.maxMult = this.stats.maxMult;
            this.saveBest();
            // lifetime stats
            this.statsLife.totalRuns += 1;
            this.statsLife.totalOrbs += (this.stats.orbs||0);
            this.statsLife.totalPerfects += (this.stats.perfectDashes||0);
            if (this.elapsed > this.statsLife.longest) this.statsLife.longest = this.elapsed;
            try{ localStorage.setItem('mm_stats', JSON.stringify(this.statsLife)); }catch(e){}
            // Daily leaderboard (local)
            if (this.dailyMode){
              const date = this.dailyDate; if (!Array.isArray(this.dailyScores)) this.dailyScores = [];
              this.dailyScores.push({ score: this.score, time: Math.floor(this.elapsed) });
              this.dailyScores.sort((a,b)=> b.score - a.score || b.time - a.time);
              this.dailyScores = this.dailyScores.slice(0,10);
              this.saveDailyScores(date);
            }
            // Achievements
            this._unlocks = this.tryUnlockAchievements();
            this._recapped = true;
          }
          break;
        } else {
          const gap = d - sumR;
          if (gap > 0 && gap < 26){
            e.nearMissTimer = 0.12; // brief arc on near miss
          }
        }
      }

      // Update camera shake
  if (this.shakeTime > 0){
        this.shakeTime -= dt;
        this.shakeT += dt;
        if (this.shakeTime <= 0){ this.shakeMag = 0; this.shakeT = 0; }
      }
  // Timers for flashes
  if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;
  if (this.perfectFlashTimer > 0) this.perfectFlashTimer -= dt;
      // Update lightning zap lifetimes (was incorrectly decremented in render)
      for (let i = this.zaps.length - 1; i >= 0; i--) {
        const z = this.zaps[i];
        z.life -= dt;
        if (z.life <= 0) { this.zaps.splice(i, 1); }
      }
      // Update floating texts
      for (let i = this.floaters.length - 1; i >= 0; i--){
        const f = this.floaters[i];
        f.life -= dt;
        if (f.life <= 0){ this.floaters.splice(i, 1); continue; }
        f.y += f.vy * dt;
      }
      // Relic draft timing gates
      if (this.relicDraftIndex < (this.relicDraftTimes?this.relicDraftTimes.length:0) && this.elapsed >= this.relicDraftTimes[this.relicDraftIndex]){
        this.openRelicDraft();
      }
    },
    openRelicDraft(){
      const pool = this.getRelicPool().filter(r => !this.relicsActive.includes(r.id));
      const n = Math.min(3, pool.length);
      const picks = [];
      for (let i=0;i<n;i++){
        const idx = Math.floor(this.rand() * pool.length);
        picks.push(pool.splice(idx,1)[0]);
      }
      this.draftChoices = picks;
      this.drafting = true;
    },
    takeRelic(i){
      const r = this.draftChoices[i]; if (!r) return;
      try { r.apply(this); this.relicsActive.push(r.id); } catch(e){}
      this.drafting = false; this.draftChoices = []; this.relicDraftIndex++;
    },
    getRelicPool(){
      return [
        { id:'grace_plus', name:'+Grace', desc:'+1.0 grace time cap', apply:(g)=>{ g.graceMax += 1.0; } },
        { id:'decay_down', name:'Decay –20%', desc:'Slower multiplier decay', apply:(g)=>{ g.multDecayRate *= 0.8; } },
        { id:'magnet_up', name:'Magnet +50%', desc:'Wider orb magnet radius', apply:(g)=>{ g._magnetMult = (g._magnetMult||1)*1.5; } },
        { id:'dash_cool', name:'Dash –20% CD', desc:'Faster dash recharge', apply:(g)=>{ if (g.player) g.player.dashCooldown *= 0.8; } },
        { id:'dash_speed', name:'Dash +15% Spd', desc:'Faster dash speed', apply:(g)=>{ if (g.player) g.player.dashSpeed *= 1.15; } },
        { id:'orbs_more', name:'More Orbs', desc:'Orbs spawn 20% faster', apply:(g)=>{ g.orbSpawnInterval *= 0.8; } },
      ];
    },
  render(){
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#0b0c11';
      ctx.fillRect(0, 0, this.width, this.height);
      if (this.state === 'menu'){
        // Title and difficulty selection
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 48px system-ui, sans-serif';
        const title = 'Minute Mage';
        ctx.fillText(title, 40, 120);
        ctx.font = '20px system-ui, sans-serif';
        ctx.fillStyle = '#9cf';
        ctx.fillText('Choose Difficulty (A/D or ←/→, Space to start)', 40, 160);
        ctx.fillStyle = '#7fd'; ctx.font = '16px system-ui, sans-serif';
        ctx.fillText('Mode: ' + (this.dailyMode ? ('Daily '+this.dailyDate+' — press Y to switch') : 'Normal — press Y for Daily'), 40, 186);
        // Daily modifier banner
        if (this.dailyMode && this.dailyMods && this.dailyMods.thunderstorm){
          ctx.fillStyle = '#ffd66b'; ctx.font = '14px system-ui, sans-serif';
          ctx.fillText('Thunderstorm Day — Thunder Orbs appear more often today', 40, 206);
        }
        ctx.fillStyle = '#9ab'; ctx.fillText('Achievements (A) · Options (O)', 40, this.dailyMode && this.dailyMods && this.dailyMods.thunderstorm ? 226 : 206);

        const y = 230;
        for (let i = 0; i < this.diffNames.length; i++){
          const name = this.diffNames[i];
          const isSel = (i === this.diffIndex);
          const x = 40 + i * 220;
          const w = 200, h = 80, r = 12;
          ctx.fillStyle = isSel ? '#142033' : '#0f1724';
          ctx.strokeStyle = isSel ? '#88a9ff' : '#30405a';
          ctx.lineWidth = isSel ? 3 : 2;
          roundRectPath(ctx, x, y, w, h, r); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 22px system-ui, sans-serif';
          ctx.fillText(name, x + 16, y + 32);
          ctx.font = '12px system-ui, sans-serif';
          const desc = {
            'Chill': 'Slower ramp, gentle decay',
            'Classic': 'Balanced ramp and decay',
            'Frenzy': 'Fast ramp, tougher enemies'
          }[name] || '';
          ctx.fillStyle = '#9ab';
          ctx.fillText(desc, x + 16, y + 54);
        }
        // Daily leaderboard (right)
        if (this.dailyMode){
          const bx = 720, by = 200, bw = 200, r = 10;
          ctx.fillStyle = '#0f1724'; ctx.strokeStyle = '#30405a'; ctx.lineWidth = 2;
          roundRectPath(ctx, bx, by, bw, 260, r); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#fff'; ctx.font = 'bold 18px system-ui, sans-serif'; ctx.fillText('Daily Top 10', bx + 12, by + 26);
          ctx.font = '14px system-ui, sans-serif'; ctx.fillStyle = '#cfe';
          const arr = this.dailyScores || [];
          for (let i=0;i<Math.min(10, arr.length); i++){
            const s = arr[i];
            ctx.fillText(`${i+1}. ${s.score} pts  ${s.time||0}s`, bx + 12, by + 52 + i*20);
          }
          if (!arr.length){ ctx.fillStyle = '#9ab'; ctx.fillText('Be the first today!', bx + 12, by + 52); }
        }
        // Achievements overlay
        if (this.achOpen){
          ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0,0,this.width,this.height);
          const bx = 60, by = 80, bw = 520, bh = 320, r = 12;
          ctx.fillStyle = '#0f1724'; ctx.strokeStyle = '#30405a'; ctx.lineWidth = 2;
          roundRectPath(ctx, bx, by, bw, bh, r); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#fff'; ctx.font = 'bold 20px system-ui, sans-serif'; ctx.fillText('Achievements (A to close)', bx + 14, by + 30);
          ctx.font = '14px system-ui, sans-serif'; ctx.fillStyle = '#cfe';
          const list = this.achList || [];
          for (let i=0;i<list.length;i++){
            const a = list[i]; const ok = !!(this.ach && this.ach.unlocked && this.ach.unlocked[a.id]);
            ctx.fillStyle = ok ? '#7fff8a' : '#cfe';
            ctx.fillText((ok?'[✓] ':'[ ] ') + a.name + ' — ' + a.desc + (a.reward?`  Reward: ${a.reward.type==='palette'?'Palette '+a.reward.key:'Trail '+a.reward.key}`:''), bx + 14, by + 58 + i*20);
          }
        }
        return;
      }
      ctx.strokeStyle = '#121622'; ctx.lineWidth = 1;
      for (let x = 0; x < this.width; x += 40){ ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.height); ctx.stroke(); }
      for (let y = 0; y < this.height; y += 40){ ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.width, y); ctx.stroke(); }
  // Apply UI scale and screenshake
  ctx.save();
  const scale = this.options.uiScale || 1;
  if (scale !== 1) ctx.scale(scale, scale);
      let ox = 0, oy = 0;
  if (this.options.screenShake && this.shakeMag > 0){
        const m = this.shakeMag * (this.shakeTime > 0 ? (0.8 + 0.2 * Math.random()) : 0);
        ox = (Math.random() * 2 - 1) * m;
        oy = (Math.random() * 2 - 1) * m;
        ctx.translate(ox, oy);
      }

  // Particles behind entities
  if (window.Particles && !this.options.reducedFx) Particles.updateAndRender(ctx, this.timeScale * 1/60);
  // Render orbs
      for (const o of this.orbs) o.render(ctx);
      // High-contrast outlines
      const hc = this.options.highContrast;
      this.player.render(ctx);
      for (const e of this.enemies){
        // Enemy speed telegraph glow
  const speed01 = Utils.clamp((e.speed - this.enemyBaseSpeed) / Math.max(1,(this.enemyMaxSpeed - this.enemyBaseSpeed)), 0, 1);
        const glow = 6 + 10 * speed01;
        ctx.save();
        ctx.shadowColor = e.color;
        ctx.shadowBlur = glow;
        e.render(ctx);
        ctx.restore();
        if (hc){
          ctx.strokeStyle = 'rgba(255,255,255,0.25)';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 2, 0, Math.PI*2); ctx.stroke();
        }
        // Near-miss arc around player pointing toward enemy
        if (e.nearMissTimer > 0){
          const ax = this.player.x, ay = this.player.y;
          const dx = e.x - ax, dy = e.y - ay;
          const ang = Math.atan2(dy, dx);
          const alpha = Math.max(0, Math.min(1, e.nearMissTimer / 0.12));
          ctx.save();
          ctx.strokeStyle = `rgba(255,255,255,${(0.4*alpha).toFixed(3)})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          const r = this.player.r + 10;
          ctx.arc(ax, ay, r, ang - 0.6, ang + 0.6);
          ctx.stroke();
          ctx.restore();
        }
      }
      // Floating texts (world space)
      for (const f of this.floaters){
        const a = Math.max(0, f.life / f.max);
        ctx.globalAlpha = a;
        ctx.fillStyle = f.color;
        ctx.font = 'bold 16px system-ui, sans-serif';
        ctx.fillText(f.text, f.x + 6, f.y - 6);
        ctx.globalAlpha = 1;
      }
  ctx.restore();
      ctx.fillStyle = '#fff';
      ctx.font = '16px system-ui, sans-serif';
      const msg = this.gameOver ? 'Game Over — press R to restart' : 'Grab Orbs. Dash to build Mult.';
      ctx.fillText(msg, 12, 24);
      // HUD: Score & Multiplier pill bar
      ctx.fillStyle = '#7fd';
      ctx.fillText('Score: ' + this.score, 12, 44);
      const barX = 12, barY = 54, barW = 220, barH = 16, radius = 8;
      const mult01 = (this.maxMult>1) ? (this.mult - 1) / (this.maxMult - 1) : 0;
      const tier = Math.max(1, Math.min(this.maxMult, Math.floor(this.mult + 0.001)));
      const col = multTierColor(tier);
      ctx.fillStyle = '#1a2230';
      roundRectPath(ctx, barX, barY, barW, barH, radius); ctx.fill();
      const fillW = Math.max(0, Math.min(barW, barW * mult01));
      ctx.fillStyle = col;
      roundRectPath(ctx, barX, barY, fillW, barH, radius); ctx.fill();
      if (this.multGrace > 0){
        const gpct = Utils.clamp(this.multGrace / this.graceMax, 0, 1);
        const gh = 3;
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        roundRectPath(ctx, barX, barY - gh - 2, barW * gpct, gh, gh/2); ctx.fill();
      }
      ctx.fillStyle = '#0b0c11';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText('x' + this.mult.toFixed(2), barX + 8, barY + 12);
      // Optional: timeScale debug small
      ctx.fillStyle = '#678';
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillText('Time x' + this.timeScale.toFixed(2), 12, 82);

      // Overlays: perfect dash teal flash and hit red vignette
  if (!this.options.reducedFx && this.perfectFlashTimer > 0){
        const a = Math.min(0.35, this.perfectFlashTimer / 0.2 * 0.35);
        const grd = ctx.createRadialGradient(this.player.x, this.player.y, 0, this.player.x, this.player.y, 220);
        grd.addColorStop(0, `rgba(120,255,230,${a.toFixed(3)})`);
        grd.addColorStop(1, 'rgba(120,255,230,0)');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, this.width, this.height);
      }
      // Lightning bolts render (lifetimes handled in update())
      for (let i=this.zaps.length-1;i>=0;i--){
        const z = this.zaps[i];
        const a = Math.max(0, z.life / z.max);
        // jagged bolt with 3 segments
        const mid1x = z.x1 + (z.x2 - z.x1)*0.33 + (Math.random()*20-10);
        const mid1y = z.y1 + (z.y2 - z.y1)*0.33 + (Math.random()*20-10);
        const mid2x = z.x1 + (z.x2 - z.x1)*0.66 + (Math.random()*20-10);
        const mid2y = z.y1 + (z.y2 - z.y1)*0.66 + (Math.random()*20-10);
        const lw = 2 + 2*a;
        this.ctx.save();
        this.ctx.strokeStyle = `rgba(107,208,255,${(0.5+0.5*a).toFixed(3)})`;
        this.ctx.lineWidth = lw;
        this.ctx.beginPath();
        this.ctx.moveTo(z.x1, z.y1);
        this.ctx.lineTo(mid1x, mid1y);
        this.ctx.lineTo(mid2x, mid2y);
        this.ctx.lineTo(z.x2, z.y2);
        this.ctx.stroke();
        this.ctx.restore();
      }
      if (!this.options.reducedFx && this.hitFlashTimer > 0){
        const a = Math.min(0.5, this.hitFlashTimer / 0.3 * 0.5);
        const grd = ctx.createRadialGradient(this.player.x, this.player.y, 60, this.player.x, this.player.y, Math.max(this.width, this.height));
        grd.addColorStop(0, 'rgba(255,0,0,0)');
        grd.addColorStop(1, `rgba(255,0,0,${a.toFixed(3)})`);
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, this.width, this.height);
      }
      // Thunder aura visualization around player
      if (!this.options.reducedFx && this.power.thunder > 0){
        const p = Math.min(1, this.power.thunder / 1.5);
        ctx.save();
        ctx.strokeStyle = `rgba(107,208,255,${(0.35+0.35*p).toFixed(3)})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(this.player.x, this.player.y, 130, 0, Math.PI*2); ctx.stroke();
        ctx.restore();
      }
      // Shield ring visualization
      if (!this.options.reducedFx && this.powerShield > 0){
        const p = Math.min(1, this.powerShield / 1.2);
        ctx.save();
        ctx.strokeStyle = `rgba(127,255,138,${(0.4+0.3*p).toFixed(3)})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(this.player.x, this.player.y, this.player.r + 10, 0, Math.PI*2); ctx.stroke();
        ctx.restore();
      }
    // Options overlay
      if (this.optionsOpen){
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, this.width, this.height);
        const bx = 60, by = 80, bw = 360, bh = 240, r = 10;
        ctx.fillStyle = '#0f1724'; ctx.strokeStyle = '#30405a'; ctx.lineWidth = 2;
        roundRectPath(ctx, bx, by, bw, bh, r); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 20px system-ui, sans-serif'; ctx.fillText('Options (O)', bx + 12, by + 28);
        ctx.font = '14px system-ui, sans-serif'; ctx.fillStyle = '#cfe';
        const opts = [
          'Shake: ' + (this.options.screenShake ? 'ON' : 'OFF') + ' (toggle: H)',
          'Reduced FX: ' + (this.options.reducedFx ? 'ON' : 'OFF') + ' (toggle: F)',
          'Colorblind Palette: ' + (this.options.colorblind ? 'ON' : 'OFF') + ' (toggle: C)',
          'High Contrast Outlines: ' + (this.options.highContrast ? 'ON' : 'OFF') + ' (toggle: B)',
      'UI Scale: ' + (this.options.uiScale || 1).toFixed(1) + ' ( +/- )',
      'Sound: ' + (this.options.sound ? 'ON' : 'OFF') + ' (toggle: M)'
        ];
        if (!this.options.colorblind){
          const u = this.cosmetics.unlockedPalettes||['base'];
          const name = this.cosmetics.selectedPalette || 'base';
          opts.push('Palette: ' + name + (u.length>1?' ( [ / ] )':''));
        }
        for (let i=0;i<opts.length;i++) ctx.fillText(opts[i], bx + 12, by + 56 + i*24);
      }
      // Pause overlay
      if (this.paused && this.state === 'playing'){
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0,0,this.width,this.height);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 32px system-ui, sans-serif';
        ctx.fillText('Paused (Esc)', 40, 120);
      }
      // Game over recap overlay
      if (this.gameOver && this.state === 'playing'){
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0,0,this.width,this.height);
        const bx = 60, by = 100, bw = 360, bh = 200, r = 12;
        ctx.fillStyle = '#0f1724'; ctx.strokeStyle = '#30405a'; ctx.lineWidth = 2;
        roundRectPath(ctx, bx, by, bw, bh, r); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 22px system-ui, sans-serif';
        ctx.fillText('Run Recap', bx + 14, by + 34);
        ctx.font = '14px system-ui, sans-serif'; ctx.fillStyle = '#cfe';
        const timeS = Math.floor(this.elapsed);
        const rows = [
          `Score: ${this.score}`,
          `Time: ${timeS}s`,
          `Max Mult: x${(this.stats && this.stats.maxMult ? this.stats.maxMult : 1).toFixed ? this.stats.maxMult.toFixed(2) : this.stats.maxMult}`,
          `Orbs: ${(this.stats && this.stats.orbs) || 0}`,
          `Perfect Dashes: ${(this.stats && this.stats.perfectDashes) || 0}`,
        ];
        for (let i=0;i<rows.length;i++) ctx.fillText(rows[i], bx + 14, by + 62 + i*22);
        // Bests
        const best = this.best || { score:0,time:0,maxMult:1 };
        ctx.fillStyle = '#9ab';
        ctx.fillText(`Best — Score ${best.score} | Time ${Math.floor(best.time)}s | Max x${(best.maxMult||1).toFixed ? best.maxMult.toFixed(2) : best.maxMult}`, bx + 14, by + bh - 36);
        ctx.fillStyle = '#7fd';
        ctx.fillText('R: Retry   Backspace: Menu', bx + 14, by + bh - 14);
        // Unlock notices
        if (this._unlocks && this._unlocks.length){
          ctx.fillStyle = '#7fff8a'; ctx.font = 'bold 16px system-ui, sans-serif';
          ctx.fillText('Unlocked:', bx + 360 + 20, by + 24);
          ctx.font = '14px system-ui, sans-serif'; ctx.fillStyle = '#cfe';
          for (let i=0;i<this._unlocks.length;i++){
            const u = this._unlocks[i];
            ctx.fillText(`• ${u.name}` + (u.reward?` — ${u.reward.type==='palette'?'Palette '+u.reward.key:'Trail '+u.reward.key}`:''), bx + 360 + 20, by + 44 + i*20);
          }
        }
        // Daily rank
        if (this.dailyMode){
          const arr = this.dailyScores||[];
          const rank = arr.findIndex(s=> s.score===this.score && Math.floor(s.time)===Math.floor(this.elapsed)) + 1;
          if (rank>0){ ctx.fillStyle = '#ffd66b'; ctx.fillText(`Daily Rank: #${rank}/${arr.length}`, bx + 14, by + 20); }
        }
      }
      // Relic draft overlay
      if (this.drafting){
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0,0,this.width,this.height);
        const title = 'Choose a Relic (1/2/3)';
        ctx.fillStyle = '#fff'; ctx.font = 'bold 22px system-ui, sans-serif'; ctx.fillText(title, 60, 90);
        for (let i=0;i<this.draftChoices.length;i++){
          const c = this.draftChoices[i]; const x = 60 + i*220, y = 120, w=200, h=120, r=10;
          ctx.fillStyle = '#0f1724'; ctx.strokeStyle = '#30405a'; ctx.lineWidth = 2;
          roundRectPath(ctx, x, y, w, h, r); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#88a9ff'; ctx.font='bold 18px system-ui, sans-serif'; ctx.fillText(`(${i+1}) ${c.name}`, x+12, y+32);
          ctx.fillStyle = '#cfe'; ctx.font='14px system-ui, sans-serif'; ctx.fillText(c.desc, x+12, y+56);
        }
        if (Input.consumePressed('1') && this.draftChoices[0]){ this.takeRelic(0); }
        if (Input.consumePressed('2') && this.draftChoices[1]){ this.takeRelic(1); }
        if (Input.consumePressed('3') && this.draftChoices[2]){ this.takeRelic(2); }
      }
  },
    onDash(){
      this.mult = Math.min(this.maxMult, this.mult + 0.5);
      this.multGrace = Math.max(this.multGrace, 2.5);
  if (window.Particles && !this.options.reducedFx) Particles.spawnBurst(this.player.x, this.player.y, { n: 16, speed: 220, life: 0.25, size: 2, color: this.getPalette().player });
  if (window.Sfx && this.options.sound) Sfx.play('dash');
      // Perfect dash flash if near imminent collision (within ~30px of impact)
      const pr = this.player.r;
      for (const e of this.enemies){
        const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
        const sumR = pr + e.r;
        if (d - sumR < 30){
          this.perfectFlashTimer = 0.2;
          if (this.shake) this.shake(8, 0.12);
          if (this.addFloater) this.addFloater(this.player.x, this.player.y - 20, 'PERFECT!', '#7fffe6', 0.6);
          if (this.stats) this.stats.perfectDashes = (this.stats.perfectDashes||0) + 1;
          break;
        }
      }
    },
  shake(mag, time){ this.shakeMag = Math.max(this.shakeMag, mag); this.shakeTime = Math.max(this.shakeTime, time); },
  };

  window.Game = Game;
})();
