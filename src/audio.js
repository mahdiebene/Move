(function(){
  let ctx = null;
  let master = null;
  let enabled = true;

  function init(){
    if (!ctx){
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.25; // master volume
      master.connect(ctx.destination);
      // Try to resume on first user gesture
      const resume = () => { if (ctx && ctx.state === 'suspended') ctx.resume(); window.removeEventListener('pointerdown', resume); window.removeEventListener('keydown', resume); };
      window.addEventListener('pointerdown', resume);
      window.addEventListener('keydown', resume);
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function blip({ type='sine', freq=440, dur=0.12, vol=0.6, glideTo=null }){
    if (!enabled) return;
    init(); if (!ctx) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glideTo){ osc.frequency.exponentialRampToValueAtTime(Math.max(40, glideTo), t0 + dur*0.9); }
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g); g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function play(name){
    // small randomization for life
    const r = (a,b)=> a + Math.random()*(b-a);
    switch(name){
      case 'dash':
        blip({ type:'square', freq:r(380,460), glideTo:r(180,240), dur:0.14, vol:0.5 });
        break;
      case 'orb':
        blip({ type:'sine', freq:r(820,920), dur:0.09, vol:0.45 });
        break;
      case 'shield':
        // quick protective chiming
        blip({ type:'sine', freq:r(900,1100), dur:0.08, vol:0.45 });
        blip({ type:'triangle', freq:r(1200,1400), dur:0.06, vol:0.35 });
        break;
      case 'magnet':
        // rising twinkle
        blip({ type:'square', freq:r(600,700), glideTo:r(900,1000), dur:0.12, vol:0.4 });
        break;
      case 'thunder':
        // sharp electric zap: two quick descending chirps
        blip({ type:'triangle', freq:r(1800,2200), glideTo:r(400,600), dur:0.08, vol:0.5 });
        blip({ type:'square', freq:r(1200,1500), glideTo:r(300,400), dur:0.09, vol:0.4 });
        break;
      case 'over':
        blip({ type:'sawtooth', freq:r(120,160), glideTo:r(60,90), dur:0.4, vol:0.6 });
        break;
      default:
        blip({});
    }
  }

  function setEnabled(v){ enabled = !!v; }
  function isEnabled(){ return enabled; }

  window.Sfx = { play, setEnabled, isEnabled };
})();
