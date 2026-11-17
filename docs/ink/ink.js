const hero = document.querySelector('.hero');
const mountain = document.querySelector('.mountain');
const drawing = document.querySelector('.drawing');
const closing = document.querySelector('.closing');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
let scrollFrame = 0;
let drawnProgress = null;

function updateDrawing() {
  scrollFrame = 0;
  const bounds = mountain.getBoundingClientRect();
  const progress = Math.max(0, Math.min(1, (innerHeight * .88 - bounds.top) / (bounds.height * .78)));
  const difference = drawnProgress === null ? 0 : progress - drawnProgress;
  drawnProgress = Math.abs(difference) < .002 ? progress : drawnProgress + difference * .24;
  drawing.style.setProperty('--remaining', motion.matches ? 0 : 1 - drawnProgress);
  const drift = motion.matches ? 0 : Math.max(-1, Math.min(1, (bounds.top + bounds.height / 2 - innerHeight / 2) / innerHeight));
  drawing.style.setProperty('--sun-drift', `${drift * -66}px`);
  drawing.style.setProperty('--ridge-drift', `${drift * -35}px`);
  drawing.style.setProperty('--bank-drift', `${drift * 24}px`);
  const closingProgress = motion.matches ? 1 : Math.max(0, Math.min(1, (innerHeight - closing.getBoundingClientRect().top) / (innerHeight * .76)));
  closing.style.setProperty('--reveal', closingProgress);
  closing.style.setProperty('--wash-drift', `${(1 - closingProgress) * 85}px`);
  if (!motion.matches && Math.abs(difference) >= .002) scheduleDrawing();
}
function scheduleDrawing() {
  if (!scrollFrame) scrollFrame = requestAnimationFrame(updateDrawing);
}
addEventListener('scroll', scheduleDrawing, {passive: true});
addEventListener('resize', scheduleDrawing);
motion.addEventListener('change', scheduleDrawing);
updateDrawing();

const vertexSource = `
  attribute vec2 position;
  void main() { gl_Position = vec4(position, 0., 1.); }
`;
const fragmentSource = `
  precision mediump float;
  uniform vec2 resolution;
  uniform float time;
  uniform float ambient;
  uniform sampler2D inkMap;

  float grain(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 4375.13); }
  float noise2(vec2 q) {
    vec2 i = floor(q), f = fract(q);
    f = f*f*(3.-2.*f);
    return mix(mix(grain(i), grain(i+vec2(1.,0.)), f.x),
      mix(grain(i+vec2(0.,1.)), grain(i+vec2(1.,1.)), f.x), f.y);
  }
  float field(vec2 p) {
    mat2 rotate = mat2(.8, -.6, .6, .8);
    return .56*noise2(p) + .28*noise2(rotate*p*2.13) + .16*noise2(p*4.28);
  }
  vec2 distort(vec2 p, float clock) {
    vec2 warp = vec2(field(p*3.2+vec2(clock*.12, 2.)), field(p*3.8-vec2(4.,clock*.09)));
    return (warp-.5)*.58;
  }
  void main() {
    vec2 uv = gl_FragCoord.xy / resolution;
    vec2 scaled = vec2(resolution.x/resolution.y,1.);
    vec2 p = uv*scaled;
    float t = time*.5;
    vec3 paper = vec3(.954,.922,.855);
    paper += (grain(gl_FragCoord.xy)-.5)*.055;
    float vignette = abs(uv.x-.49)*.075+abs(uv.y-.48)*.035;
    paper -= vignette*vec3(.54,.75,1.);

    vec2 center = vec2(.735,.53)*scaled;
    vec2 q = (p-center)*vec2(.85,1.08);
    vec2 bent = q+distort(q,t);
    float radius = length(bent);
    float strata = field(bent*10.+vec2(t*.12,-t*.08));
    float veins = pow(.5+.5*sin(radius*47.+strata*18.-t*.18), 6.);
    float cloud = (1.-smoothstep(.22,.68,radius+strata*.17))*ambient
      * mix(.09,1.,smoothstep(.16,.59,uv.x));
    float density = min(.92, cloud*(.23+strata*.70+veins*.40));
    vec3 pigment = mix(vec3(.14,.25,.29), vec3(.35,.48,.48), strata);
    vec3 inked = mix(paper, pigment, density);

    vec4 ink = texture2D(inkMap, uv);
    inked = mix(inked, ink.rgb, ink.a * .84);
    gl_FragColor = vec4(inked,1.);
  }
`;

const transportSource = `
  precision highp float;
  uniform vec2 size;
  uniform sampler2D previousInk;
  uniform vec4 stroke;
  uniform vec3 pigment;
  uniform float radius;
  uniform float active;
  uniform float time;
  uniform float dt;
  void main() {
    vec2 uv = gl_FragCoord.xy / size;
    vec2 aspect = vec2(size.x / size.y, 1.);
    vec2 p = uv * aspect;
    vec2 drift = vec2(
      sin(p.y*10.+time*.67) + .62*cos(p.x*6.1+p.y*8.-time*.45),
      cos(p.x*8.4-time*.53) + .57*sin(p.y*6.+p.x*5.+time*.38)
    ) * .048;
    vec2 delta = (stroke.zw-stroke.xy)*aspect;
    vec2 offset = p-stroke.zw*aspect;
    float wake = exp(-dot(offset,offset)*38.);
    drift += delta * wake * 4.3 * active;
    vec2 sampleAt = uv - drift*dt/aspect;
    vec2 pixel = 1./size;
    vec4 before = texture2D(previousInk, sampleAt)*.64
      + (texture2D(previousInk,sampleAt + vec2(pixel.x,0.))
      + texture2D(previousInk,sampleAt - vec2(pixel.x,0.))
      + texture2D(previousInk,sampleAt + vec2(0.,pixel.y))
      + texture2D(previousInk,sampleAt - vec2(0.,pixel.y))) * .09;
    float edge = smoothstep(0.,.045,min(min(uv.x,1.-uv.x),min(uv.y,1.-uv.y)));
    before.a = max(0.,before.a - dt*.16) * edge;
    vec2 fromStart = p-stroke.xy*aspect;
    float along = clamp(dot(fromStart,delta)/max(dot(delta,delta),.00001),0.,1.);
    float distance = length(fromStart - along*delta);
    float texture = .85+.15*sin(p.x*176.+p.y*63.)*cos(p.y*145.);
    float added = (1.-smoothstep(radius*.22,radius,distance))*active*texture;
    float alpha = added + before.a*(1.-added);
    vec3 rgb = mix(before.rgb,pigment,added/max(alpha,.001));
    gl_FragColor = vec4(rgb,alpha);
  }
`;

function startWash() {
  const canvas = document.querySelector('.wash');
  const strokes = document.querySelector('.strokes');
  const pen = strokes.getContext('2d');
  const cursor = document.querySelector('.brush-cursor');
  const gl = canvas.getContext('webgl', {alpha: false, antialias: false, powerPreference: 'low-power'});
  if (!gl || !pen) return;
  function makeProgram(fragment, names) {
    const program = gl.createProgram();
    for (const [kind, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragment]]) {
      const shader = gl.createShader(kind);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
      gl.attachShader(program, shader);
      gl.deleteShader(shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
    return {program, position: gl.getAttribLocation(program, 'position'),
      uniforms: Object.fromEntries(names.map(name => [name, gl.getUniformLocation(program, name)]))};
  }
  const render = makeProgram(fragmentSource, ['resolution', 'time', 'ambient', 'inkMap']);
  const transport = makeProgram(transportSource, ['size', 'previousInk', 'stroke', 'pigment', 'radius', 'active', 'time', 'dt']);
  const triangle = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, triangle);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const controls = document.querySelector('.ink-controls');
  const pause = document.getElementById('wash-pause');
  const ambientButton = document.getElementById('wash-ambient');
  const touch = document.getElementById('wash-touch');
  const brush = document.getElementById('wash-size');
  const shades = [[.09,.17,.19], [.18,.31,.55], [.69,.18,.12]];
  const penColors = ['#27383b', '#38567c', '#a23e30'];
  let color = 0, time = 0, ambient = 1, inkUntil = 0;
  let previous = 0, frame = 0, visible = true, lost = false;
  let flowing = !motion.matches;
  let buffers = [], bufferWidth, bufferHeight;
  let point = null;
  let pointer = null;
  let touchStart = null;
  let hasStrokes = false;

  function use(pass, framebuffer, width, height, texture) {
    gl.useProgram(pass.program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.viewport(0, 0, width, height);
    gl.bindBuffer(gl.ARRAY_BUFFER, triangle);
    gl.enableVertexAttribArray(pass.position);
    gl.vertexAttribPointer(pass.position, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    return pass.uniforms;
  }
  function createBuffer() {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    for (const [param, value] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR],
      [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) {
      gl.texParameteri(gl.TEXTURE_2D, param, value);
    }
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, bufferWidth, bufferHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    return {texture, framebuffer};
  }
  function clearInk() {
    gl.clearColor(0, 0, 0, 0);
    for (const {framebuffer} of buffers) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    inkUntil = 0;
  }
  function advect(dt, from = [0, 0], to = from, active = 0) {
    const [current, next] = buffers;
    const uniforms = use(transport, next.framebuffer, bufferWidth, bufferHeight, current.texture);
    gl.uniform1i(uniforms.previousInk, 0);
    gl.uniform2f(uniforms.size, bufferWidth, bufferHeight);
    gl.uniform4f(uniforms.stroke, ...from, ...to);
    gl.uniform3fv(uniforms.pigment, shades[color]);
    gl.uniform1f(uniforms.radius, .019 + Number(brush.value) * .014);
    gl.uniform1f(uniforms.time, time);
    gl.uniform1f(uniforms.active, active);
    gl.uniform1f(uniforms.dt, dt);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    buffers = [next, current];
  }
  function paint() {
    if (lost || !buffers.length) return;
    const uniforms = use(render, null, canvas.width, canvas.height, buffers[0].texture);
    gl.uniform1i(uniforms.inkMap, 0);
    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    gl.uniform1f(uniforms.time, time);
    gl.uniform1f(uniforms.ambient, ambient);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function fit() {
    if (lost) return;
    const width = Math.max(1, hero.clientWidth), height = Math.max(1, hero.clientHeight);
    const ratio = Math.min(.82, 1000 / width, 720 / height);
    const nextWidth = Math.max(1, Math.round(width * ratio)), nextHeight = Math.max(1, Math.round(height * ratio));
    const inkScale = Math.min(devicePixelRatio || 1, 1.5, 1800 / width, 1250 / height);
    const inkWidth = Math.max(1, Math.round(width * inkScale)), inkHeight = Math.max(1, Math.round(height * inkScale));
    if (strokes.width !== inkWidth || strokes.height !== inkHeight) {
      const old = hasStrokes ? document.createElement('canvas') : null;
      if (old) {
        old.width = strokes.width;
        old.height = strokes.height;
        old.getContext('2d').drawImage(strokes, 0, 0);
      }
      strokes.width = inkWidth;
      strokes.height = inkHeight;
      if (old) pen.drawImage(old, 0, 0, inkWidth, inkHeight);
    }
    if (buffers.length && canvas.width === nextWidth && canvas.height === nextHeight) return;
    canvas.width = nextWidth;
    canvas.height = nextHeight;
    for (const {texture, framebuffer} of buffers) {
      gl.deleteTexture(texture);
      gl.deleteFramebuffer(framebuffer);
    }
    bufferWidth = Math.max(1, Math.round(nextWidth * .55));
    bufferHeight = Math.max(1, Math.round(nextHeight * .55));
    buffers = [createBuffer(), createBuffer()];
    clearInk();
    paint();
  }
  function animate(now) {
    const dt = previous ? Math.min((now - previous) / 1000, .048) : 0;
    previous = now;
    time += dt;
    if (time < inkUntil) advect(dt);
    else if (inkUntil) {
      clearInk();
      if (!ambient) {
        paint();
        sync();
        return;
      }
    }
    paint();
    frame = requestAnimationFrame(animate);
  }
  function sync() {
    pause.textContent = flowing ? '暂停流动' : '继续流动';
    pause.setAttribute('aria-pressed', String(!flowing));
    if (flowing && (ambient || inkUntil) && visible && !document.hidden && !lost) {
      if (!frame) frame = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(frame);
      frame = 0;
      previous = 0;
    }
  }
  function penWidth(event) {
    const width = [3, 5, 8, 13, 20][Number(brush.value) - 1];
    return event.pointerType === 'pen' && event.pressure > 0 ? width * (.55 + .85 * event.pressure) : width;
  }
  function drawStroke(from, to, event, bounds) {
    const scale = strokes.width / bounds.width;
    pen.lineWidth = penWidth(event) * scale;
    pen.lineCap = 'round';
    pen.lineJoin = 'round';
    pen.strokeStyle = pen.fillStyle = penColors[color];
    const x = to[0] * strokes.width, y = (1 - to[1]) * strokes.height;
    pen.beginPath();
    if (from === to) {
      pen.arc(x, y, pen.lineWidth / 2, 0, Math.PI * 2);
      pen.fill();
    } else {
      pen.moveTo(from[0] * strokes.width, (1 - from[1]) * strokes.height);
      pen.lineTo(x, y);
      pen.stroke();
    }
    hasStrokes = true;
  }
  function addDrop(event, bounds, continuing = false, stir = true) {
    const next = [(event.clientX - bounds.left) / bounds.width, 1 - (event.clientY - bounds.top) / bounds.height];
    const from = continuing && point ? point : next;
    drawStroke(from, next, event, bounds);
    if (stir) {
      advect(flowing ? .016 : 0, from, next, continuing ? .63 : .78);
      inkUntil = time + 12;
      paint();
      sync();
    }
    point = next;
  }
  const overControls = event => Boolean(event.target.closest('button, a, input, label'));
  hero.addEventListener('pointerdown', event => {
    if (lost || event.button !== 0 || pointer !== null || overControls(event)) return;
    if (event.pointerType === 'touch' && !hero.classList.contains('brush-mode')) {
      touchStart = {id: event.pointerId, x: event.clientX, y: event.clientY};
      return;
    }
    pointer = event.pointerId;
    hero.setPointerCapture(pointer);
    addDrop(event, hero.getBoundingClientRect());
  });
  hero.addEventListener('pointermove', event => {
    if (lost) return;
    const bounds = hero.getBoundingClientRect();
    cursor.hidden = event.pointerType === 'touch' || overControls(event);
    if (!cursor.hidden) {
      cursor.style.left = (event.clientX - bounds.left) + 'px';
      cursor.style.top = (event.clientY - bounds.top) + 'px';
      cursor.style.width = cursor.style.height = Math.max(9, penWidth(event)) + 'px';
    }
    if (event.pointerId !== pointer || !point) return;
    const samples = event.getCoalescedEvents?.() || [];
    for (const sample of samples) addDrop(sample, bounds, true, false);
    addDrop(event, bounds, true);
  }, {passive: true});
  function endStroke(event) {
    if (event.pointerId === pointer) {
      if (event.type === 'pointerup' && point) addDrop(event, hero.getBoundingClientRect(), true);
      pointer = null;
      point = null;
    }
    if (event.pointerId === touchStart?.id) {
      if (event.type === 'pointerup' && Math.hypot(event.clientX - touchStart.x, event.clientY - touchStart.y) < 10) {
        addDrop(event, hero.getBoundingClientRect());
        point = null;
      }
      touchStart = null;
    }
  }
  for (const kind of ['pointerup', 'pointercancel', 'lostpointercapture']) hero.addEventListener(kind, endStroke);
  hero.addEventListener('pointerleave', () => { cursor.hidden = true; });
  const palette = [...document.querySelectorAll('.swatch')];
  palette.forEach((button, index) => button.addEventListener('click', () => {
    color = index;
    palette.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  }));
  document.getElementById('wash-clear').addEventListener('click', () => {
    ambient = 0;
    ambientButton.setAttribute('aria-pressed', 'false');
    clearInk();
    pen.clearRect(0, 0, strokes.width, strokes.height);
    hasStrokes = false;
    point = null;
    paint();
    sync();
  });
  ambientButton.addEventListener('click', () => {
    ambient = 1 - ambient;
    ambientButton.setAttribute('aria-pressed', String(Boolean(ambient)));
    paint();
    sync();
  });
  touch.addEventListener('click', () => {
    touch.setAttribute('aria-pressed', String(hero.classList.toggle('brush-mode')));
  });
  pause.addEventListener('click', () => { flowing = !flowing; sync(); });
  motion.addEventListener('change', () => { flowing = !motion.matches; sync(); });
  document.addEventListener('visibilitychange', sync);
  canvas.addEventListener('webglcontextlost', () => {
    lost = true;
    canvas.hidden = true;
    controls.hidden = true;
    cursor.hidden = true;
    sync();
  });
  new ResizeObserver(fit).observe(hero);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }).observe(hero);
  fit();
  hero.classList.add('ink-ready');
  controls.hidden = false;
  sync();
}

try { startWash(); } catch (error) { console.warn('Ink rendering unavailable', error); }
