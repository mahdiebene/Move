(function(){
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const randRange = (min, max) => Math.random() * (max - min) + min;
  const len = (x, y) => Math.hypot(x, y);
  const norm = (x, y) => { const l = Math.hypot(x, y) || 1; return { x: x / l, y: y / l }; };
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  window.Utils = { clamp, lerp, randRange, len, norm, now };
})();
