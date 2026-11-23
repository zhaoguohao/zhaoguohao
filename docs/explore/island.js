import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

const stops = [
  {x: -17, z: -11, color: 0xffbc79, name: 'Unity 工坊'},
  {x: 18, z: -6, color: 0xad96ff, name: '贪吃蛇观测站'},
  {x: 1, z: 20, color: 0x6cf1dd, name: '时间灯塔'}
];
const surfaceRadius = 30;
const start = new THREE.Vector3(1, 0, 12);
const inputCodes = {
  KeyW: 'ArrowUp', KeyS: 'ArrowDown', KeyA: 'ArrowLeft', KeyD: 'ArrowRight',
  ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight',
  ShiftLeft: 'Shift', ShiftRight: 'Shift'
};

export function startIsland() {
  const canvas = document.getElementById('island');
  const status = document.getElementById('status');
  const visit = document.getElementById('visit');
  const driveUi = document.querySelector('.drive-ui');
  const links = [...document.querySelectorAll('[data-stop]')];
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1028);
  scene.fog = new THREE.FogExp2(0x101b33, .0085);
  const camera = new THREE.PerspectiveCamera(43, 1, .2, 250);
  const target = new THREE.Vector3();
  const view = new THREE.Vector3();
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), .48, .64, .76));
  composer.addPass(new OutputPass());
  const sky = new THREE.HemisphereLight(0xaecaff, 0x362d6c, 1.75);
  const sun = new THREE.DirectionalLight(0xa9d7ff, 2.2);
  sun.position.set(-30, 36, -18);
  scene.add(sky, sun);

  const standard = (color, extra = {}) => new THREE.MeshStandardMaterial({color, roughness: .84, ...extra});
  const light = (color, extra = {}) => new THREE.MeshBasicMaterial({color, ...extra});
  const neon = (color, intensity = 2.7) => light(new THREE.Color(color).multiplyScalar(intensity));
  function mesh(geometry, material, x, y, z, parent = scene) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    parent.add(object);
    return object;
  }
  function box(x, y, z, w, h, d, material, parent = scene) {
    return mesh(new THREE.BoxGeometry(w, h, d), material, x, y, z, parent);
  }
  function disk(x, y, z, inner, outer, material) {
    const geometry = inner ? new THREE.RingGeometry(inner, outer, 80) : new THREE.CircleGeometry(outer, 32);
    const object = mesh(geometry, material, x, y, z);
    object.rotation.x = -Math.PI / 2;
    return object;
  }
  let seed = 3091;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  // Build the island and all of its scenery from small reusable primitives.
  mesh(new THREE.CylinderGeometry(30.3, 26, 4.8, 48), standard(0x172238, {metalness: .42, flatShading: true}), 0, -2.43, 0);
  disk(0, .012, 0, 0, 30, standard(0x14213a, {metalness: .42, roughness: .54}));
  disk(0, .025, 0, 13.8, 23.6, standard(0x212c42, {metalness: .32, roughness: .5}));
  disk(0, .037, 0, 13.8, 13.95, neon(0x78a2ff, 1.5));
  disk(0, .037, 0, 23.45, 23.56, neon(0xff84bf, 1.65));
  disk(0, .03, 0, 29.5, 29.62, neon(0x4fe4ef));
  disk(0, -1.7, 0, 29, 29.12, neon(0x5558fc, 2.3));
  disk(0, -4.7, 0, 31, 31.1, neon(0x78edff, 1.25));
  const roadMarks = light(0x758bac);
  for (let i = 0; i < 36; i++) {
    const angle = i * Math.PI / 18;
    const stripe = box(Math.cos(angle) * 18.7, .045, Math.sin(angle) * 18.7, .13, .018, 1.45, roadMarks);
    stripe.rotation.y = -angle;
  }
  const deckLines = new THREE.GridHelper(19, 15, 0x455f90, 0x2a3d61);
  deckLines.position.y = .059;
  scene.add(deckLines);

  const steel = standard(0x344664, {metalness: .44, roughness: .36});
  const black = standard(0x10182c, {metalness: .22});
  const aqua = neon(0x48e6db);
  const violet = neon(0x946aff);
  const warm = neon(0xff8f67);
  const tower = new THREE.BoxGeometry(1, 1, 1);
  for (let i = 0; i < 42; i++) {
    const angle = -Math.PI + i * .077 + random() * .054;
    const radius = 39 + random() * 29;
    const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius - 10;
    const height = 4 + random() * 20, width = 1.3 + random() * 3.3;
    mesh(tower, i % 3 ? steel : black, x, height * .5 - 5, z).scale.set(width, height, width);
    mesh(tower, i % 3 ? violet : aqua, x, height - 5, z).scale.set(width * .80, .17, width * .8);
    mesh(tower, i % 3 ? aqua : warm, x, height * .78 - 5, z + width * .503).scale.set(width * .68, .11, .04);
  }
  for (let i = 0; i < 28; i++) {
    const angle = i * Math.PI / 14;
    const x = Math.cos(angle) * 27, z = Math.sin(angle) * 27;
    box(x, .85, z, .26, 1.7, .26, steel);
    box(x, 1.74, z, .42, .15, .42, i % 3 ? aqua : violet);
    const marker = box(x * .96, .073, z * .96, .3, .019, 1.4, i % 3 ? aqua : violet);
    marker.rotation.y = -angle;
  }

  const crystals = [];
  function crystal(x, z, size, color) {
    disk(x + .3, .04, z + .35, 0, size * .85, light(0x244d59));
    const gem = mesh(new THREE.OctahedronGeometry(size), standard(color, {
      flatShading: true, emissive: color, emissiveIntensity: .13
    }), x, size * 1.18, z);
    gem.scale.set(.7, 1.75, .76);
    gem.rotation.set(.1, random() * Math.PI, -.12);
    crystals.push(gem);
  }
  crystal(-3, -1, 2.9, 0x7cf1dd);
  crystal(1, -2, 2, 0xa59aff);
  crystal(3.7, 1.2, 1.42, 0x6eb9ea);
  crystal(-.6, 3.3, 1.75, 0x72e4e4);

  const trunk = standard(0x332550);
  const foliage = [standard(0x36677a), standard(0x38518b), standard(0x6e438f)];
  const cone = new THREE.IcosahedronGeometry(1, 0);
  for (let i = 0; i < 28; i++) {
    const angle = random() * Math.PI * 2;
    const radius = i < 18 ? 26.5 + random() * 2.5 : 9.6 + random() * 2.4;
    const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
    const height = .7 + random() * 1.15;
    const shadow = disk(x + .3, .045, z + .35, 0, height * .68, light(0x19263d));
    shadow.scale.y = .65;
    box(x, height * .37, z, .16, height * .74, .16, trunk);
    const tree = mesh(cone, foliage[i % foliage.length], x, height * 1.18, z);
    tree.scale.set(height * .66, height * .88, height * .66);
    tree.rotation.y = random() * Math.PI;
  }

  const beacons = [];
  for (const [index, stop] of stops.entries()) {
    const {x, z, color} = stop;
    disk(x, .055, z, 0, 3.3, standard(0x32445b));
    disk(x, .066, z, 2.96, 3.18, light(color));
    const base = standard(0x4b6076);
    const shine = neon(color, 2.1);
    if (index === 0) {
      box(x, 1.05, z, 3.8, 2.1, 3.1, base);
      const roof = mesh(new THREE.ConeGeometry(2.75, 1.2, 4), standard(color), x, 2.7, z);
      roof.rotation.y = Math.PI / 4;
      box(x, .76, z + 1.56, 1.24, 1.5, .05, shine);
    } else if (index === 1) {
      mesh(new THREE.CylinderGeometry(1.65, 1.85, 1.9, 10), base, x, .95, z);
      mesh(new THREE.SphereGeometry(1.62, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), standard(color, {flatShading: true}), x, 1.9, z);
      box(x, .86, z + 1.73, .95, 1.4, .05, shine);
    } else {
      mesh(new THREE.CylinderGeometry(.75, 1.15, 3.4, 8), base, x, 1.7, z);
      mesh(new THREE.CylinderGeometry(.84, .84, .7, 8), shine, x, 3.7, z);
      mesh(new THREE.ConeGeometry(1.04, .58, 8), base, x, 4.34, z);
    }
    beacons.push(mesh(new THREE.OctahedronGeometry(.42), shine, x, 5.25, z));
  }

  const video = document.getElementById('billboard-video');
  const toggleVideo = document.getElementById('billboard-toggle');
  const poster = new THREE.TextureLoader().load('./black-hole-poster.jpg');
  poster.colorSpace = THREE.SRGBColorSpace;
  const screenMaterial = light(0xffffff, {map: poster, toneMapped: false});
  const screen = new THREE.Group();
  screen.position.set(-7.6, 0, -18);
  screen.rotation.y = .07;
  scene.add(screen);
  for (const x of [-7.7, 7.7]) {
    box(x, 3.9, 0, .63, 7.8, .72, steel, screen);
    box(x, .34, 0, 2.1, .68, 1.85, black, screen);
    box(x, 3.8, .38, .11, 6.2, .045, violet, screen);
  }
  box(0, 8.7, 0, 19.4, 10.9, .85, black, screen);
  box(0, 13.9, .45, 18.7, .12, .12, aqua, screen);
  box(0, 3.52, .45, 18.7, .12, .12, violet, screen);
  for (const x of [-9.45, 9.45]) box(x, 8.7, .45, .11, 10.4, .14, aqua, screen);
  const display = mesh(new THREE.PlaneGeometry(18.1, 18.1 * 9 / 16), screenMaterial, 0, 8.7, .48, screen);
  const videoTexture = new THREE.VideoTexture(video);
  videoTexture.colorSpace = THREE.SRGBColorSpace;
  let wantsPlayback = true;
  let playRequest = null;
  let contextLost = false;
  video.addEventListener('playing', () => {
    screenMaterial.map = videoTexture;
    toggleVideo.textContent = '暂停大屏';
    toggleVideo.setAttribute('aria-pressed', 'true');
  });
  video.addEventListener('pause', () => {
    toggleVideo.textContent = '播放大屏';
    toggleVideo.setAttribute('aria-pressed', 'false');
  });
  video.addEventListener('error', () => {
    screenMaterial.map = poster;
    toggleVideo.textContent = '重试播放';
    toggleVideo.setAttribute('aria-pressed', 'false');
  });
  async function playScreen() {
    if (playRequest || !wantsPlayback || document.hidden || contextLost) return;
    video.muted = true;
    if (!video.getAttribute('src') || video.error) video.src = video.dataset.src;
    const request = video.play();
    playRequest = request;
    try { await request; }
    catch { if (playRequest === request && !video.error) toggleVideo.textContent = '播放大屏'; }
    finally { if (playRequest === request) playRequest = null; }
  }
  function pauseScreen() {
    playRequest = null;
    video.pause();
  }
  function toggleScreen() {
    if (contextLost) return;
    wantsPlayback = (video.paused || Boolean(video.error)) && !playRequest;
    if (wantsPlayback) playScreen();
    else pauseScreen();
  }
  toggleVideo.addEventListener('click', toggleScreen);
  const cursor = new THREE.Vector2();
  const ray = new THREE.Raycaster();
  canvas.addEventListener('click', event => {
    const bounds = canvas.getBoundingClientRect();
    cursor.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
    ray.setFromCamera(cursor, camera);
    if (ray.intersectObject(display).length) toggleScreen();
  });

  const stars = [];
  for (let i = 0; i < 560; i++) {
    const angle = random() * Math.PI * 2;
    const radius = 32 + random() * 125;
    stars.push(Math.cos(angle) * radius, -18 + random() * 54, Math.sin(angle) * radius);
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3));
  scene.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({color: 0x91d6e1, size: .19, transparent: true, opacity: .65})));
  for (let strip = 0; strip < 12; strip++) {
    const points = [];
    for (let step = 0; step <= 70; step++) {
      const t = step / 70, x = -83 + 166 * t;
      points.push(new THREE.Vector3(x, 14 + Math.sin(t * 8 + strip * .07) * 6 + strip * .46, -62 + Math.sin(t * 5) * 9));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    scene.add(new THREE.Line(geometry, new THREE.LineBasicMaterial({
      color: strip < 7 ? 0x55dac0 : 0x807bf3,
      transparent: true, opacity: .13 + Math.sin(strip / 12 * Math.PI) * .17
    })));
  }

  const car = new THREE.Group();
  car.scale.setScalar(1.08);
  scene.add(car);
  const pearl = standard(0x648aff, {metalness: .5, roughness: .24});
  const carbon = standard(0x111827, {metalness: .25, roughness: .33});
  const glass = standard(0x172c48, {metalness: .47, roughness: .19});
  const brightEdge = standard(0x9bd9ff, {metalness: .58, roughness: .22});
  const rubber = standard(0x101523, {roughness: .93});
  const tailLight = neon(0xff3f87, 2.4);
  function sculptShell(sections, material) {
    const vertices = [], indices = [], sides = 6;
    for (const [z, width, base, crest] of sections) {
      const shoulder = base + (crest - base) * .48;
      for (const [x, y] of [[-width, base], [width, base], [width, shoulder],
        [width * .76, crest], [-width * .76, crest], [-width, shoulder]]) vertices.push(x, y, z);
    }
    for (let ring = 0; ring < sections.length - 1; ring++) {
      for (let side = 0; side < sides; side++) {
        const first = ring * sides + side, next = ring * sides + (side + 1) % sides;
        indices.push(first, next, first + sides, next, next + sides, first + sides);
      }
    }
    const end = (sections.length - 1) * sides;
    for (let side = 1; side < sides - 1; side++) indices.push(0, side + 1, side, end, end + side, end + side + 1);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    mesh(geometry, material, 0, 0, 0, car);
  }
  sculptShell([[-1.97, .77, .31, .54], [-1.66, 1.04, .31, .67], [-1.04, 1.12, .35, .9],
    [-.49, .99, .38, .92], [.42, 1.04, .37, .91], [1.14, 1.14, .33, .94], [1.76, 1.02, .32, .76]], pearl);
  sculptShell([[-.85, .63, .76, .79], [-.44, .69, .82, 1.11], [-.12, .64, .84, 1.35],
    [.43, .65, .83, 1.35], [.93, .72, .75, .98]], glass);
  sculptShell([[-.16, .53, 1.31, 1.35], [.02, .53, 1.33, 1.39], [.45, .53, 1.32, 1.36]], pearl);
  box(0, .34, -1.71, 1.7, .1, .56, carbon, car);
  box(0, .38, 1.68, 1.96, .19, .27, carbon, car);
  box(0, .65, 1.782, 1.58, .055, .038, tailLight, car);
  box(0, 1.02, 1.58, 1.95, .075, .27, pearl, car);
  const wheels = [];
  for (const side of [-1, 1]) {
    const headlight = box(side * .68, .64, -1.69, .58, .068, .046, neon(0xc9f9ff), car);
    headlight.rotation.y = side * .25;
    box(side * 1.015, .34, .02, .14, .16, 1.5, carbon, car);
    box(side * 1.095, .35, .02, .025, .035, 1.03, aqua, car);
    box(side * .68, .91, 1.59, .1, .19, .135, carbon, car);
    box(side * .77, .99, -.4, .23, .10, .21, pearl, car);
    for (const z of [-1.13, 1.17]) {
      const axle = new THREE.Group();
      axle.position.set(side * 1.045, .42, z);
      car.add(axle);
      mesh(new THREE.CylinderGeometry(.42, .42, .36, 24), rubber, 0, 0, 0, axle).rotation.z = Math.PI / 2;
      mesh(new THREE.CylinderGeometry(.30, .30, .365, 24), carbon, 0, 0, 0, axle).rotation.z = Math.PI / 2;
      mesh(new THREE.TorusGeometry(.282, .018, 8, 24), brightEdge, side * .187, 0, 0, axle).rotation.y = Math.PI / 2;
      for (let spoke = 0; spoke < 6; spoke++) {
        const angle = spoke * Math.PI / 3;
        const bar = box(side * .19, .165 * Math.cos(angle), .165 * Math.sin(angle), .022, .21, .037, brightEdge, axle);
        bar.rotation.x = angle;
      }
      mesh(new THREE.CylinderGeometry(.082, .082, .40, 12), brightEdge, 0, 0, 0, axle).rotation.z = Math.PI / 2;
      wheels.push(axle);
    }
  }
  const shadow = disk(0, .077, 0, 0, 1.65, light(0x152737, {transparent: true, opacity: .56}));
  shadow.scale.x = .8;
  car.position.copy(start);

  const keyboard = new Set();
  const touches = new Map();
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let velocity = 0, yaw = 0, nearby = -1;
  let previous = 0, animation = 0, overview = false;
  const cameraButton = document.getElementById('camera-toggle');
  cameraButton.addEventListener('click', () => {
    overview = !overview;
    cameraButton.textContent = overview ? '跟车' : '俯瞰';
  });
  function reset() {
    car.position.copy(start);
    velocity = 0;
    yaw = 0;
  }
  function held(key) {
    return keyboard.has(key) || [...touches.values()].includes(key);
  }
  function fit() {
    if (contextLost) return;
    const {clientWidth: width, clientHeight: height} = canvas;
    camera.aspect = width / Math.max(1, height);
    camera.fov = camera.aspect < .95 ? 56 : 43;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
  }
  function draw(time) {
    const dt = previous ? Math.min((time - previous) / 1000, .04) : 0;
    previous = time;
    const throttle = Number(held('ArrowUp')) - Number(held('ArrowDown'));
    const steering = Number(held('ArrowLeft')) - Number(held('ArrowRight'));
    const desiredSpeed = throttle * (throttle > 0 ? (held('Shift') ? 21 : 13) : 7);
    velocity = THREE.MathUtils.lerp(velocity, desiredSpeed, 1 - Math.exp(-dt * 5));
    yaw += steering * dt * 2.25 * (velocity < -.18 ? -1 : 1);
    car.position.x -= Math.sin(yaw) * velocity * dt;
    car.position.z -= Math.cos(yaw) * velocity * dt;
    const distance = Math.hypot(car.position.x, car.position.z);
    if (distance > surfaceRadius - 1.55) {
      car.position.multiplyScalar((surfaceRadius - 1.55) / distance);
      velocity *= .54;
    }
    for (const wheel of wheels) wheel.rotation.x -= velocity * dt / .42;
    car.rotation.y = yaw;
    shadow.position.set(car.position.x + .2, .077, car.position.z + .35);
    shadow.rotation.z = -yaw;

    const current = stops.findIndex(stop => Math.hypot(stop.x - car.position.x, stop.z - car.position.z) < 5.2);
    if (current !== nearby) {
      nearby = current;
      visit.hidden = current < 0;
      if (current >= 0) {
        visit.href = links[current].href;
        visit.textContent = '打开' + stops[current].name + ' ↗';
      }
    }
    if (!motion.matches) {
      for (const [i, item] of beacons.entries()) {
        item.rotation.y = time * .001;
        item.position.y = 5.25 + Math.sin(time * .0018 + i) * .34;
      }
      crystals.forEach((item, index) => {
        item.material.emissiveIntensity = .17 + .08 * Math.sin(time * .001 + index);
      });
    }

    target.set(car.position.x * .52 - 2, overview ? 1 : 3, car.position.z * .36 - 5.8);
    if (overview) view.set(target.x + 31, 47, target.z + 42);
    else view.set(target.x + 10, 20, target.z + 39);
    if (camera.aspect < .95) view.sub(target).multiplyScalar(1.45).add(target);
    if (dt && !motion.matches) camera.position.lerp(view, 1 - Math.exp(-dt * 5));
    else camera.position.copy(view);
    camera.lookAt(target);
    composer.render();
    animation = requestAnimationFrame(draw);
  }

  window.addEventListener('keydown', event => {
    if (contextLost || document.hidden) return;
    if (event.code === 'Enter' && nearby >= 0 && event.target === document.body) visit.click();
    if (inputCodes[event.code] && !['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) {
      event.preventDefault();
      keyboard.add(inputCodes[event.code]);
    }
  });
  window.addEventListener('keyup', event => { keyboard.delete(inputCodes[event.code]); });
  window.addEventListener('blur', () => { keyboard.clear(); touches.clear(); });
  function syncScene() {
    cancelAnimationFrame(animation);
    keyboard.clear();
    touches.clear();
    previous = 0;
    if (document.hidden || contextLost) {
      pauseScreen();
      return;
    }
    animation = requestAnimationFrame(draw);
    if (wantsPlayback) playScreen();
  }
  document.addEventListener('visibilitychange', syncScene);
  for (const button of document.querySelectorAll('[data-key]')) {
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      touches.set(event.pointerId, button.dataset.key);
    });
    for (const kind of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      button.addEventListener(kind, event => { touches.delete(event.pointerId); });
    }
  }
  document.getElementById('reset').addEventListener('click', reset);
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    contextLost = true;
    syncScene();
    driveUi.hidden = true;
    status.hidden = false;
    status.textContent = '3D 画面暂时中断，可先访问上方站点或刷新重试。';
  });
  canvas.addEventListener('webglcontextrestored', () => {
    contextLost = false;
    fit();
    driveUi.hidden = false;
    status.hidden = true;
    syncScene();
  });
  new ResizeObserver(fit).observe(canvas);
  fit();
  draw(performance.now());
  document.querySelector('.controls').hidden = false;
  document.querySelector('.drive-pad').hidden = false;
  status.hidden = true;
  requestAnimationFrame(() => { if (wantsPlayback) playScreen(); });
}
