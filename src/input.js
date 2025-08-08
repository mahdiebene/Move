(function(){
  const keys = Object.create(null);
  const justPressed = new Set();

  const normalize = (k) => {
    if (!k) return '';
    if (k === ' ') return 'space';
    return k.toLowerCase();
  };

  window.addEventListener('keydown', (e) => {
    const k = normalize(e.key);
    keys[k] = true;
    justPressed.add(k);
    if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(e.key)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    const k = normalize(e.key);
    keys[k] = false;
  });

  function isDown(k){ return !!keys[normalize(k)]; }
  function consumePressed(k){
    k = normalize(k);
    const had = justPressed.has(k);
    if(had) justPressed.delete(k);
    return had;
  }

  window.Input = { isDown, consumePressed, _keys: keys };
})();
