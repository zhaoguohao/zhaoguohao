import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.min.js';

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
  const links = [...document.querySelectorAll('[data-stop]')];
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080e1c);
  scene.fog = new THREE.FogExp2(0x080e1c, .008);
  const camera = new THREE.PerspectiveCamera(43, 1, .2, 250);
  const target = new THREE.Vector3();
  const view = new THREE.Vector3();
  const sky = new THREE.HemisphereLight(0xd3f2ff, 0x4b416c, 2);
  const sun = new THREE.DirectionalLight(0xffddb1, 2.25);
  sun.position.set(-30, 36, -18);
  scene.add(sky, sun);

  const standard = (color, extra = {}) => new THREE.MeshStandardMaterial({color, roughness: .84, ...extra});
  const light = (color, extra = {}) => new THREE.MeshBasicMaterial({color, ...extra});
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
  mesh(new THREE.CylinderGeometry(30.3, 24, 4.3, 24), standard(0x183e4a, {flatShading: true}), 0, -2.18, 0);
  disk(0, .012, 0, 0, 30, standard(0x2d6065));
  disk(0, .025, 0, 13.8, 23.6, standard(0x253449));
  disk(0, .037, 0, 13.8, 14, light(0x58818e));
  disk(0, .037, 0, 23.4, 23.6, light(0x58818e));
  disk(0, .03, 0, 29.5, 29.8, light(0x6dc9ce));
  for (let i = 0; i < 36; i++) {
    const angle = i * Math.PI / 18;
    const stripe = box(Math.cos(angle) * 18.7, .045, Math.sin(angle) * 18.7, .16, .018, .9, light(0x8196a7));
    stripe.rotation.y = -angle;
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

  const trunk = standard(0x60516c);
  const foliage = [standard(0x377772), standard(0x4c9c85), standard(0x6580a3)];
  const cone = new THREE.ConeGeometry(1, 2, 5);
  for (let i = 0; i < 58; i++) {
    const angle = random() * Math.PI * 2;
    const radius = i < 40 ? 25.9 + random() * 3.2 : 7.5 + random() * 4.5;
    const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
    const height = .7 + random() * 1.15;
    const shadow = disk(x + .3, .045, z + .35, 0, height * .68, light(0x28535a));
    shadow.scale.y = .65;
    box(x, height * .37, z, .16, height * .74, .16, trunk);
    const tree = mesh(cone, foliage[i % foliage.length], x, height * 1.18, z);
    tree.scale.set(height * .56, height * .76, height * .56);
    tree.rotation.y = random() * Math.PI;
  }

  const beacons = [];
  for (const [index, stop] of stops.entries()) {
    const {x, z, color} = stop;
    disk(x, .055, z, 0, 3.3, standard(0x32445b));
    disk(x, .066, z, 2.96, 3.18, light(color));
    const base = standard(0x4b6076);
    const shine = light(color);
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
  scene.add(car);
  const orange = standard(0xffa44d);
  const glass = standard(0x294e63, {metalness: .25});
  const rubber = standard(0x182230);
  box(0, .68, 0, 1.94, .59, 3.1, orange, car);
  box(0, 1.16, .28, 1.47, .66, 1.39, glass, car);
  box(0, 1.51, .27, 1.55, .12, 1.48, orange, car);
  const wheels = [];
  for (const x of [-1, 1]) {
    box(x * .61, .77, -1.57, .36, .23, .07, light(0xe8fff4), car);
    box(x * .65, .74, 1.57, .29, .18, .07, light(0xff647e), car);
    for (const z of [-.92, .98]) {
      const axle = new THREE.Group();
      axle.position.set(x * 1.02, .42, z);
      car.add(axle);
      mesh(new THREE.CylinderGeometry(.42, .42, .35, 12), rubber, 0, 0, 0, axle).rotation.z = Math.PI / 2;
      mesh(new THREE.CylinderGeometry(.22, .22, .355, 10), orange, 0, 0, 0, axle).rotation.z = Math.PI / 2;
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
  let previous = 0, animation = 0;
  function reset() {
    car.position.copy(start);
    velocity = 0;
    yaw = 0;
  }
  function held(key) {
    return keyboard.has(key) || [...touches.values()].includes(key);
  }
  function fit() {
    const {clientWidth: width, clientHeight: height} = canvas;
    camera.aspect = width / Math.max(1, height);
    camera.fov = camera.aspect < .95 ? 56 : 43;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
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

    target.set(car.position.x * .38, 0, car.position.z * .38);
    view.set(target.x + 34, 47, target.z + 41);
    if (camera.aspect < .95) view.multiplyScalar(1.27);
    if (dt && !motion.matches) camera.position.lerp(view, 1 - Math.exp(-dt * 5));
    else camera.position.copy(view);
    camera.lookAt(target);
    renderer.render(scene, camera);
    animation = requestAnimationFrame(draw);
  }

  window.addEventListener('keydown', event => {
    if (event.code === 'Enter' && nearby >= 0 && event.target === document.body) visit.click();
    if (inputCodes[event.code] && !['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) {
      event.preventDefault();
      keyboard.add(inputCodes[event.code]);
    }
  });
  window.addEventListener('keyup', event => { keyboard.delete(inputCodes[event.code]); });
  window.addEventListener('blur', () => { keyboard.clear(); touches.clear(); });
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(animation);
    keyboard.clear();
    touches.clear();
    previous = 0;
    if (!document.hidden) animation = requestAnimationFrame(draw);
  });
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
    cancelAnimationFrame(animation);
    status.hidden = false;
    status.textContent = '3D 画面已暂停。可以刷新重试，或直接打开站点链接。';
  });
  new ResizeObserver(fit).observe(canvas);
  fit();
  draw(performance.now());
  document.querySelector('.controls').hidden = false;
  document.querySelector('.drive-pad').hidden = false;
  status.hidden = true;
}
