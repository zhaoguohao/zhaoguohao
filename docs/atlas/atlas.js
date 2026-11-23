(function makeAtlas() {
  const chart = document.getElementById('terrain');
  const profile = document.getElementById('section');
  const tideInput = document.getElementById('tide');
  const newChart = document.getElementById('redraw');
  const sight = document.querySelector('.sight');
  const mapContext = chart.getContext('2d');
  const profileContext = profile.getContext('2d');
  if (!mapContext || !profileContext || !window.d3?.contours) return;

  const columns = 192, rows = 128;
  const params = new URLSearchParams(location.search);
  const seedParam = params.get('seed') || '';
  let seed = /^\d{1,4}$/.test(seedParam) ? Number(seedParam) : 427;
  const tideParam = Number(params.get('tide'));
  let tide = Number.isFinite(tideParam) && tideParam >= -50 && tideParam <= 80 && tideParam % 10 === 0 ? tideParam : 0;
  const probe = {x: 94, y: 68};
  const savedPoint = /^(\d{1,3}),(\d{1,3})$/.exec(params.get('point') || '');
  if (savedPoint) {
    const x = Number(savedPoint[1]), y = Number(savedPoint[2]);
    if (x < columns && y < rows) { probe.x = x; probe.y = y; }
  }
  let pointEdited = false;
  let heights, layers, summit, relief;
  let frame = 0;
  const signed = value => value > 0 ? '+' + value : String(value).replace('-', '−');
  const limit = (value, min, max) => Math.min(max, Math.max(min, value));

  function createTerrain() {
    let state = seed + 11;
    function random() {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    }
    const noiseGrid = Float32Array.from({length: 64 * 64}, () => random() * 2 - 1);
    function noise(x, y) {
      const i = Math.floor(x), j = Math.floor(y);
      const fx = x - i, fy = y - j;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const at = (a, b) => noiseGrid[(b & 63) * 64 + (a & 63)];
      const top = at(i, j) * (1 - sx) + at(i + 1, j) * sx;
      const bottom = at(i, j + 1) * (1 - sx) + at(i + 1, j + 1) * sx;
      return top * (1 - sy) + bottom * sy;
    }
    const cores = [[.16,.6], [.35,.42], [.5,.59], [.69,.33], [.79,.62], [.32,.78], [.83,.24]];
    const peaks = cores.map(([x,y], i) => {
      const angle = (random() - .5) * 2.3;
      return {x:x + (random() - .5) * .13, y:y + (random() - .5) * .18,
        a:.09 + random() * .10, b:.07 + random() * .09, c:Math.cos(angle), s:Math.sin(angle),
        height: i < 5 ? 205 + random() * 115 : 116 + random() * 75};
    });
    heights = new Float32Array(columns * rows);
    summit = 0;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < columns; i++) {
        const x = (i + .5) / columns, y = (j + .5) / rows;
        const u = x + .075 * noise(3*x + 2, 4*y) + .03 * noise(10*x, 9*y + 11);
        const v = y + .11 * noise(3*x + 9, 4*y + 4) + .046 * noise(9*x + 4, 11*y);
        let sumSquares = 0;
        for (const peak of peaks) {
          const dx = u - peak.x, dy = (v - peak.y) * rows / columns;
          const major = (peak.c * dx + peak.s * dy) / peak.a;
          const minor = (peak.c * dy - peak.s * dx) / peak.b;
          const h = peak.height * Math.exp(-1.65 * (major * major + minor * minor));
          sumSquares += h * h;
        }
        const edge = Math.max(0, .13 - Math.min(x, 1-x, y, 1-y));
        const index = j * columns + i;
        const massif = Math.sqrt(sumSquares);
        const gully = Math.max(0, 1 - 3.5*Math.abs(noise(6*u+7, 7*v+5)));
        heights[index] = -122 + massif - edge * 400 - 34*gully*gully*limit(massif/160, 0, 1)
          + 36 * noise(5*x + 13, 6*y) + 17 * noise(17*x, 15*y + 8) + 7 * noise(38*x, 29*y);
        if (heights[index] > heights[summit]) summit = index;
      }
    }
    // Slope in the direction of the light. The same relief plate serves all tides.
    relief = document.createElement('canvas');
    relief.width = columns;
    relief.height = rows;
    const reliefContext = relief.getContext('2d');
    const shading = reliefContext.createImageData(columns, rows);
    for (let y = 1; y < rows-1; y++) {
      for (let x = 1; x < columns-1; x++) {
        const i = y*columns + x;
        const slope = .58*(heights[i+1]-heights[i-1]) + .42*(heights[i+columns]-heights[i-columns]);
        const base = 4*i;
        shading.data[base] = slope > 0 ? 255 : 22;
        shading.data[base+1] = slope > 0 ? 245 : 55;
        shading.data[base+2] = slope > 0 ? 204 : 56;
        shading.data[base+3] = Math.min(72, Math.abs(slope)*2.4);
      }
    }
    reliefContext.putImageData(shading, 0, 0);
    const levels = [];
    for (let z = -200; z <= heights[summit]; z += 10) levels.push(z);
    const contours = d3.contours().size([columns, rows]).thresholds(levels)(heights);
    layers = contours.map(({value, coordinates}) => {
      const path = new Path2D();
      for (const polygon of coordinates) {
        for (const ring of polygon) {
          path.moveTo(...ring[0]);
          for (let i = 1; i < ring.length; i++) path.lineTo(...ring[i]);
          path.closePath();
        }
      }
      return {value, path};
    });
    const heads = ['弦月','石帆','青礁','岬湾','双岬','风栖','鹿角','折浪'];
    const tails = ['列岛','外岛','海岬','群岛','浅滩'];
    document.getElementById('island-name').textContent = heads[seed % heads.length] + tails[Math.floor(seed / heads.length) % tails.length];
    document.getElementById('sheet').textContent = '图幅 ' + String(seed).padStart(4, '0');
  }

  const depths = [[-230,[30,65,79]],[-130,[46,91,104]],[-70,[72,129,137]],[-30,[121,170,167]],[-10,[177,204,184]]];
  const landBands = [[0,[239,222,178]],[30,[213,208,150]],[80,[160,179,125]],[150,[102,139,106]],[225,[68,110,87]],[300,[52,86,74]]];
  function colorAt(height) {
    const stops = height < 0 ? depths : landBands;
    const upper = stops.findIndex(([z]) => z >= height);
    if (upper <= 0) return 'rgb(' + stops[upper === 0 ? 0 : stops.length-1][1] + ')';
    const [z0, a] = stops[upper-1], [z1, b] = stops[upper];
    const fraction = (height - z0) / (z1 - z0);
    return 'rgb(' + a.map((v, i) => Math.round(v + (b[i] - v) * fraction)).join(',') + ')';
  }
  function prepare(canvas, context) {
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w*dpr) || canvas.height !== Math.round(h*dpr)) {
      canvas.width = Math.round(w*dpr);
      canvas.height = Math.round(h*dpr);
    }
    context.setTransform(canvas.width/w, 0, 0, canvas.height/h, 0, 0);
    return {w, h};
  }
  function drawMap() {
    const ctx = mapContext;
    const {w, h} = prepare(chart, ctx);
    ctx.fillStyle = colorAt(-240);
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.scale(w / columns, h / rows);
    for (const {value, path} of layers) {
      const relative = value - tide;
      ctx.fillStyle = colorAt(relative);
      ctx.fill(path, 'evenodd');
      ctx.lineWidth = (relative === 0 ? 1.5 : value % 50 === 0 ? .9 : .52) * columns/w;
      ctx.strokeStyle = relative === 0 ? '#fcf0ce' : relative < 0 ? '#d2e6d645' : '#3e5d4a8a';
      ctx.stroke(path);
    }
    ctx.restore();
    ctx.drawImage(relief, 0, 0, w, h);
    ctx.beginPath();
    for (let n=1; n<6; n++) { ctx.moveTo(w*n/6, 0); ctx.lineTo(w*n/6, h); }
    for (let n=1; n<4; n++) { ctx.moveTo(0, h*n/4); ctx.lineTo(w, h*n/4); }
    ctx.lineWidth = .65;
    ctx.strokeStyle = '#153f4659';
    ctx.setLineDash([3,5]); ctx.stroke(); ctx.setLineDash([]);
    const px = (summit % columns + .5) / columns * w, py = (Math.floor(summit / columns) + .5) / rows * h;
    ctx.beginPath(); ctx.moveTo(px,py-5); ctx.lineTo(px+4.5,py+3); ctx.lineTo(px-4.5,py+3); ctx.closePath();
    ctx.fillStyle = '#ffefc6'; ctx.fill(); ctx.strokeStyle = '#314e41'; ctx.lineWidth = 1; ctx.stroke();
    ctx.font = '600 12px Consolas, monospace';
    const mark = Math.round(heights[summit])+' m';
    const labelWidth = ctx.measureText(mark).width;
    const labelX = limit(px+8, 2, w-labelWidth-6);
    ctx.fillStyle = '#f6ebcce6'; ctx.fillRect(labelX-2,py-9,labelWidth+5,16);
    ctx.fillStyle = '#29483e'; ctx.fillText(mark,labelX,py+3);
    let dry = 0;
    for (const z of heights) if (z >= tide) dry++;
    document.getElementById('land').textContent = (100 * dry / heights.length).toFixed(1) + '%';
  }
  function drawSection() {
    const ctx = profileContext;
    const {w, h} = prepare(profile, ctx);
    const floor = -225, ceiling = heights[summit] + 20;
    const screenY = z => 4 + (ceiling - z) / (ceiling - floor) * (h - 8);
    const seaY = screenY(tide);
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = '#c7dcce'; ctx.fillRect(0,seaY,w,h-seaY);
    const ridge = new Path2D();
    for (let i = 0; i < columns; i++) {
      const x = i / (columns-1) * w, y = screenY(heights[probe.y*columns+i]);
      if (i) ridge.lineTo(x, y); else ridge.moveTo(x,y);
    }
    const earth = new Path2D(ridge);
    earth.lineTo(w,h); earth.lineTo(0,h); earth.closePath();
    ctx.fillStyle = '#afbb91'; ctx.fill(earth);
    ctx.strokeStyle = '#365c50'; ctx.lineWidth = 1.3; ctx.stroke(ridge);
    ctx.setLineDash([3,3]); ctx.beginPath(); ctx.moveTo(0,seaY); ctx.lineTo(w,seaY);
    ctx.strokeStyle = '#3f787d'; ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
    const x = probe.x / (columns-1) * w, z = heights[probe.y*columns+probe.x];
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.strokeStyle = '#8f4634'; ctx.stroke();
    ctx.beginPath(); ctx.arc(x,screenY(z),3.5,0,2*Math.PI); ctx.fillStyle = '#9b3f2b'; ctx.fill();
    const relative = Math.round(z - tide);
    document.getElementById('reading').textContent = '测点 · ' + (relative < 0 ? '水下 ' : '水面以上 ') + Math.abs(relative) + ' m';
    sight.style.setProperty('--east', (probe.x+.5)/columns*100 + '%');
    sight.style.setProperty('--north', (probe.y+.5)/rows*100 + '%');
    sight.hidden = false;
  }
  function redraw() {
    frame = 0;
    drawMap();
    drawSection();
  }
  function requestDraw() {
    if (!frame) frame = requestAnimationFrame(redraw);
  }
  function saveView() {
    const url = new URL(location.href);
    url.searchParams.set('seed', seed);
    url.searchParams.set('tide', tide);
    url.searchParams.set('point', probe.x + ',' + probe.y);
    if (url.href !== location.href) history.replaceState(history.state, '', url);
    pointEdited = false;
  }
  function setTide() {
    tide = Number(tideInput.value);
    document.getElementById('tide-value').textContent = signed(tide);
    tideInput.setAttribute('aria-valuetext', signed(tide) + ' 米');
    requestDraw();
  }
  tideInput.addEventListener('input', setTide);
  tideInput.addEventListener('change', saveView);
  newChart.addEventListener('click', () => {
    seed = (seed + 1 + Math.floor(Math.random()*9999)) % 10000;
    createTerrain();
    requestDraw();
    saveView();
  });
  function moveProbe(x, y) {
    x = limit(x, 0, columns-1);
    y = limit(y, 0, rows-1);
    if (probe.x === x && probe.y === y) return;
    probe.x = x;
    probe.y = y;
    pointEdited = true;
    drawSection();
  }
  function saveProbe() {
    if (pointEdited) saveView();
  }
  chart.addEventListener('click', event => {
    const r = chart.getBoundingClientRect();
    moveProbe(Math.floor((event.clientX-r.left)/r.width*columns), Math.floor((event.clientY-r.top)/r.height*rows));
    saveProbe();
  });
  const arrows = {ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
  chart.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const delta = arrows[event.key];
    if (!delta) return;
    event.preventDefault();
    moveProbe(probe.x+delta[0], probe.y+delta[1]);
  });
  chart.addEventListener('keyup', saveProbe);
  chart.addEventListener('blur', saveProbe);
  createTerrain();
  tideInput.value = tide;
  setTide();
  tideInput.disabled = newChart.disabled = false;
  const resize = new ResizeObserver(requestDraw);
  resize.observe(chart);
  resize.observe(profile);
  document.documentElement.classList.remove('atlas-loading', 'static-atlas');
})();
