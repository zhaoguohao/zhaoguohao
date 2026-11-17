export function startWind() {
  const stage = document.querySelector('.hero');
  const canvas = stage.querySelector('canvas');
  const context = canvas.getContext('2d');
  const controls = document.querySelector('.wind-controls');
  const gustButton = document.getElementById('gust');
  const toggle = document.getElementById('toggle-motion');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  if (!context) return;

  const colors = ['#77ecd9', '#8bbaff', '#bcaafa', '#f2c674'];
  const pointer = {x: 0, y: 0, active: false};
  let width = 0;
  let height = 0;
  let leaves = [];
  let frameId = 0;
  let previousTime = 0;
  let gust = 0;
  let visible = false;
  let enabled = !reducedMotion.matches;

  const leafShape = new Path2D('M-1 0 C-.45 -1 .65 -.72 1 0 C.55 .54 -.35 .83 -1 0 Z');
  const vein = new Path2D('M-.88 .02 Q0 -.12 .86 0 M-.32 -.03 L.05 -.37 M.06 -.05 L.35 .23');

  function createLeaf(scatter) {
    const depth = Math.random();
    return {
      x: scatter ? Math.random() * width : -30,
      y: height * (.54 + Math.random() * .48),
      size: (4 + 10 * depth) * Math.min(1, width / 560 + .2),
      speed: 20 + 55 * depth,
      depth,
      angle: Math.random() * Math.PI * 2,
      phase: Math.random() * Math.PI * 2,
      color: colors[Math.floor(Math.random() * colors.length)]
    };
  }

  function resize() {
    const bounds = stage.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    const scale = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);
    leaves = Array.from({length: width < 560 ? 17 : 32}, () => createLeaf(true));
  }

  function draw(time) {
    const dt = previousTime ? Math.min((time - previousTime) / 1000, .04) : 0;
    previousTime = time;
    gust *= Math.exp(-dt * .95);
    context.clearRect(0, 0, width, height);

    for (let index = 0; index < leaves.length; index++) {
      const leaf = leaves[index];
      const distance = pointer.active ? Math.hypot(leaf.x - pointer.x, leaf.y - pointer.y) : Infinity;
      const influence = Math.max(0, 1 - distance / 170);
      leaf.phase += dt * (1 + leaf.depth);
      leaf.x += dt * (leaf.speed + gust * (1 + leaf.depth) + influence * 94);
      leaf.y += dt * (Math.sin(leaf.phase) * (18 + leaf.depth * 20) - gust * .18
        + influence * (leaf.y < pointer.y ? -52 : 52));
      leaf.angle += dt * (leaf.depth - .35 + influence * 2 + gust * .004);
      if (leaf.x > width + 30 || leaf.y < height * .46 || leaf.y > height + 30) {
        leaves[index] = createLeaf(false);
        continue;
      }

      context.save();
      context.translate(leaf.x, leaf.y);
      context.rotate(leaf.angle);
      context.scale(leaf.size, leaf.size * (.33 + .67 * Math.abs(Math.cos(leaf.phase))));
      context.globalAlpha = .32 + leaf.depth * .58;
      context.fillStyle = leaf.color;
      context.fill(leafShape);
      context.strokeStyle = '#13334a';
      context.lineWidth = .085;
      context.stroke(vein);
      context.restore();
    }
    frameId = requestAnimationFrame(draw);
  }

  function sync() {
    toggle.textContent = enabled ? '暂停动效' : '播放动效';
    gustButton.disabled = !enabled;
    if (enabled && visible && !document.hidden) {
      if (!frameId) frameId = requestAnimationFrame(draw);
    } else {
      cancelAnimationFrame(frameId);
      frameId = 0;
      previousTime = 0;
      if (!enabled) context.clearRect(0, 0, width, height);
    }
  }

  stage.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    const bounds = stage.getBoundingClientRect();
    pointer.x = event.clientX - bounds.left;
    pointer.y = event.clientY - bounds.top;
    pointer.active = true;
  }, {passive: true});
  stage.addEventListener('pointerleave', () => { pointer.active = false; });
  gustButton.addEventListener('click', () => { gust = 210; });
  toggle.addEventListener('click', () => { enabled = !enabled; sync(); });
  reducedMotion.addEventListener('change', (event) => { enabled = !event.matches; sync(); });
  document.addEventListener('visibilitychange', sync);
  new ResizeObserver(resize).observe(stage);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }).observe(stage);
  resize();
  controls.hidden = false;
  sync();
}
