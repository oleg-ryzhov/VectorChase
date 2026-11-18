import * as THREE from 'three';

// A small studio-style sky (gradient plus a few bright light panels) that the car's paint, glass and
// alloys reflect. Without it metallic paint has nothing to mirror and looks flat and dark.
// Only the car materials use it, so the rest of the scene looks the same as before.
export function createCarEnvironment(renderer) {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#4f7fcf');
  grad.addColorStop(0.45, '#dbe7f5');
  grad.addColorStop(0.5, '#8a93a0');
  grad.addColorStop(0.56, '#23262c');
  grad.addColorStop(1, '#101215');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const sky = new THREE.CanvasTexture(canvas);
  sky.colorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({ map: sky, side: THREE.BackSide })));

  const panel = (w, h, d, x, y, z, power) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    m.material.color.multiplyScalar(power);
    m.position.set(x, y, z);
    scene.add(m);
  };
  panel(30, 0.5, 3, 0, 20, 0, 6); // overhead strip
  panel(0.5, 8, 22, -22, 8, 0, 3.5); // left window
  panel(0.5, 8, 22, 22, 8, 0, 3.5); // right window
  panel(14, 6, 0.5, 0, 6, -26, 3); // front

  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(scene, 0.03);
  pmrem.dispose();
  sky.dispose();
  return target.texture;
}
