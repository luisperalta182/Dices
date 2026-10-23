// 3D geometry for each die: vertices, faces, where each number sits, and the
// orientation that shows a given value to the viewer.

// ---- tiny vector / matrix helpers (3x3 matrices as arrays of rows) ----
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a) => Math.sqrt(dot(a, a));
export const norm = (a) => mul(a, 1 / len(a));
const avg = (list) => mul(list.reduce(add, [0, 0, 0]), 1 / list.length);

export const apply = (m, v) => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];
export const matMul = (a, b) => a.map((row) => [0, 1, 2].map((j) => row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j]));

export function axisAngle(axis, angle) {
  const [x, y, z] = axis;
  const c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
  return [
    [t * x * x + c, t * x * y - s * z, t * x * z + s * y],
    [t * x * y + s * z, t * y * y + c, t * y * z - s * x],
    [t * x * z - s * y, t * y * z + s * x, t * z * z + c],
  ];
}

const deg = Math.PI / 180;
const rotX = (a) => axisAngle([1, 0, 0], a * deg);
const rotY = (a) => axisAngle([0, 1, 0], a * deg);

// Camera looks a little from above and from the right so side faces show.
const VIEW = matMul(rotX(14), rotY(-12));
const VIEW_D4 = matMul(rotX(72), rotY(-15));

// ---- raw solids ----
const PHI = (1 + Math.sqrt(5)) / 2;
const near = (a, b) => Math.abs(a - b) < 1e-6;

function triplesWithEdge(verts, edge) {
  const faces = [];
  const n = verts.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      for (let k = j + 1; k < n; k++)
        if (near(len(sub(verts[i], verts[j])), edge) && near(len(sub(verts[j], verts[k])), edge) && near(len(sub(verts[i], verts[k])), edge))
          faces.push([i, j, k]);
  return faces;
}

function tetra() {
  const v = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
  return { v, f: [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]] };
}

function cube() {
  const v = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) v.push([x, y, z]);
  const f = [];
  for (let a = 0; a < 3; a++)
    for (const s of [-1, 1]) f.push(v.map((p, i) => (p[a] === s ? i : -1)).filter((i) => i >= 0));
  return { v, f };
}

function octa() {
  const v = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const f = [];
  for (const x of [0, 1]) for (const y of [2, 3]) for (const z of [4, 5]) f.push([x, y, z]);
  return { v, f };
}

function ico() {
  const v = [];
  for (const a of [-1, 1]) for (const b of [-PHI, PHI]) v.push([0, a, b], [a, b, 0], [b, 0, a]);
  return { v, f: triplesWithEdge(v, 2) };
}

function dodeca() {
  // Dual of the icosahedron: one vertex per ico face, one face per ico vertex.
  const { v: iv, f: ifaces } = ico();
  const v = ifaces.map((face) => avg(face.map((i) => iv[i])));
  const f = iv.map((_, vi) => ifaces.map((face, fi) => (face.includes(vi) ? fi : -1)).filter((i) => i >= 0));
  return { v, f };
}

function trapezohedron() {
  // Pentagonal trapezohedron (d10). Pole height chosen so every kite is planar.
  const c = 0.1;
  const h = (c * (1 + Math.cos(36 * deg))) / (1 - Math.cos(36 * deg));
  const v = [[0, h, 0], [0, -h, 0]];
  for (let k = 0; k < 5; k++) {
    const a = 72 * k * deg, b = (72 * k + 36) * deg;
    v.push([Math.cos(a), c, Math.sin(a)], [Math.cos(b), -c, Math.sin(b)]);
  }
  const U = (k) => 2 + 2 * (k % 5), L = (k) => 3 + 2 * (k % 5);
  const f = [];
  // First vertex of each kite is its pole, so numbers point toward it.
  for (let k = 0; k < 5; k++) f.push([0, U(k + 1), L(k), U(k)]);
  for (let k = 0; k < 5; k++) f.push([1, L(k), U(k + 1), L(k + 1)]);
  return { v, f, keepFirst: true };
}

// ---- build a die model ----
// Sort a face's vertices counter-clockwise when seen from outside.
function orderFace(verts, face, keepFirst) {
  const pts = face.map((i) => verts[i]);
  const c = avg(pts);
  const n = norm(c);
  const e1 = norm(sub(pts[0], c));
  const e2 = cross(n, e1);
  const ang = (p) => Math.atan2(dot(sub(p, c), e2), dot(sub(p, c), e1));
  const sorted = [...face].sort((a, b) => ang(verts[a]) - ang(verts[b]));
  if (keepFirst) {
    const i = sorted.indexOf(face[0]);
    return [...sorted.slice(i), ...sorted.slice(0, i)];
  }
  return sorted;
}

// Distance from point p to segment-line a-b (all on one plane).
function lineDist(p, a, b) {
  const d = norm(sub(b, a));
  const ap = sub(p, a);
  return len(sub(ap, mul(d, dot(ap, d))));
}

function build(sides) {
  const raw = { 4: tetra, 6: cube, 8: octa, 10: trapezohedron, 12: dodeca, 20: ico }[sides]();
  const r = Math.max(...raw.v.map(len));
  const verts = raw.v.map((p) => mul(p, 1 / r));

  const faces = raw.f.map((face) => {
    const idx = orderFace(verts, face, raw.keepFirst);
    const pts = idx.map((i) => verts[i]);
    let n = norm(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0])));
    if (dot(n, avg(pts)) < 0) n = mul(n, -1);
    return { idx, pts, n, c: avg(pts) };
  });

  // Inscribed distance from p to the face's edges: how big a number can be there.
  const room = (face, p) => Math.min(...face.pts.map((a, i) => lineDist(p, a, face.pts[(i + 1) % face.pts.length])));

  if (sides === 4) {
    // Real d4: each face shows the number of each corner, written near that corner.
    // The result is the number at the top vertex.
    const vertexValue = verts.map((_, i) => i + 1);
    faces.forEach((face) => {
      face.labels = face.idx.map((vi) => {
        const pos = add(face.c, mul(sub(verts[vi], face.c), 0.42));
        return { pos, up: norm(sub(verts[vi], face.c)), value: vertexValue[vi], room: room(face, pos) * 1.15 };
      });
    });
    return { verts, faces, vertexValue };
  }

  // Opposite faces add up to sides + 1, like real dice.
  const values = new Array(faces.length).fill(0);
  let next = 1;
  faces.forEach((face, i) => {
    if (values[i]) return;
    const j = faces.findIndex((g, k) => k !== i && !values[k] && dot(g.n, face.n) < -0.999);
    values[i] = next;
    if (j >= 0) values[j] = sides + 1 - next;
    next++;
  });

  faces.forEach((face, i) => {
    const p = face.pts;
    let up;
    if (sides === 6) up = norm(sub(mul(add(p[0], p[1]), 0.5), face.c)); // toward an edge
    else up = norm(sub(p[0], face.c)); // toward a vertex (the pole on a d10)
    // On the d10, nudge the number toward the wide part of the kite.
    const pos = sides === 10 ? add(face.c, mul(sub(p[0], face.c), 0.12)) : face.c;
    face.labels = [{ pos, up, value: values[i], room: room(face, pos) }];
  });
  return { verts, faces };
}

const cache = {};
export function getModel(sides) {
  return (cache[sides] ??= build(sides));
}

// Orientation (3x3 rotation) that shows `value` to the viewer, upright.
export function restingPose(sides, value) {
  const model = getModel(sides);
  if (sides === 4) {
    const vi = model.vertexValue.indexOf(value);
    const y = norm(model.verts[vi]);
    const w = model.verts[(vi + 1) % 4];
    const z = norm(mul(sub(w, mul(y, dot(w, y))), -1));
    return matMul(VIEW_D4, [cross(y, z), y, z]);
  }
  const face = model.faces.find((f) => f.labels[0].value === value);
  const { up } = face.labels[0];
  return matMul(VIEW, [cross(up, face.n), up, face.n]);
}
