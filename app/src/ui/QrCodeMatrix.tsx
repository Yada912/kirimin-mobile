import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { colors, radii } from '../theme/tokens';

/**
 * Deterministic 25x25 QR-style matrix (ported from Wisnu's QrCodeGenerator.kt)
 * with authentic 7x7 finder patterns in three corners and timing tracks.
 */
function buildQrMatrix(payload: string): boolean[][] {
  const size = 25;
  const grid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const placeFinder = (top: number, left: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = top + r;
        const cc = left + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        reserved[rr][cc] = true;
        if (r === -1 || r === 7 || c === -1 || c === 7) {
          grid[rr][cc] = false;
        } else {
          const isOuter = r === 0 || r === 6 || c === 0 || c === 6;
          const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          grid[rr][cc] = isOuter || isInner;
        }
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  for (let i = 8; i < size - 8; i++) {
    reserved[6][i] = true;
    reserved[i][6] = true;
    grid[6][i] = i % 2 === 0;
    grid[i][6] = i % 2 === 0;
  }

  let hash = 2166136261;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  let state = hash >>> 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (reserved[r][c]) continue;
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      const charBit = payload.length > 0 ? payload.charCodeAt((r * size + c) % payload.length) & 1 : 0;
      grid[r][c] = ((state >>> 24) & 1) === 1 || (charBit === 1 && (r + c) % 3 === 0);
    }
  }

  return grid;
}

export interface QrCodeMatrixProps {
  payload: string;
  size?: number;
}

export function QrCodeMatrix({ payload, size = 180 }: QrCodeMatrixProps) {
  const matrix = useMemo(() => buildQrMatrix(payload), [payload]);
  const n = matrix.length;
  const cell = size / n;

  return (
    <View style={[styles.frame, { width: size + 24, height: size + 24 }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Rect x={0} y={0} width={size} height={size} fill="#FFFFFF" />
        {matrix.map((row, r) =>
          row.map((on, c) =>
            on ? (
              <Rect
                key={`${r}-${c}`}
                x={c * cell}
                y={r * cell}
                width={cell + 0.3}
                height={cell + 0.3}
                fill="#0F172A"
              />
            ) : null,
          ),
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
});
