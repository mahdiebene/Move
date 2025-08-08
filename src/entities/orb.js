(function(){
  function Orb(x, y, type){
    this.x = x; this.y = y;
    this.r = 6;
    this.color = '#ffd66b';
    this.type = type || 'normal'; // 'normal' | 'thunder' | 'shield' | 'magnet'
    this._t = 0;
  }
  Orb.prototype.render = function(ctx){
    if (this.type === 'thunder'){
      // pulsing blue glow
      this._t += 0.016;
      const pulse = 0.6 + Math.sin(this._t*6)*0.4;
      ctx.save();
      ctx.shadowColor = '#6bd0ff';
      ctx.shadowBlur = 10 + 10*pulse;
      ctx.fillStyle = '#6bd0ff';
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r+1, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r+4+2*pulse, 0, Math.PI*2); ctx.stroke();
    } else if (this.type === 'shield'){
      // protective green
      this._t += 0.016; const pulse = 0.6 + Math.sin(this._t*5)*0.4;
      ctx.save();
      ctx.shadowColor = '#7fff8a';
      ctx.shadowBlur = 8 + 10*pulse;
      ctx.fillStyle = '#7fff8a';
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(200,255,210,0.7)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r+3+2*pulse, 0, Math.PI*2); ctx.stroke();
    } else if (this.type === 'magnet'){
      // purple magnetic pulse
      this._t += 0.016; const pulse = 0.6 + Math.sin(this._t*7)*0.4;
      ctx.save();
      ctx.shadowColor = '#c77dff';
      ctx.shadowBlur = 8 + 10*pulse;
      ctx.fillStyle = '#c77dff';
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,230,255,0.7)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r+3+2*pulse, 0, Math.PI*2); ctx.stroke();
    } else {
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  window.Orb = Orb;
})();
