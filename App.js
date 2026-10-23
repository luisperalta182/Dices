import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useFonts, LilitaOne_400Regular } from '@expo-google-fonts/lilita-one';
import Die, { DICE_FONT } from './src/Die';
import { COLORS, DICE, onDark, rollDie } from './src/dice';
import { axisAngle, matMul, norm, restingPose } from './src/solids';

const BG = '#12131A';
const CARD = '#1D1F2B';
const MUTED = '#8A8FA3';

export default function App() {
  const [sides, setSides] = useState(20);
  const [color, setColor] = useState(COLORS[0].hex);
  const [rolling, setRolling] = useState(false);
  const [fontsLoaded] = useFonts({ LilitaOne_400Regular });

  if (!fontsLoaded) return <View style={styles.safe} />;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          {rolling ? (
            <RollScreen sides={sides} color={color} onBack={() => setRolling(false)} />
          ) : (
            <PickScreen
              sides={sides}
              color={color}
              onSides={setSides}
              onColor={setColor}
              onRoll={() => setRolling(true)}
            />
          )}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function PickScreen({ sides, color, onSides, onColor, onRoll }) {
  const { width } = useWindowDimensions();
  const cardSize = (Math.min(width, 480) - 24 * 2 - 12 * 2) / 3;

  return (
    <View style={styles.flex}>
      <Text style={styles.title}>Dice</Text>
      <Text style={styles.subtitle}>Pick your die</Text>

      <View style={styles.grid}>
        {DICE.map((d) => {
          const selected = d === sides;
          return (
            <Pressable
              key={d}
              onPress={() => onSides(d)}
              style={({ pressed }) => [
                styles.card,
                { width: cardSize, height: cardSize * 1.2 },
                selected && { borderColor: onDark(color), backgroundColor: '#262938' },
                pressed && { transform: [{ scale: 0.95 }] },
              ]}
            >
              <Die sides={d} color={selected ? color : '#4A4E63'} value={d} size={cardSize * 0.82} />
              <Text style={[styles.cardLabel, selected && { color: '#fff' }]}>D{d}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.colorRow}>
        <Text style={styles.colorLabel}>Color</Text>
        <View style={styles.swatches}>
          {COLORS.map((c) => (
            <Pressable
              key={c.hex}
              accessibilityLabel={c.name}
              onPress={() => onColor(c.hex)}
              hitSlop={6}
              style={[styles.swatch, { backgroundColor: c.hex }, c.hex === color && styles.swatchOn]}
            />
          ))}
        </View>
      </View>

      <View style={styles.flex} />
      <PrimaryButton label={`Roll D${sides}`} color={color} onPress={onRoll} />
    </View>
  );
}

function RollScreen({ sides, color, onBack }) {
  const [target, setTarget] = useState(() => rollDie(sides)); // the value the die will land on
  const [pose, setPose] = useState(null); // 3D rotation while tumbling; null = resting on `target`
  const [result, setResult] = useState(null);

  const drop = useRef(new Animated.Value(1)).current; // 1 = up in the air, 0 = on the table
  const sway = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const ui = useRef(new Animated.Value(0)).current;
  const frame = useRef(null);

  const land = (final) => {
    setPose(null);
    setResult(final);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }
    // Zoom in a little on the landed die so the result face reads clearly.
    Animated.parallel([
      Animated.spring(pop, { toValue: 1.15, friction: 5, tension: 80, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ]),
      Animated.timing(ui, { toValue: 1, duration: 350, delay: 100, useNativeDriver: true }),
    ]).start();
  };

  const throwDie = () => {
    cancelAnimationFrame(frame.current);
    const final = rollDie(sides);
    const dir = Math.random() < 0.5 ? -1 : 1;
    const rest = restingPose(sides, final);
    // Tumble around a random axis; the spin unwinds to zero exactly as the die settles,
    // so it comes to rest with the rolled face toward the viewer.
    const axis = norm([Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5]);
    const spins = (3 + Math.random() * 2) * 2 * Math.PI;
    const duration = 1400;
    const start = Date.now();

    setTarget(final);
    setResult(null);
    ui.setValue(0);
    glow.setValue(0);
    pop.setValue(1);
    drop.setValue(1);
    sway.setValue(dir * -120);

    Animated.parallel([
      Animated.timing(drop, { toValue: 0, duration: 1200, easing: Easing.bounce, useNativeDriver: true }),
      Animated.timing(sway, { toValue: 0, duration: duration, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
    ]).start();

    const step = () => {
      const p = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      if (p < 1) {
        setPose(matMul(axisAngle(axis, spins * (1 - eased)), rest));
        frame.current = requestAnimationFrame(step);
      } else {
        land(final);
      }
    };
    step();
  };

  useEffect(() => {
    throwDie();
    return () => cancelAnimationFrame(frame.current);
  }, []);

  const dieTransform = [
    { translateX: sway },
    { translateY: drop.interpolate({ inputRange: [0, 1], outputRange: [0, -420] }) },
    { scale: Animated.multiply(pop, drop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] })) },
  ];
  const shadowStyle = {
    opacity: drop.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.1] }),
    transform: [{ translateX: sway }, { scaleX: drop.interpolate({ inputRange: [0, 1], outputRange: [1, 0.4] }) }],
  };

  return (
    <View style={styles.flex}>
      <View style={styles.rollHeader}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={styles.back}>‹ Dice</Text>
        </Pressable>
        <Text style={styles.rollTag}>D{sides}</Text>
      </View>

      <View style={styles.stage}>
        <Animated.View style={[styles.glow, { backgroundColor: color, opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.3] }), transform: [{ scale: pop }] }]} />
        <Pressable onPress={result != null ? throwDie : undefined}>
          <Animated.View style={{ transform: dieTransform }}>
            <Die sides={sides} color={color} value={target} pose={pose} highlight={result != null} size={240} />
          </Animated.View>
        </Pressable>
        <Animated.View style={[styles.shadow, shadowStyle]} />
      </View>

      <Animated.View style={{ opacity: ui, transform: [{ translateY: ui.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
        <Text style={styles.resultLabel}>{result != null ? flavor(result, sides) : ' '}</Text>
        <Text style={[styles.result, { color: onDark(color) }]}>{result ?? ' '}</Text>
        <PrimaryButton label="Throw again?" color={color} onPress={throwDie} disabled={result == null} />
        <Pressable onPress={onBack} style={styles.secondary} disabled={result == null}>
          <Text style={styles.secondaryText}>Change dice</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function flavor(value, sides) {
  if (sides === 20 && value === 20) return 'Natural 20!';
  if (sides === 20 && value === 1) return 'Critical fail…';
  if (value === sides) return 'Max roll!';
  if (value === 1) return 'Ouch.';
  return 'You rolled';
}

function PrimaryButton({ label, color, onPress, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.primary, { backgroundColor: color }, pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 }]}
    >
      <Text style={[styles.primaryText, { color: color === '#F1EAD8' ? '#1B1B1F' : '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  container: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 24, paddingBottom: 24 },
  flex: { flex: 1 },
  title: { color: '#fff', fontSize: 52, fontFamily: DICE_FONT, marginTop: 24, letterSpacing: -1 },
  subtitle: { color: MUTED, fontSize: 16, marginTop: 4, marginBottom: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    backgroundColor: CARD,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cardLabel: { color: MUTED, fontSize: 17, fontFamily: DICE_FONT },
  colorRow: { flexDirection: 'row', alignItems: 'center', marginTop: 24, gap: 14 },
  colorLabel: { color: MUTED, fontSize: 14, fontWeight: '700' },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, flex: 1 },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)' },
  swatchOn: { borderColor: '#fff', borderWidth: 3, transform: [{ scale: 1.15 }] },
  primary: { height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 22, fontFamily: DICE_FONT },
  secondary: { height: 48, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  secondaryText: { color: MUTED, fontSize: 16, fontWeight: '600' },
  rollHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  back: { color: MUTED, fontSize: 18, fontWeight: '600' },
  rollTag: { color: '#fff', fontSize: 20, fontFamily: DICE_FONT },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', width: 260, height: 260, borderRadius: 130 },
  shadow: { width: 150, height: 18, borderRadius: 75, backgroundColor: '#000', marginTop: 18 },
  resultLabel: { color: MUTED, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  result: { fontSize: 72, fontFamily: DICE_FONT, textAlign: 'center', marginBottom: 16 },
});
