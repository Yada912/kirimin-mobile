import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ViewStyle,
  Platform,
  Pressable,
  LayoutChangeEvent,
  GestureResponderEvent,
} from 'react-native';
import { WebView } from 'react-native-webview';
import Svg, { Line, Path as SvgPath, Circle as SvgCircle, Rect } from 'react-native-svg';
import {
  Crosshair,
  Layers,
  MapPin,
  Navigation,
  Plus,
  Minus,
} from 'lucide-react-native';
import type { Place, LatLng } from '@kirimin/shared';
import { colors, radii, spacing } from '../theme/tokens';
import { Text } from './Text';
import { describeCoordinates, haversineKm } from '../constants/places';

export type MapLayerStyle = 'osm' | 'clean' | 'vector';

export interface MapMarker {
  lat: number;
  lng: number;
  title?: string;
  color?: string;
  type?: 'pickup' | 'dropoff' | 'driver' | 'stop';
}

export interface MapViewProps {
  pickup?: Place | LatLng | null;
  dropoff?: Place | LatLng | null;
  driverLocation?: LatLng | null;
  stops?: (Place | LatLng)[];
  markers?: MapMarker[];
  interactive?: boolean;
  height?: number;
  style?: ViewStyle;
  /** Shows layer switcher, recenter, zoom, and distance badge */
  showSettings?: boolean;
  /** Initial map layer style */
  defaultLayer?: MapLayerStyle;
  /** When set, tapping the map moves the pickup or dropoff pin and emits a Place */
  selectionMode?: 'pickup' | 'dropoff' | null;
  onSelectLocation?: (place: Place, target: 'pickup' | 'dropoff') => void;
}

const NativeWebView = WebView as unknown as React.ComponentType<any>;
const DEFAULT_CENTER: LatLng = { lat: -8.735, lng: 115.205 };

export function MapView({
  pickup,
  dropoff,
  driverLocation,
  stops = [],
  markers: customMarkers,
  interactive = true,
  height = 200,
  style,
  showSettings = true,
  defaultLayer = 'osm',
  selectionMode = null,
  onSelectLocation,
}: MapViewProps) {
  const webViewRef = useRef<any>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const [layer, setLayer] = useState<MapLayerStyle>(defaultLayer);
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [webFailed, setWebFailed] = useState(false);
  const [vectorSize, setVectorSize] = useState({ width: 320, height });

  // Build route points (pickup -> stops -> dropoff) separately from driverLocation
  const routePoints = useMemo<LatLng[]>(() => {
    const pts: LatLng[] = [];
    if (pickup) pts.push({ lat: pickup.lat, lng: pickup.lng });
    stops.forEach((s) => pts.push({ lat: s.lat, lng: s.lng }));
    if (dropoff) pts.push({ lat: dropoff.lat, lng: dropoff.lng });
    return pts;
  }, [pickup, stops, dropoff]);

  const allMarkers = useMemo<MapMarker[]>(() => {
    if (customMarkers && customMarkers.length > 0) return customMarkers;
    const list: MapMarker[] = [];

    if (pickup) {
      list.push({
        lat: pickup.lat,
        lng: pickup.lng,
        title: (pickup as Place).label || 'Jemput',
        color: colors.primary,
        type: 'pickup',
      });
    }

    stops.forEach((s, idx) => {
      list.push({
        lat: s.lat,
        lng: s.lng,
        title: (s as Place).label || `Singgah ${idx + 1}`,
        color: colors.semantic.warning,
        type: 'stop',
      });
    });

    if (dropoff) {
      list.push({
        lat: dropoff.lat,
        lng: dropoff.lng,
        title: (dropoff as Place).label || 'Antar',
        color: colors.semantic.success,
        type: 'dropoff',
      });
    }

    if (driverLocation) {
      list.push({
        lat: driverLocation.lat,
        lng: driverLocation.lng,
        title: 'Driver',
        color: '#7C3AED',
        type: 'driver',
      });
    }

    if (list.length === 0) {
      list.push({
        lat: DEFAULT_CENTER.lat,
        lng: DEFAULT_CENTER.lng,
        title: 'Denpasar – Jimbaran',
        color: colors.primary,
      });
    }

    return list;
  }, [pickup, dropoff, driverLocation, stops, customMarkers]);

  const distanceKm = useMemo(() => {
    if (!pickup || !dropoff) return null;
    const roadKm = haversineKm(pickup, dropoff) * 1.3;
    return Math.round(roadKm * 10) / 10;
  }, [pickup, dropoff]);

  // Update map state in-place without reloading the WebView
  const syncWebMap = useCallback(
    (fitBounds = true) => {
      const payload = JSON.stringify({
        markers: allMarkers,
        route: routePoints,
        layer,
        selectionMode,
        fitBounds,
      });
      if (Platform.OS === 'web') {
        try {
          iframeRef.current?.contentWindow?.postMessage(
            { type: 'KIRIMIN_MAP_UPDATE', payload: JSON.parse(payload) },
            '*',
          );
        } catch {
          // ignore
        }
      } else {
        webViewRef.current?.injectJavaScript(
          `window.updateKiriminMap && window.updateKiriminMap(${payload}); true;`,
        );
      }
    },
    [allMarkers, routePoints, layer, selectionMode],
  );

  useEffect(() => {
    if (layer !== 'vector' && !webFailed) {
      syncWebMap(true);
    }
  }, [allMarkers, routePoints, layer, selectionMode, webFailed, syncWebMap]);

  const handleRecenter = () => {
    if (layer === 'vector' || webFailed) return;
    if (Platform.OS === 'web') {
      iframeRef.current?.contentWindow?.postMessage({ type: 'KIRIMIN_MAP_RECENTER' }, '*');
    } else {
      webViewRef.current?.injectJavaScript('window.recenterKiriminMap && window.recenterKiriminMap(); true;');
    }
  };

  const handleZoom = (delta: number) => {
    if (layer === 'vector' || webFailed) return;
    if (Platform.OS === 'web') {
      iframeRef.current?.contentWindow?.postMessage({ type: 'KIRIMIN_MAP_ZOOM', delta }, '*');
    } else {
      webViewRef.current?.injectJavaScript(
        `window.zoomKiriminMap && window.zoomKiriminMap(${delta}); true;`,
      );
    }
  };

  const handleMapTap = useCallback(
    (lat: number, lng: number) => {
      if (!selectionMode || !onSelectLocation) return;
      const clampedLat = Math.max(-8.86, Math.min(-8.55, lat));
      const clampedLng = Math.max(115.08, Math.min(115.32, lng));
      onSelectLocation(
        {
          label: describeCoordinates(clampedLat, clampedLng),
          lat: Number(clampedLat.toFixed(5)),
          lng: Number(clampedLng.toFixed(5)),
        },
        selectionMode,
      );
    },
    [selectionMode, onSelectLocation],
  );

  // Listen to Web iframe messages
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onMsg = (ev: MessageEvent) => {
      if (ev.data?.type === 'KIRIMIN_MAP_TAP') {
        handleMapTap(ev.data.lat, ev.data.lng);
      } else if (ev.data?.type === 'KIRIMIN_MAP_ERROR') {
        setWebFailed(true);
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [handleMapTap]);

  // Initial Leaflet HTML (mounted once, updated via JS bridge)
  const initialHtml = useMemo(() => {
    const initialPayload = JSON.stringify({
      markers: allMarkers,
      route: routePoints,
      layer: defaultLayer,
      selectionMode,
      fitBounds: true,
    });

    return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body, html, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #F0F4F8; font-family: -apple-system, sans-serif; }
    .pin-wrap { display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -50%); }
    .pin-dot { width: 18px; height: 18px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 2px 6px rgba(15,23,42,0.3); }
    .pin-label {
      margin-top: 2px; background: #fff; padding: 1px 6px; border-radius: 999px;
      font-size: 10px; font-weight: 700; white-space: nowrap;
      box-shadow: 0 1px 4px rgba(15,23,42,0.18);
    }
    .driver-pulse {
      width: 24px; height: 24px; border-radius: 50%; background: rgba(124,58,237,0.22);
      display: flex; align-items: center; justify-content: center;
      animation: pulse 1.4s ease-out infinite;
    }
    @keyframes pulse { 0% { transform: scale(0.9); opacity: 1; } 100% { transform: scale(1.6); opacity: 0.25; } }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    function postMsg(obj) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(obj));
      } else if (window.parent) {
        window.parent.postMessage(obj, '*');
      }
    }

    if (typeof L === 'undefined') {
      postMsg({ type: 'KIRIMIN_MAP_ERROR' });
    } else {
      const map = L.map('map', {
        zoomControl: false,
        attributionControl: false,
        dragging: ${interactive},
        touchZoom: ${interactive},
        doubleClickZoom: ${interactive},
        scrollWheelZoom: ${interactive}
      }).setView([${DEFAULT_CENTER.lat}, ${DEFAULT_CENTER.lng}], 12);

      const osmTiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 });
      const cleanTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 });

      let activeTiles = osmTiles.addTo(map);
      let tileErrorCount = 0;
      osmTiles.on('tileerror', function() {
        tileErrorCount++;
        if (tileErrorCount > 4) postMsg({ type: 'KIRIMIN_MAP_ERROR' });
      });

      const layerGroup = L.layerGroup().addTo(map);
      let lastBounds = null;

      window.updateKiriminMap = function(data) {
        if (!data) return;
        if (data.layer === 'clean' && activeTiles !== cleanTiles) {
          map.removeLayer(activeTiles);
          activeTiles = cleanTiles.addTo(map);
        } else if (data.layer === 'osm' && activeTiles !== osmTiles) {
          map.removeLayer(activeTiles);
          activeTiles = osmTiles.addTo(map);
        }

        layerGroup.clearLayers();
        const pts = [];

        if (data.route && data.route.length >= 2) {
          const rCoords = data.route.map(p => [p.lat, p.lng]);
          L.polyline(rCoords, { color: '#1463F3', weight: 6, opacity: 0.18 }).addTo(layerGroup);
          L.polyline(rCoords, { color: '#1463F3', weight: 3.5, opacity: 0.9, dashArray: '7, 8' }).addTo(layerGroup);
        }

        (data.markers || []).forEach(m => {
          const pos = [m.lat, m.lng];
          pts.push(pos);
          const tag = m.type === 'pickup' ? 'Jemput' : m.type === 'dropoff' ? 'Antar' : m.type === 'driver' ? 'Driver' : '';
          const color = m.color || '#1463F3';
          const dotHtml = m.type === 'driver'
            ? '<div class="driver-pulse"><div class="pin-dot" style="background:' + color + ';width:14px;height:14px;"></div></div>'
            : '<div class="pin-dot" style="background:' + color + ';"></div>';
          const labelHtml = tag ? '<div class="pin-label" style="color:' + color + ';">' + tag + '</div>' : '';

          const icon = L.divIcon({
            className: '',
            html: '<div class="pin-wrap">' + dotHtml + labelHtml + '</div>',
            iconSize: [0, 0]
          });
          const marker = L.marker(pos, { icon }).addTo(layerGroup);
          if (m.title) marker.bindPopup(m.title);
        });

        if (pts.length > 1) {
          lastBounds = L.latLngBounds(pts);
          if (data.fitBounds !== false) {
            map.fitBounds(lastBounds, { padding: [36, 36], maxZoom: 15 });
          }
        } else if (pts.length === 1) {
          lastBounds = null;
          if (data.fitBounds !== false) {
            map.setView(pts[0], 14);
          }
        }
      };

      window.recenterKiriminMap = function() {
        if (lastBounds) {
          map.fitBounds(lastBounds, { padding: [36, 36], maxZoom: 15 });
        } else {
          map.setView([${DEFAULT_CENTER.lat}, ${DEFAULT_CENTER.lng}], 12);
        }
      };

      window.zoomKiriminMap = function(delta) {
        map.setZoom(map.getZoom() + delta);
      };

      map.on('click', function(e) {
        postMsg({ type: 'KIRIMIN_MAP_TAP', lat: e.latlng.lat, lng: e.latlng.lng });
      });

      window.updateKiriminMap(${initialPayload});
    }
  </script>
</body>
</html>`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive]);

  // Projection bounds for the native South Bali Vector Map fallback / layer
  const vectorBounds = useMemo(() => {
    const lats = allMarkers.map((m) => m.lat);
    const lngs = allMarkers.map((m) => m.lng);
    const minLat = Math.min(...lats, -8.805) - 0.022;
    const maxLat = Math.max(...lats, -8.67) + 0.022;
    const minLng = Math.min(...lngs, 115.165) - 0.022;
    const maxLng = Math.max(...lngs, 115.245) + 0.022;
    return {
      minLat,
      maxLat,
      minLng,
      maxLng,
      latSpan: Math.max(0.04, maxLat - minLat),
      lngSpan: Math.max(0.04, maxLng - minLng),
    };
  }, [allMarkers]);

  const projectPoint = useCallback(
    (pt: LatLng) => {
      const w = vectorSize.width || 320;
      const h = vectorSize.height || height;
      const padX = w * 0.16;
      const padY = h * 0.24;
      const nx = Math.max(0, Math.min(1, (pt.lng - vectorBounds.minLng) / vectorBounds.lngSpan));
      const ny = Math.max(
        0,
        Math.min(1, 1 - (pt.lat - vectorBounds.minLat) / vectorBounds.latSpan),
      );
      return {
        x: padX + nx * (w - 2 * padX),
        y: padY + ny * (h - 2 * padY),
      };
    },
    [vectorSize, height, vectorBounds],
  );

  const handleVectorPress = (e: GestureResponderEvent) => {
    if (!selectionMode || !onSelectLocation) return;
    const { locationX, locationY } = e.nativeEvent;
    const w = vectorSize.width || 320;
    const h = vectorSize.height || height;
    const padX = w * 0.16;
    const padY = h * 0.24;
    const nx = Math.max(0, Math.min(1, (locationX - padX) / Math.max(1, w - 2 * padX)));
    const ny = Math.max(0, Math.min(1, (locationY - padY) / Math.max(1, h - 2 * padY)));
    const lng = vectorBounds.minLng + nx * vectorBounds.lngSpan;
    const lat = vectorBounds.minLat + (1 - ny) * vectorBounds.latSpan;
    handleMapTap(lat, lng);
  };

  const handleVectorLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (w > 0 && h > 0) setVectorSize({ width: w, height: h });
  };

  const renderVectorMap = () => {
    const w = vectorSize.width || 320;
    const h = vectorSize.height || height;
    const projectedRoute = routePoints.map(projectPoint);
    const routeD =
      projectedRoute.length >= 2
        ? projectedRoute.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
        : '';

    return (
      <Pressable
        onLayout={handleVectorLayout}
        onPress={handleVectorPress}
        disabled={!selectionMode}
        style={[styles.vectorCanvas, { height }]}
      >
        <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
          <Rect x={0} y={0} width={w} height={h} fill="#EEF3F8" />
          {/* Coastal Bali water tint */}
          <Rect x={0} y={h * 0.8} width={w} height={h * 0.2} fill="#DCEAF8" />
          {/* South Bali road arteries */}
          <Line x1={0} y1={h * 0.34} x2={w} y2={h * 0.24} stroke="#F8FAFC" strokeWidth={8} strokeLinecap="round" />
          <Line x1={w * 0.25} y1={0} x2={w * 0.18} y2={h} stroke="#F8FAFC" strokeWidth={8} strokeLinecap="round" />
          <Line x1={0} y1={h * 0.72} x2={w} y2={h * 0.62} stroke="#FFFFFF" strokeWidth={12} strokeLinecap="round" />
          <Line x1={w * 0.12} y1={h * 0.16} x2={w * 0.88} y2={h * 0.8} stroke="#FFFFFF" strokeWidth={11} strokeLinecap="round" />
          <Line x1={w * 0.74} y1={0} x2={w * 0.56} y2={h} stroke="#FFFFFF" strokeWidth={11} strokeLinecap="round" />

          {/* Route polyline */}
          {routeD ? (
            <>
              <SvgPath d={routeD} stroke="rgba(20,99,243,0.18)" strokeWidth={12} fill="none" strokeLinecap="round" />
              <SvgPath
                d={routeD}
                stroke={colors.primary}
                strokeWidth={4}
                strokeDasharray="8, 6"
                fill="none"
                strokeLinecap="round"
              />
            </>
          ) : null}

          {/* Markers */}
          {allMarkers.map((m, idx) => {
            const p = projectPoint(m);
            const c = m.color || colors.primary;
            return (
              <React.Fragment key={`${m.type || 'pin'}-${idx}`}>
                <SvgCircle cx={p.x} cy={p.y} r={14} fill={c} fillOpacity={0.2} />
                <SvgCircle cx={p.x} cy={p.y} r={9} fill="#FFFFFF" />
                <SvgCircle cx={p.x} cy={p.y} r={6} fill={c} />
              </React.Fragment>
            );
          })}
        </Svg>

        {/* Floating Jemput / Antar Pills */}
        {pickup ? (
          <View
            pointerEvents="none"
            style={[
              styles.floatingPill,
              {
                left: Math.max(8, Math.min(w - 76, projectPoint(pickup).x - 28)),
                top: Math.max(8, projectPoint(pickup).y - 34),
              },
            ]}
          >
            <Text variant="captionMedium" color={colors.primary} weight="700" style={{ fontSize: 10 }}>
              Jemput
            </Text>
          </View>
        ) : null}

        {dropoff ? (
          <View
            pointerEvents="none"
            style={[
              styles.floatingPill,
              {
                left: Math.max(8, Math.min(w - 68, projectPoint(dropoff).x - 24)),
                top: Math.max(8, Math.min(h - 28, projectPoint(dropoff).y + 12)),
              },
            ]}
          >
            <Text variant="captionMedium" color={colors.semantic.success} weight="700" style={{ fontSize: 10 }}>
              Antar
            </Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  const useVector = layer === 'vector' || webFailed;

  return (
    <View style={[styles.container, { height }, style]}>
      {useVector ? (
        renderVectorMap()
      ) : Platform.OS === 'web' ? (
        <iframe
          ref={iframeRef as any}
          srcDoc={initialHtml}
          style={{ width: '100%', height: '100%', border: 'none', borderRadius: radii.lg }}
          title="Kirimin Map"
        />
      ) : (
        <NativeWebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: initialHtml }}
          scrollEnabled={false}
          onError={() => setWebFailed(true)}
          onMessage={(event: { nativeEvent: { data: string } }) => {
            try {
              const msg = JSON.parse(event.nativeEvent.data);
              if (msg.type === 'KIRIMIN_MAP_TAP') {
                handleMapTap(msg.lat, msg.lng);
              } else if (msg.type === 'KIRIMIN_MAP_ERROR') {
                setWebFailed(true);
              }
            } catch {
              // ignore
            }
          }}
          style={styles.webview}
        />
      )}

      {/* Selection mode prompt banner */}
      {selectionMode ? (
        <View style={styles.selectionBanner} pointerEvents="none">
          <MapPin size={12} color="#FFF" />
          <Text variant="captionMedium" color="#FFF" weight="600" style={{ marginLeft: 4, fontSize: 11 }}>
            Ketuk peta untuk atur titik {selectionMode === 'pickup' ? 'Jemput' : 'Antar'}
          </Text>
        </View>
      ) : null}

      {/* Bottom-left Distance Badge */}
      {distanceKm !== null ? (
        <View style={styles.distanceBadge} pointerEvents="none">
          <Navigation size={11} color={colors.primary} />
          <Text variant="captionMedium" color={colors.text.primary} weight="700" style={{ marginLeft: 4, fontSize: 11 }}>
            {distanceKm.toFixed(1)} km
          </Text>
        </View>
      ) : null}

      {/* Top-right Map Settings & Controls */}
      {showSettings ? (
        <View style={styles.controlsCol}>
          <Pressable
            onPress={() => setShowLayerMenu((v) => !v)}
            style={styles.controlBtn}
            accessibilityLabel="Pengaturan lapisan peta"
          >
            <Layers size={15} color={colors.text.primary} />
          </Pressable>

          {!useVector && interactive ? (
            <>
              <Pressable
                onPress={handleRecenter}
                style={styles.controlBtn}
                accessibilityLabel="Pusatkan rute di peta"
              >
                <Crosshair size={15} color={colors.text.primary} />
              </Pressable>
              <Pressable
                onPress={() => handleZoom(1)}
                style={styles.controlBtn}
                accessibilityLabel="Perbesar peta"
              >
                <Plus size={15} color={colors.text.primary} />
              </Pressable>
              <Pressable
                onPress={() => handleZoom(-1)}
                style={styles.controlBtn}
                accessibilityLabel="Perkecil peta"
              >
                <Minus size={15} color={colors.text.primary} />
              </Pressable>
            </>
          ) : null}
        </View>
      ) : null}

      {/* Layer Switcher Popover */}
      {showSettings && showLayerMenu ? (
        <View style={styles.layerMenu}>
          {(
            [
              { id: 'osm', label: 'Peta Jalan (OSM)' },
              { id: 'clean', label: 'Peta Ringan' },
              { id: 'vector', label: 'Peta Vektor Offline' },
            ] as const
          ).map((opt) => {
            const active = layer === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => {
                  setWebFailed(false);
                  setLayer(opt.id);
                  setShowLayerMenu(false);
                }}
                style={[styles.layerOption, active && styles.layerOptionActive]}
              >
                <Text
                  variant="captionMedium"
                  color={active ? colors.primary : colors.text.primary}
                  weight={active ? '700' : '500'}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: '#EEF3F8',
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  vectorCanvas: {
    width: '100%',
    position: 'relative',
  },
  floatingPill: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  selectionBanner: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 99, 243, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  distanceBadge: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.borderLight,
    elevation: 2,
  },
  controlsCol: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    gap: 6,
  },
  controlBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 2,
  },
  layerMenu: {
    position: 'absolute',
    top: spacing.sm,
    right: 46,
    backgroundColor: '#FFFFFF',
    borderRadius: radii.md,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    minWidth: 148,
  },
  layerOption: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radii.sm,
  },
  layerOptionActive: {
    backgroundColor: colors.primaryLight,
  },
});
