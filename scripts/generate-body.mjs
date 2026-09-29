// Original schematic anatomy asset; no external models or medical scans are used.
// The signed-distance surface blends simple anatomical volumes into a continuous shell.
import { mkdir, writeFile } from 'node:fs/promises';
import { BufferAttribute, BufferGeometry, Matrix4, Mesh, MeshStandardMaterial } from 'three';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

const shapes = [];
function ellipsoid(cx, cy, cz, rx, ry, rz) {
  shapes.push(
    (x, y, z) =>
      (Math.sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2) - 1) *
      Math.min(rx, ry, rz),
  );
}
function capsule(a, b, ra, rb) {
  const v = b.map((p, i) => p - a[i]),
    length = v.reduce((sum, p) => sum + p * p, 0);
  shapes.push((x, y, z) => {
    const p = [x - a[0], y - a[1], z - a[2]];
    const t = Math.min(1, Math.max(0, (p[0] * v[0] + p[1] * v[1] + p[2] * v[2]) / length));
    return Math.hypot(p[0] - v[0] * t, p[1] - v[1] * t, p[2] - v[2] * t) - ra - (rb - ra) * t;
  });
}
ellipsoid(0, 2.61, 0, 0.33, 0.46, 0.29);
ellipsoid(0, 2.36, 0.055, 0.25, 0.23, 0.225);
ellipsoid(0, 2.5, 0.275, 0.048, 0.09, 0.067);
capsule([0, 1.7, 0], [0, 2.28, 0], 0.22, 0.16);
ellipsoid(0, 1.25, 0, 0.77, 0.57, 0.34);
ellipsoid(0, 0.54, 0, 0.53, 0.65, 0.28);
ellipsoid(0, -0.35, 0, 0.59, 0.48, 0.33);
for (const side of [-1, 1]) {
  ellipsoid(side * 0.332, 2.57, 0, 0.048, 0.115, 0.072);
  ellipsoid(side * 0.76, 1.49, 0, 0.245, 0.26, 0.23);
  capsule([side * 0.83, 1.44, 0], [side * 1.12, 0.58, 0], 0.195, 0.13);
  capsule([side * 1.12, 0.58, 0], [side * 1.39, -0.31, 0.04], 0.151, 0.083);
  ellipsoid(side * 1.43, -0.49, 0.04, 0.125, 0.22, 0.068);
  for (let f = 0; f < 4; f++)
    capsule(
      [side * (1.34 + f * 0.055), -0.61, 0.04],
      [side * (1.36 + f * 0.063), -0.85 + Math.abs(f - 1) * 0.035, 0.04],
      0.025,
      0.022,
    );
  capsule([side * 1.33, -0.42, 0.05], [side * 1.24, -0.64, 0.08], 0.045, 0.03);
  capsule([side * 0.31, -0.5, 0], [side * 0.34, -1.8, 0.01], 0.27, 0.155);
  capsule([side * 0.34, -1.8, 0], [side * 0.34, -2.83, 0], 0.15, 0.087);
  ellipsoid(side * 0.34, -2.14, -0.035, 0.184, 0.37, 0.183);
  ellipsoid(side * 0.34, -2.96, 0.125, 0.13, 0.13, 0.28);
}
const resolution = 100;
const material = new MeshStandardMaterial({ color: '#b9d0c2', roughness: 0.55 });
const marching = new MarchingCubes(resolution, material, false, false, 100000);
for (let z = 0; z < resolution; z++)
  for (let y = 0; y < resolution; y++)
    for (let x = 0; x < resolution; x++) {
      const xx = ((x / resolution) * 2 - 1) * 1.8,
        yy = ((y / resolution) * 2 - 1) * 3.4,
        zz = ((z / resolution) * 2 - 1) * 0.8;
      let distance = Infinity;
      for (const shape of shapes) {
        const next = shape(xx, yy, zz),
          k = 0.065;
        const h = Math.max(k - Math.abs(distance - next), 0) / k;
        distance = Math.min(distance, next) - (h * h * h * k) / 6;
      }
      marching.field[x + y * resolution + z * resolution * resolution] = 80 - distance * 100;
    }
marching.update();
const geometry = new BufferGeometry();
for (const name of ['position', 'normal'])
  geometry.setAttribute(
    name,
    new BufferAttribute(marching.geometry.getAttribute(name).array.slice(0, marching.count * 3), 3),
  );
geometry.applyMatrix4(new Matrix4().makeScale(1.8, 3.4, 0.8));
geometry.computeBoundingBox();
const mesh = new Mesh(mergeVertices(geometry, 0.0001), material);
mesh.name = 'BodyShell';
globalThis.FileReader = class {
  async readAsArrayBuffer(blob) {
    this.result = await blob.arrayBuffer();
    this.onloadend?.();
  }
};
const glb = await new GLTFExporter().parseAsync(mesh, { binary: true });
await mkdir('public/models', { recursive: true });
await writeFile('public/models/body-shell.glb', Buffer.from(glb));
console.log(
  `Generated original schematic shell: ${marching.count / 3} triangles, ${glb.byteLength} bytes`,
);
