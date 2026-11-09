// Home hero "matrix flow" background (A/B test "motion", variant b). External file because the CSP forbids inline scripts.
// Draws falling characters in the brand colors on a transparent canvas behind the hero text.
// Cheap by design: about 20 frames a second, device pixel ratio capped at 1.5, stops when the hero is off screen
// or the tab is hidden, and never runs for visitors who prefer reduced motion or who are in variant a.
(function () {
  var canvas = document.querySelector('.hero-matrix');
  if (!canvas || !canvas.getContext) return;
  if (document.documentElement.getAttribute('data-ab-motion') !== 'b') return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var ctx = canvas.getContext('2d');
  var chars = '01ABCDEF0123456789<>/{}#ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ';
  var colors = ['#22d3ee', '#22d3ee', '#22d3ee', '#a78bfa', '#a78bfa', '#f472b6'];
  var size = 16, cols = [], w = 0, h = 0, dpr = 1, running = false, visible = true, last = 0, raf = 0;

  function setup() {
    var r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = Math.max(1, Math.round(r.width)); h = Math.max(1, Math.round(r.height));
    size = w < 640 ? 14 : 16;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = '600 ' + size + 'px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    ctx.textBaseline = 'top';
    var n = Math.ceil(w / size);
    cols = [];
    for (var i = 0; i < n; i++) {
      cols.push({
        y: Math.random() * -h,                // start above the top at staggered heights
        speed: 0.45 + Math.random() * 0.75,   // rows per frame
        color: colors[(Math.random() * colors.length) | 0],
        on: Math.random() < 0.55              // leave gaps so it reads as texture, not a wall
      });
    }
  }

  function frame(t) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    if (t - last < 50) return; // ~20 fps
    last = t;
    // Fade what is already drawn (keeps the canvas transparent so the glows show through), then draw the next row.
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
    for (var i = 0; i < cols.length; i++) {
      var c = cols[i];
      c.y += c.speed * size;
      if (c.y > h + size * 4) { c.y = Math.random() * -h * 0.5; c.speed = 0.45 + Math.random() * 0.75; c.on = Math.random() < 0.55; }
      if (!c.on || c.y < 0) continue;
      var ch = chars.charAt((Math.random() * chars.length) | 0);
      ctx.fillStyle = c.color;
      ctx.fillText(ch, i * size, c.y);
    }
  }

  function update() {
    var should = visible && !document.hidden;
    if (should && !running) { running = true; last = 0; raf = requestAnimationFrame(frame); }
    else if (!should && running) { running = false; cancelAnimationFrame(raf); }
  }

  setup();
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (e) { visible = e[0].isIntersecting; update(); }).observe(canvas);
  }
  document.addEventListener('visibilitychange', update);
  var rt;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(setup, 200); });
  update();
})();
