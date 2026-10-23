import { useMemo } from 'react';
import Svg, { G, Path, Polygon } from 'react-native-svg';
import { shade, textColorFor } from './dice';
import { DIGITS } from './digits';
import { apply, cross, dot, getModel, norm, restingPose } from './solids';

export const DICE_FONT = 'LilitaOne_400Regular';

const LIGHT = norm([-0.45, 0.65, 0.8]);

// Outline of a number, centred on (0,0), 1 unit tall, y pointing down.
// 6 and 9 get an underline so they can be told apart.
const shapes = {};
function numberShape(n, underline) {
  const key = `${n}${underline ? '_' : ''}`;
  if (shapes[key]) return shapes[key];
  const chars = String(n).split('');
  let x = 0;
  const parts = chars.map((ch) => {
    const g = DIGITS[ch];
    const part = { g, dx: x };
    x += g.w;
    return part;
  });
  const left = parts[0].g.x0;
  const right = parts[parts.length - 1].dx + parts[parts.length - 1].g.x1;
  const shiftX = -(left + right) / 2;
  const cmds = [];
  for (const { g, dx } of parts) {
    for (const c of g.cmds) {
      const out = [c[0]];
      for (let i = 1; i < c.length; i += 2) out.push(c[i] + dx + shiftX, c[i + 1] + 0.5);
      cmds.push(out);
    }
  }
  const width = right - left;
  if (underline) {
    const w = width / 2, y0 = 0.62, y1 = 0.74;
    cmds.push(['M', -w, y0], ['L', w, y0], ['L', w, y1], ['L', -w, y1], ['Z']);
  }
  return (shapes[key] = { cmds, width });
}

// Map shape coordinates through an affine transform into an SVG path string.
function toPath(cmds, a, b, c, d, e, f) {
  let s = '';
  for (const cmd of cmds) {
    s += cmd[0];
    for (let i = 1; i < cmd.length; i += 2) {
      const x = cmd[i], y = cmd[i + 1];
      s += `${(a * x + c * y + e).toFixed(1)} ${(b * x + d * y + f).toFixed(1)} `;
    }
  }
  return s;
}

// A die drawn as a real 3D solid: faces are rotated by `pose` (3x3 rotation),
// projected straight onto the screen, lit from the upper left, and the numbers
// are painted onto each face so they tilt and foreshorten with it.
export default function Die({ sides, color, value, pose, highlight = false, size = 120 }) {
  const model = getModel(sides);
  const rest = useMemo(() => restingPose(sides, value), [sides, value]);
  const M = pose ?? rest;

  const S = size * 0.46;
  const cx = size / 2, cy = size / 2;
  const project = (p) => [cx + S * p[0], cy - S * p[1]];
  const edge = shade(color, -0.55);
  const ink = textColorFor(color);
  const stroke = Math.max(1, size / 140);

  const faces = [];
  const numbers = [];
  let hitOutline = null;
  model.faces.forEach((face, fi) => {
    const n = apply(M, face.n);
    if (n[2] <= 0.01) return; // facing away

    const pts = face.pts.map((p) => project(apply(M, p)).map((v) => v.toFixed(1)).join(',')).join(' ');
    const light = Math.max(0, dot(n, LIGHT));
    // The rolled face lights up once the die has landed (on a d4 only its numbers do).
    const hit = highlight && sides !== 4 && face.labels[0].value === value;
    if (hit) {
      hitOutline = <Polygon points={pts} fill="#FFFFFF" fillOpacity={0.12} stroke="#FFFFFF" strokeOpacity={0.9} strokeWidth={stroke * 2.5} strokeLinejoin="round" />;
    }
    faces.push(
      <Polygon
        key={fi}
        points={pts}
        fill={shade(color, Math.min(hit ? 0.35 : 0.22, -0.5 + 0.75 * light + (hit ? 0.2 : 0)))}
        stroke={edge}
        strokeWidth={stroke}
        strokeLinejoin="round"
      />
    );

    for (const [li, label] of face.labels.entries()) {
      const shape = numberShape(label.value, sides >= 9 && (label.value === 6 || label.value === 9));
      const h = Math.min(label.room, (label.room * 1.6) / shape.width);
      const P = apply(M, label.pos);
      const U = apply(M, label.up);
      const R = apply(M, cross(label.up, face.n));
      const lit = highlight && label.value === value;
      const k = S * h * (lit ? 1.15 : 1);
      const d = toPath(shape.cmds, k * R[0], -k * R[1], -k * U[0], k * U[1], cx + S * P[0], cy - S * P[1]);
      if (lit) {
        numbers.push(<Path key={`${fi}-${li}-glow`} d={d} fill="none" stroke="#FFFFFF" strokeOpacity={0.45} strokeWidth={k * 0.22} strokeLinejoin="round" />);
      }
      numbers.push(<Path key={`${fi}-${li}`} d={d} fill={ink} fillOpacity={Math.min(1, n[2] * 4)} />);
    }
  });

  return (
    <Svg width={size} height={size}>
      <G>{faces}</G>
      {hitOutline}
      <G>{numbers}</G>
    </Svg>
  );
}
