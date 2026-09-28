// Scalanie statycznej geometrii wg materiału – drastycznie zmniejsza liczbę wywołań rysowania
import * as THREE from 'three';

export function mergeByMaterial(root, { castShadow = true, receiveShadow = true } = {}) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const others = [];
  root.traverse((o) => {
    if (o.isMesh && !o.userData.keep && o.material && !Array.isArray(o.material) && o.material.visible !== false) {
      const key = o.material.uuid;
      if (!buckets.has(key)) buckets.set(key, { material: o.material, parts: [] });
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
      g.applyMatrix4(m);
      buckets.get(key).parts.push(g);
    } else if ((o.isLine || o.isLineSegments || o.isPoints || (o.isMesh && (o.userData.keep || o.material.visible === false))) && o !== root) {
      others.push(o);
    }
  });
  const out = new THREE.Group();
  for (const { material, parts } of buckets.values()) {
    const needColor = !!material.vertexColors;
    const needUv = !!material.map;
    let n = 0;
    for (const p of parts) n += p.attributes.position.count;
    const pos = new Float32Array(n * 3);
    const col = needColor ? new Float32Array(n * 3) : null;
    const uv = needUv ? new Float32Array(n * 2) : null;
    let off = 0;
    for (const p of parts) {
      const c = p.attributes.position.count;
      pos.set(p.attributes.position.array.subarray(0, c * 3), off * 3);
      if (col && p.attributes.color) col.set(p.attributes.color.array.subarray(0, c * 3), off * 3);
      if (uv && p.attributes.uv) uv.set(p.attributes.uv.array.subarray(0, c * 2), off * 2);
      off += c;
      p.dispose();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    if (col) g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (uv) g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, material);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    out.add(mesh);
  }
  // linie i obiekty specjalne przenosimy bez zmian (z zachowaniem transformacji)
  for (const o of others) {
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    o.parent.remove(o);
    o.matrix.copy(m);
    o.matrix.decompose(o.position, o.quaternion, o.scale);
    out.add(o);
  }
  return out;
}
