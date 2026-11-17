const hero = document.querySelector('.hero');
const mountain = document.querySelector('.mountain');
const drawing = document.querySelector('.drawing');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
let scrollFrame = 0;

function updateDrawing() {
  scrollFrame = 0;
  const bounds = mountain.getBoundingClientRect();
  const progress = Math.max(0, Math.min(1, (innerHeight * .84 - bounds.top) / (bounds.height * .66)));
  drawing.style.setProperty('--remaining', motion.matches ? 0 : 1 - progress);
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
  uniform vec4 drops[8];

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
    float cloud = (1.-smoothstep(.22,.68,radius+strata*.17))*ambient;
    float density = min(.92, cloud*(.23+strata*.70+veins*.40));
    vec3 pigment = mix(vec3(.14,.25,.29), vec3(.35,.48,.48), strata);
    vec3 inked = mix(paper, pigment, density);

    for (int i=0; i<8; i++) {
      float age = max(0.,time-drops[i].z);
      if (age >= 9.) continue;
      vec2 delta = p-drops[i].xy*scaled;
      vec2 warped = delta+distort(delta+vec2(float(i)),t)*(.57+.22*min(age,1.));
      float edge = length(warped)+field(warped*21.+float(i))*.086;
      float size = .09 + min(age*.022,.21);
      float bloom = (1.-smoothstep(size*.36,size,edge))*(1.-smoothstep(3.,9.,age));
      vec3 shade = drops[i].w < .5 ? vec3(.10,.17,.19)
        : (drops[i].w < 1.5 ? vec3(.23,.34,.56) : vec3(.63,.21,.15));
      inked = mix(inked,shade,bloom*.68);
    }
    gl_FragColor = vec4(inked,1.);
  }
`;

function startWash() {
  const canvas = document.querySelector('.wash');
  const gl = canvas.getContext('webgl', {alpha: false, antialias: false, powerPreference: 'low-power'});
  if (!gl) return;
  const program = gl.createProgram();
  for (const [kind, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]]) {
    const shader = gl.createShader(kind);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return;
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const uniforms = Object.fromEntries(['resolution', 'time', 'ambient', 'drops[0]'].map(name => [name, gl.getUniformLocation(program, name)]));
  const drops = new Float32Array(32);
  const controls = document.querySelector('.ink-controls');
  const pause = document.getElementById('wash-pause');
  let slot = 0, color = 0, time = 0, ambient = 1;
  let previous = 0, frame = 0, lastStroke = 0, visible = true, lost = false;
  let flowing = !motion.matches;

  function clearDrops() {
    for (let i = 0; i < drops.length; i += 4) drops[i + 2] = -20;
  }
  function paint() {
    if (lost) return;
    gl.uniform1f(uniforms.time, time);
    gl.uniform1f(uniforms.ambient, ambient);
    gl.uniform4fv(uniforms['drops[0]'], drops);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function fit() {
    const width = Math.max(1, hero.clientWidth), height = Math.max(1, hero.clientHeight);
    const ratio = Math.min(.85, 1050 / width, 760 / height);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    paint();
  }
  function animate(now) {
    if (previous && now - previous < 32) {
      frame = requestAnimationFrame(animate);
      return;
    }
    if (previous) time += Math.min((now - previous) / 1000, .1);
    previous = now;
    paint();
    frame = requestAnimationFrame(animate);
  }
  function sync() {
    pause.textContent = flowing ? '暂停流动' : '继续流动';
    pause.setAttribute('aria-pressed', String(!flowing));
    if (flowing && visible && !document.hidden && !lost) {
      if (!frame) frame = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(frame);
      frame = 0;
      previous = 0;
    }
  }
  function addDrop(event) {
    const bounds = hero.getBoundingClientRect();
    drops.set([(event.clientX - bounds.left) / bounds.width, 1 - (event.clientY - bounds.top) / bounds.height, time, color], slot * 4);
    slot = (slot + 1) % 8;
    lastStroke = performance.now();
    paint();
  }
  hero.addEventListener('pointerdown', event => {
    if (event.button === 0 && !event.target.closest('button, a')) addDrop(event);
  });
  hero.addEventListener('pointermove', event => {
    if ((event.buttons & 1) && !event.target.closest('button, a') && performance.now() - lastStroke > 100) addDrop(event);
  }, {passive: true});
  const palette = [...document.querySelectorAll('.swatch')];
  palette.forEach((button, index) => button.addEventListener('click', () => {
    color = index;
    palette.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  }));
  document.getElementById('wash-clear').addEventListener('click', () => {
    ambient = 0;
    clearDrops();
    paint();
  });
  pause.addEventListener('click', () => { flowing = !flowing; sync(); });
  motion.addEventListener('change', () => { flowing = !motion.matches; sync(); });
  document.addEventListener('visibilitychange', sync);
  canvas.addEventListener('webglcontextlost', () => {
    lost = true;
    canvas.hidden = true;
    controls.hidden = true;
    sync();
  });
  new ResizeObserver(fit).observe(hero);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }).observe(hero);
  clearDrops();
  fit();
  controls.hidden = false;
  sync();
}

startWash();
