// Homepage hero: the NeonKey key as a real-time 3D object (Three.js, MIT). Loaded only on the homepage, only on
// wider screens with WebGL and without prefers-reduced-motion (see HeroStage.astro). If anything fails, the SVG key
// in HeroStage stays visible, so the hero never ends up empty.
// Self-hosted (bundled by Astro), so the CSP stays script-src 'self'. No textures or HDR files: the reflections come
// from three's RoomEnvironment, generated in the browser.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, TorusGeometry, CylinderGeometry, SphereGeometry,
  MeshPhysicalMaterial, MeshBasicMaterial, PointLight, PMREMGenerator, ACESFilmicToneMapping, SRGBColorSpace, Color,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export function mountHeroKey(stage: HTMLElement, canvas: HTMLCanvasElement): () => void {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;

  const camera = new PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 11);

  // Dark chrome with an iridescent clear coat: picks up the cyan / violet / magenta lights as moving color.
  const body = new MeshPhysicalMaterial({
    color: new Color('#3a3f72'), metalness: 0.88, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.08,
    iridescence: 1, iridescenceIOR: 1.35, iridescenceThicknessRange: [180, 620], envMapIntensity: 1.25,
  });
  const key = new Group();
  const bow = new Mesh(new TorusGeometry(1, 0.34, 64, 160), body);
  const shaft = new Mesh(new CylinderGeometry(0.22, 0.22, 3.5, 48, 1), body);
  shaft.rotation.z = Math.PI / 2; shaft.position.x = 3.0;
  const tip = new Mesh(new SphereGeometry(0.22, 48, 24), body); tip.position.x = 4.75;
  const t1 = new Mesh(new RoundedBoxGeometry(0.36, 0.95, 0.36, 5, 0.1), body); t1.position.set(3.85, -0.48, 0);
  const t2 = new Mesh(new RoundedBoxGeometry(0.36, 0.62, 0.36, 5, 0.1), body); t2.position.set(4.45, -0.32, 0);
  const dot = new Mesh(new SphereGeometry(0.2, 32, 16), new MeshBasicMaterial({ color: new Color('#ff5cbd') }));
  key.add(bow, shaft, tip, t1, t2, dot);
  key.position.x = -1.7;
  const rig = new Group(); rig.add(key); rig.rotation.set(0.28, -0.5, -0.16);
  scene.add(rig);

  const lights: [string, number, [number, number, number]][] = [
    ['#22d3ee', 140, [-5, 2.5, 4]], ['#f472b6', 130, [5.5, -2, 3.5]], ['#a78bfa', 110, [0, 5, -2]], ['#22d3ee', 70, [3, 4, 2]], ['#ffffff', 25, [2, 3, 6]],
  ];
  for (const [c, i, p] of lights) { const l = new PointLight(c, i, 30, 1.6); l.position.set(...p); scene.add(l); }

  // Pointer parallax (damped) and a slow idle turn.
  let tx = 0, ty = 0, cx = 0, cy = 0;
  const onMove = (e: PointerEvent) => { tx = (e.clientX / window.innerWidth - 0.5) * 2; ty = (e.clientY / window.innerHeight - 0.5) * 2; };
  window.addEventListener('pointermove', onMove, { passive: true });

  const resize = () => {
    const { width, height } = stage.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.position.z = camera.aspect < 1.1 ? 13 : 11;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize); ro.observe(stage); resize();

  let visible = true, raf = 0, t0 = performance.now();
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) loop(); }, { threshold: 0 });
  io.observe(stage);
  const loop = () => {
    raf = 0;
    if (!visible || document.hidden) return;
    const t = (performance.now() - t0) / 1000;
    cx += (tx - cx) * 0.05; cy += (ty - cy) * 0.05;
    const s = Math.min(window.scrollY / 600, 1);
    rig.rotation.y = -0.5 + Math.sin(t * 0.35) * 0.22 + cx * 0.35 + s * 0.6;
    rig.rotation.x = 0.28 + Math.sin(t * 0.5) * 0.06 + cy * 0.2;
    rig.position.y = Math.sin(t * 0.8) * 0.12 + s * 0.8;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  };
  const onVis = () => { if (!document.hidden && !raf) loop(); };
  document.addEventListener('visibilitychange', onVis);
  loop();
  stage.classList.add('is-gl');

  return () => {
    cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
    window.removeEventListener('pointermove', onMove); document.removeEventListener('visibilitychange', onVis);
    renderer.dispose(); env.dispose(); pmrem.dispose();
  };
}
