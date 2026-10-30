import {
  ACESFilmicToneMapping,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  ShadowMaterial,
  SRGBColorSpace,
  WebGLRenderer,
  type Material,
  type Texture,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

// خشبة العرض المشتركة بين عارض العبوة وعارض العلبة: إضاءة استوديو، كاميرا، تحكم، ظل،
// ورسم عند الحاجة فقط (يتوقف حين يسكن المشهد أو يخرج من الشاشة).

export interface Stage {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  controls: OrbitControls;
  /** مجموعة المنتج — كل ما يُصدَّر إلى GLB */
  product: Group;
  env: Texture;
  /** يؤطّر الكاميرا على جسم بارتفاع وعرض (بالمتر) */
  frame: (height: number, width: number) => void;
  /** يطلب رسم إطار (بعد أي تغيير في المشهد) */
  invalidate: () => void;
  /** دالة تُستدعى كل إطار قبل الرسم؛ تعيد true إن غيّرت المشهد (للحركات) */
  onTick: (fn: ((dt: number) => boolean) | null) => void;
  dispose: () => void;
}

export function disposeGroup(g: Group) {
  g.traverse((o) => {
    if (o instanceof Mesh) {
      o.geometry.dispose();
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m: Material & { map?: Texture | null }) => {
        m.map?.dispose();
        m.dispose();
      });
    }
  });
  g.clear();
}

export function createStage(el: HTMLElement): Stage {
  const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.domElement.setAttribute("role", "presentation");
  renderer.domElement.style.display = "block";
  el.appendChild(renderer.domElement);

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  pmrem.dispose();

  const camera = new PerspectiveCamera(28, 1, 0.01, 10);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minPolarAngle = 0.25;
  controls.maxPolarAngle = Math.PI / 2 - 0.02;
  controls.autoRotateSpeed = 1.6;

  scene.add(new HemisphereLight(0xffffff, 0xd9d2c5, 0.6));
  const key = new DirectionalLight(0xffffff, 2.2);
  key.position.set(0.35, 0.6, 0.4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.radius = 6;
  key.shadow.bias = -0.0004;
  const sc = key.shadow.camera;
  sc.left = sc.bottom = -0.25;
  sc.right = sc.top = 0.25;
  sc.near = 0.1;
  sc.far = 2;
  scene.add(key);
  const rim = new DirectionalLight(0xfff4e6, 1.2);
  rim.position.set(-0.4, 0.3, -0.5);
  scene.add(rim);

  const ground = new Mesh(new PlaneGeometry(2, 2), new ShadowMaterial({ opacity: 0.16 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const product = new Group();
  product.name = "product";
  scene.add(product);

  // تُعرَّف قبل frame وresize لأنهما يكتبان فيها فوراً
  let dirty = true;
  let visible = true;
  let tick: ((dt: number) => boolean) | null = null;
  const frame = (height: number, width: number) => {
    const size = Math.max(height, width * 1.4);
    const dist = (size / 2 / Math.tan((camera.fov * Math.PI) / 360)) * 1.35;
    controls.target.set(0, height / 2, 0);
    camera.position.set(dist * 0.28, height * 0.62, dist);
    camera.near = dist / 50;
    camera.far = dist * 20;
    camera.updateProjectionMatrix();
    dirty = true;
    controls.minDistance = dist * 0.45;
    controls.maxDistance = dist * 2.2;
    controls.update();
  };

  const resize = () => {
    const w = el.clientWidth || 1, h = el.clientHeight || 1;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    dirty = true;
  };
  const ro = new ResizeObserver(resize);
  ro.observe(el);
  resize();

  // الرسم عند الحاجة فقط — الزجاج يكلّف تمريرتَي رسم لكل إطار، والرسم المستمر يستهلك البطارية
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) dirty = true;
  });
  io.observe(el);
  controls.addEventListener("change", () => (dirty = true));
  let raf = 0;
  let last = performance.now();
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!visible) return;
    const animating = tick ? tick(dt) : false;
    const moved = controls.update();
    if (moved || dirty || animating) {
      dirty = false;
      renderer.render(scene, camera);
    }
  };
  raf = requestAnimationFrame(loop);

  return {
    renderer,
    scene,
    camera,
    controls,
    product,
    env,
    frame,
    invalidate: () => {
      dirty = true;
    },
    onTick: (fn) => {
      tick = fn;
      dirty = true;
    },
    dispose: () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      controls.dispose();
      disposeGroup(product);
      ground.geometry.dispose();
      (ground.material as Material).dispose();
      env.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
