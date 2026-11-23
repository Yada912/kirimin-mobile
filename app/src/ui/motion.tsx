/**
 * Small, quiet motion for Kirimin. Three things only:
 *  - usePressScale: a tappable thing dips slightly while pressed and springs back.
 *  - PopIn: a success picture pops in once (order sent, payment received, handover done).
 *  - Pulse: a soft repeating ring, for "we're still looking" moments.
 * Everything turns itself off when the phone has "reduce motion" enabled.
 */
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleProp, ViewStyle } from 'react-native';

const native = Platform.OS !== 'web';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => alive && setReduced(!!v))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v: boolean) => setReduced(!!v));
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);
  return reduced;
}

/** Returns an animated scale plus onPressIn/onPressOut handlers to spread on a Pressable. */
export function usePressScale(pressedScale = 0.97) {
  const scale = useRef(new Animated.Value(1)).current;
  const reduced = useReducedMotion();
  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: native, speed: 40, bounciness: v === 1 ? 6 : 0 }).start();
  return {
    scale,
    handlers: reduced
      ? {}
      : {
          onPressIn: () => to(pressedScale),
          onPressOut: () => to(1),
        },
  };
}

/** Pops its child in once on mount (scale 0.6 → 1 with a little overshoot, fade in). */
export function PopIn({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) {
      v.setValue(1);
      return;
    }
    Animated.spring(v, { toValue: 1, delay, useNativeDriver: native, speed: 9, bounciness: 12 }).start();
  }, [reduced, delay, v]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** A soft ring that grows and fades, repeating. Place it behind an icon or picture. */
export function Pulse({ size = 120, color = '#1463F3', style }: { size?: number; color?: string; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const rings = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  useEffect(() => {
    if (reduced) return;
    const loops = rings.map((r, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 900),
          Animated.timing(r, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: native }),
          Animated.timing(r, { toValue: 0, duration: 0, useNativeDriver: native }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);
  if (reduced) return null;
  return (
    <>
      {rings.map((r, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: color,
              opacity: r.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0] }),
              transform: [{ scale: r.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1.35] }) }],
            },
            style,
          ]}
        />
      ))}
    </>
  );
}
