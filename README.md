# Dice

A dice-rolling app for Android, built with React Native and Expo.

Pick a die (d4, d6, d8, d10, d12 or d20), choose a color, and throw it. The die is drawn as a real 3D solid. It tumbles, bounces and lands with the result facing you, then the rolled face lights up.

## Run it

You need [Node.js](https://nodejs.org) 20+ and the **Expo Go** app on your Android phone.

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go. Your phone and computer must be on the same Wi-Fi network.

To try it in a browser instead:

```bash
npx expo start --web
```

## Project layout

| File | What it does |
| --- | --- |
| `App.js` | Screens: die picker, color picker, and the roll screen with its animation |
| `src/Die.js` | Draws a die: projects the 3D faces, lights them, paints the numbers |
| `src/solids.js` | 3D geometry for each die, face numbering, and the resting pose for each result |
| `src/dice.js` | Die list, colors, random roll, color helpers |
| `src/digits.js` | Number outlines from the Lilita One font (generated, don't edit by hand) |

## How the dice work

- Each die is a list of 3D vertices and faces. Every frame, the die is rotated, faces turned away from the camera are skipped, and the rest are drawn as SVG polygons shaded by how much they face the light.
- Numbers are vector outlines mapped onto each face, so they tilt and shrink with the face.
- Opposite faces add up to sides + 1, like real dice. The d4 shows three numbers per face; the result is the one at the top point.
- A roll picks the result first, then spins the die around a random axis and slows it so it stops on that face.

## Build an APK

```bash
npx eas-cli@latest build -p android --profile preview
```

This needs a free [Expo account](https://expo.dev).

## License

MIT. The Lilita One font is under the SIL Open Font License.
