(function(){
  function Player(x, y){
    this.x = x; this.y = y;
    this.r = 10;
    this.color = '#6cf';
  this.spriteScale = 1.4; // upscale pixel sprite for readability
    this.speed = 240; // px/s
    // Dash
    this.dashSpeed = 900; // px/s during dash
    this.dashDuration = 0.12; // seconds
    this.dashCooldown = 0.9; // seconds
    this._dashTimer = 0;
    this._cooldownTimer = 0;
    this._dashDir = { x: 1, y: 0 };
    this._lastMoveDir = { x: 1, y: 0 };
  this._trail = [];
  this._trailMax = 6;
  }
  Player.prototype.update = function(dt, game){
    let dx = 0, dy = 0;
    if (Input.isDown('w') || Input.isDown('arrowup')) dy -= 1;
    if (Input.isDown('s') || Input.isDown('arrowdown')) dy += 1;
    if (Input.isDown('a') || Input.isDown('arrowleft')) dx -= 1;
    if (Input.isDown('d') || Input.isDown('arrowright')) dx += 1;
    let move = { x: 0, y: 0 };
    if (dx || dy){
      const n = Utils.norm(dx, dy);
      move = n;
      this._lastMoveDir = n;
    }

    // Dash start
    if (Input.consumePressed('space') && this._cooldownTimer <= 0){
      // Use last move dir if no current input
      const dir = (dx || dy) ? move : this._lastMoveDir;
      this._dashDir = dir;
      this._dashTimer = this.dashDuration;
      this._cooldownTimer = this.dashCooldown;
      if (game && game.shake) game.shake(6, this.dashDuration);
      if (game && typeof game.onDash === 'function') game.onDash();
    }

    // Update timers
    if (this._dashTimer > 0) this._dashTimer -= dt;
    if (this._cooldownTimer > 0) this._cooldownTimer -= dt;

    // Movement: dash overrides normal speed
    if (this._dashTimer > 0){
      this.x += this._dashDir.x * this.dashSpeed * dt;
      this.y += this._dashDir.y * this.dashSpeed * dt;
      // record trail points
      this._trail.push({ x: this.x, y: this.y, a: 1 });
      if (this._trail.length > this._trailMax) this._trail.shift();
    } else if (move.x || move.y){
      this.x += move.x * this.speed * dt;
      this.y += move.y * this.speed * dt;
    }
    this.x = Utils.clamp(this.x, this.r, game.width - this.r);
    this.y = Utils.clamp(this.y, this.r, game.height - this.r);
  };
  Player.prototype.render = function(ctx){
    // Trail
    if (this._trail.length){
      for (let i = 0; i < this._trail.length; i++){
        const t = this._trail[i];
        const a = (i + 1) / (this._trail.length + 1) * 0.4; // fade
        ctx.fillStyle = `rgba(108,207,255,${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(t.x, t.y, this.r * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Sprite render: prefer DroneFactory, fallback to old SpriteFactory, then circle
    const t = (typeof performance!=='undefined' && performance.now ? performance.now() : Date.now())/1000;
    let drew = false;
    if (window.DroneFactory){
      const spr = DroneFactory.get('player', this.color, t);
      if (spr && spr.canvas){
        const s = spr.size * 1.0; // already sized
        const half = s/2; ctx.imageSmoothingEnabled = false;
        ctx.drawImage(spr.canvas, this.x - half, this.y - half, s, s); drew = true;
        // adjust collision radius to match drone visuals once
        this.r = spr.radius; 
      }
    }
    if (!drew && window.SpriteFactory){
      const spr = SpriteFactory.get('player_core', this.color, t);
      if (spr && spr.canvas){ const s = spr.size * this.spriteScale; const half = s/2; ctx.imageSmoothingEnabled=false; ctx.drawImage(spr.canvas, this.x-half, this.y-half, s, s); drew = true; }
    }
    if (!drew){ ctx.fillStyle=this.color; ctx.beginPath(); ctx.arc(this.x,this.y,this.r,0,Math.PI*2); ctx.fill(); }

    // Dash cooldown ring UI
    const ready = this._cooldownTimer <= 0;
    const pct = ready ? 1 : 1 - (this._cooldownTimer / this.dashCooldown);
    ctx.save();
  ctx.strokeStyle = ready ? '#7fff8a' : '#88a9ff';
  ctx.lineWidth = 1.5;
    ctx.beginPath();
	ctx.arc(this.x, this.y, this.r + 11, -Math.PI / 2, (-Math.PI / 2) + (Math.PI * 2 * pct));
    ctx.stroke();
    ctx.restore();
  };
  Player.prototype.isDashing = function(){ return this._dashTimer > 0; };
  window.Player = Player;
})();
