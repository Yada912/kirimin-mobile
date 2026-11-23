import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ViewStyle,
  Platform,
  Pressable,
  LayoutChangeEvent,
  GestureResponderEvent,
  Modal,
  ScrollView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import Svg, { Line, Path as SvgPath, Circle as SvgCircle, Rect, Text as SvgText } from 'react-native-svg';
import {
  Crosshair,
  Layers,
  MapPin,
  Navigation,
  Plus,
  Minus,
  Maximize2,
  Minimize2,
  CornerUpRight,
  CornerUpLeft,
  ArrowUp,
  RotateCw,
  Flag,
  List,
  X,
  Compass,
  Moon,
  Sun,
  Clock,
} from './icons';
import type { Place, LatLng } from '@kirimin/shared';
import { colors, radii, spacing, shadows } from '../theme/tokens';
import { Text } from './Text';
import { describeCoordinates } from '../constants/places';
import {
  RoadRoute,
  RouteStep,
  ManeuverType,
  buildBaliFallbackRoute,
  fetchRoadRoute,
  computeDriverRouteProgress,
  formatStepDistance,
} from '../utils/routing';

export type MapLayerStyle = 'apple' | 'osm' | 'dark' | 'vector';

export interface MapMarker {
  id?: string;
  lat: number;
  lng: number;
  title?: string;
  subtitle?: string;
  color?: string;
  type?: 'pickup' | 'dropoff' | 'driver' | 'stop';
  orderIndex?: number;
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
  /** Shows layer switcher, recenter, zoom, expand, and ETA/distance badge */
  showSettings?: boolean;
  /** Initial map layer style (defaults to clean Apple/Gojek-like Voyager style) */
  defaultLayer?: MapLayerStyle;
  /** When set, tapping the map moves the pickup or dropoff pin and emits a Place */
  selectionMode?: 'pickup' | 'dropoff' | null;
  onSelectLocation?: (place: Place, target: 'pickup' | 'dropoff') => void;
  /** Enables Apple/Google Maps style turn-by-turn banner, auto-follow, and steps sheet */
  navigationMode?: boolean;
  /** Emits the computed road-following route (for realistic road GPS simulation & ETA) */
  onRouteComputed?: (route: RoadRoute) => void;
  /** Allows expanding the map into fullscreen interactive mode */
  allowExpand?: boolean;
  /**
   * When given together with onSelectLocation, the map shows a small
   * "Ketuk peta: Jemput | Antar" switch so the user picks which pin a tap moves,
   * without leaving the inline map.
   */
  onSelectionModeChange?: (mode: 'pickup' | 'dropoff') => void;
  /**
   * Called with true while a finger is on the map and false when it lifts. Screens put
   * the map inside a ScrollView; they use this to pause page scrolling so drags pan the
   * map and pinches zoom it instead of scrolling the page.
   */
  onInteractionChange?: (active: boolean) => void;
  /** Height of a card that overlaps the bottom of the map; bottom overlays move above it. */
  overlayBottomInset?: number;
}

const NativeWebView = WebView as unknown as React.ComponentType<any>;
const DEFAULT_CENTER: LatLng = { lat: -8.735, lng: 115.205 };

function ManeuverIcon({ type, size = 20, color = '#FFFFFF' }: { type: ManeuverType; size?: number; color?: string }) {
  switch (type) {
    case 'turn-right':
    case 'slight-right':
      return <CornerUpRight size={size} color={color} />;
    case 'turn-left':
    case 'slight-left':
      return <CornerUpLeft size={size} color={color} />;
    case 'roundabout':
    case 'uturn':
      return <RotateCw size={size} color={color} />;
    case 'arrive':
      return <Flag size={size} color={color} />;
    case 'depart':
      return <Navigation size={size} color={color} />;
    default:
      return <ArrowUp size={size} color={color} />;
  }
}

export function MapView({
  pickup,
  dropoff,
  driverLocation,
  stops = [],
  markers: customMarkers,
  interactive = true,
  height = 220,
  style,
  showSettings = true,
  defaultLayer = 'apple',
  selectionMode = null,
  onSelectLocation,
  navigationMode = false,
  onRouteComputed,
  allowExpand = true,
  onSelectionModeChange,
  onInteractionChange,
  overlayBottomInset = 0,
}: MapViewProps) {
  const editable = !!onSelectLocation;
  // Set when the user moves a pin on the map, so the map keeps its zoom instead of re-fitting.
  const userEditedRef = useRef(false);
  const webViewRef = useRef<any>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const fullWebViewRef = useRef<any>(null);
  const fullIframeRef = useRef<HTMLIFrameElement | null>(null);

  const [layer, setLayer] = useState<MapLayerStyle>(defaultLayer);
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [webFailed, setWebFailed] = useState(false);
  const [vectorSize, setVectorSize] = useState({ width: 340, height });
  const [followDriver, setFollowDriver] = useState(navigationMode);
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [showStepsSheet, setShowStepsSheet] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [webReady, setWebReady] = useState(false);

  // Build ordered route waypoints: pickup -> stops -> dropoff
  const routeWaypoints = useMemo<LatLng[]>(() => {
    const pts: LatLng[] = [];
    if (pickup) pts.push({ lat: pickup.lat, lng: pickup.lng });
    stops.forEach((s) => pts.push({ lat: s.lat, lng: s.lng }));
    if (dropoff) pts.push({ lat: dropoff.lat, lng: dropoff.lng });
    return pts;
  }, [pickup, stops, dropoff]);

  // Immediately compute Bali road-graph fallback so the route is road-following on frame 1,
  // then seamlessly upgrade to live OSRM geometry if available.
  const [roadRoute, setRoadRoute] = useState<RoadRoute>(() => buildBaliFallbackRoute(routeWaypoints));

  const waypointsKey = useMemo(
    () => routeWaypoints.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join(';'),
    [routeWaypoints],
  );

  useEffect(() => {
    let active = true;
    const instant = buildBaliFallbackRoute(routeWaypoints);
    setRoadRoute(instant);
    onRouteComputed?.(instant);

    if (routeWaypoints.length >= 2) {
      fetchRoadRoute(routeWaypoints).then((resolved) => {
        if (!active) return;
        setRoadRoute(resolved);
        onRouteComputed?.(resolved);
      });
    }
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waypointsKey]);

  // Split road polyline into traveled vs remaining & compute heading + active maneuver
  const navProgress = useMemo(
    () => computeDriverRouteProgress(roadRoute, driverLocation),
    [roadRoute, driverLocation],
  );

  const allMarkers = useMemo<MapMarker[]>(() => {
    const base: MapMarker[] = [];

    if (customMarkers && customMarkers.length > 0) {
      base.push(...customMarkers);
    } else {
      if (pickup) {
        base.push({
          id: 'pickup',
          lat: pickup.lat,
          lng: pickup.lng,
          title: (pickup as Place).label || 'Titik Jemput',
          subtitle: (pickup as Place).address || 'Lokasi penjemputan paket',
          color: colors.primary,
          type: 'pickup',
        });
      }

      stops.forEach((s, idx) => {
        base.push({
          id: `stop-${idx}`,
          lat: s.lat,
          lng: s.lng,
          title: (s as Place).label || `Singgah ${idx + 1}`,
          subtitle: `Titik singgah rute #${idx + 1}`,
          color: colors.accent.amber,
          type: 'stop',
          orderIndex: idx + 1,
        });
      });

      if (dropoff) {
        base.push({
          id: 'dropoff',
          lat: dropoff.lat,
          lng: dropoff.lng,
          title: (dropoff as Place).label || 'Titik Tujuan',
          subtitle: (dropoff as Place).address || 'Lokasi pengantaran paket',
          color: colors.senja,
          type: 'dropoff',
        });
      }
    }

    if (driverLocation && !base.some((m) => m.type === 'driver')) {
      base.push({
        id: 'driver',
        lat: driverLocation.lat,
        lng: driverLocation.lng,
        title: 'Posisi pengemudi',
        subtitle: navProgress.activeStep?.roadName
          ? `Melintas di ${navProgress.activeStep.roadName}`
          : 'Sedang bergerak di rute',
        color: colors.driver,
        type: 'driver',
      });
    }

    if (base.length === 0) {
      base.push({
        id: 'default',
        lat: DEFAULT_CENTER.lat,
        lng: DEFAULT_CENTER.lng,
        title: 'Koridor Denpasar – Bukit',
        subtitle: 'Area layanan',
        color: colors.primary,
      });
    }

    return base;
  }, [pickup, dropoff, driverLocation, stops, customMarkers, navProgress.activeStep?.roadName]);

  const mapPayload = useMemo(
    () => ({
      markers: allMarkers,
      route: roadRoute.coordinates,
      traveled: driverLocation ? navProgress.traveled : [],
      remaining: driverLocation ? navProgress.remaining : roadRoute.coordinates,
      heading: navProgress.heading,
      driverLocation: driverLocation || null,
      followDriver: followDriver && !!driverLocation,
      layer,
      selectionMode,
      editable,
    }),
    [
      allMarkers,
      roadRoute.coordinates,
      driverLocation,
      navProgress.traveled,
      navProgress.remaining,
      navProgress.heading,
      followDriver,
      layer,
      selectionMode,
      editable,
    ],
  );

  // Send message to either inline or fullscreen map bridge
  const dispatchToMap = useCallback((msgType: string, payload?: any) => {
    const targets = [
      { iframe: iframeRef.current, webview: webViewRef.current },
      { iframe: fullIframeRef.current, webview: fullWebViewRef.current },
    ];
    for (const t of targets) {
      if (Platform.OS === 'web') {
        try {
          t.iframe?.contentWindow?.postMessage({ type: msgType, payload }, '*');
        } catch {
          // ignore
        }
      } else if (t.webview) {
        const js =
          msgType === 'KIRIMIN_MAP_UPDATE'
            ? `window.updateKiriminMap && window.updateKiriminMap(${JSON.stringify(payload)}); true;`
            : msgType === 'KIRIMIN_MAP_RECENTER'
              ? `window.recenterKiriminMap && window.recenterKiriminMap(${JSON.stringify(payload || {})}); true;`
              : msgType === 'KIRIMIN_MAP_ZOOM'
                ? `window.zoomKiriminMap && window.zoomKiriminMap(${Number(payload?.delta || 0)}); true;`
                : msgType === 'KIRIMIN_MAP_FOCUS'
                  ? `window.focusKiriminPoint && window.focusKiriminPoint(${Number(payload?.lat)}, ${Number(payload?.lng)}, ${Number(payload?.zoom || 16)}); true;`
                  : '';
        if (js) t.webview.injectJavaScript(js);
      }
    }
  }, []);

  const hasFitOnceRef = useRef(false);
  useEffect(() => {
    if (userEditedRef.current) {
      // The user placed this pin themselves: keep their pan/zoom.
      userEditedRef.current = false;
      return;
    }
    hasFitOnceRef.current = false;
  }, [waypointsKey]);

  useEffect(() => {
    if (layer === 'vector' || webFailed) return;
    const fitBounds = !hasFitOnceRef.current && !(followDriver && driverLocation);
    hasFitOnceRef.current = true;
    dispatchToMap('KIRIMIN_MAP_UPDATE', { ...mapPayload, fitBounds });
  }, [mapPayload, layer, webFailed, webReady, isFullscreen, followDriver, driverLocation, dispatchToMap]);

  const handleRecenter = () => {
    if (layer === 'vector' || webFailed) return;
    if (driverLocation && navigationMode) {
      const nextFollow = !followDriver;
      setFollowDriver(nextFollow);
      dispatchToMap('KIRIMIN_MAP_RECENTER', { focusDriver: nextFollow });
    } else {
      dispatchToMap('KIRIMIN_MAP_RECENTER', { focusDriver: false });
    }
  };

  const handleZoom = (delta: number) => {
    if (layer === 'vector' || webFailed) return;
    dispatchToMap('KIRIMIN_MAP_ZOOM', { delta });
  };

  const handleFocusPoint = (lat: number, lng: number, zoom = 16) => {
    setFollowDriver(false);
    dispatchToMap('KIRIMIN_MAP_FOCUS', { lat, lng, zoom });
  };

  const handleMapTap = useCallback(
    (lat: number, lng: number) => {
      if (!selectionMode || !onSelectLocation) return;
      userEditedRef.current = true;
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

  const handleBridgeMessage = useCallback(
    (msg: any) => {
      if (!msg?.type) return;
      if (msg.type === 'KIRIMIN_MAP_READY') {
        setWebReady(true);
      } else if (msg.type === 'KIRIMIN_MAP_TAP') {
        handleMapTap(msg.lat, msg.lng);
      } else if (msg.type === 'KIRIMIN_MARKER_MOVED') {
        if (onSelectLocation && (msg.markerType === 'pickup' || msg.markerType === 'dropoff')) {
          userEditedRef.current = true;
          const lat = Math.max(-8.86, Math.min(-8.55, msg.lat));
          const lng = Math.max(115.08, Math.min(115.32, msg.lng));
          onSelectLocation(
            { label: describeCoordinates(lat, lng), lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)) },
            msg.markerType,
          );
        }
      } else if (msg.type === 'KIRIMIN_MAP_DRAG') {
        setFollowDriver(false);
      } else if (msg.type === 'KIRIMIN_MARKER_TAP') {
        const found = allMarkers.find((m) => m.id === msg.id) || {
          lat: msg.lat,
          lng: msg.lng,
          title: msg.title,
          subtitle: msg.subtitle,
          type: msg.markerType,
          color: msg.color,
        };
        setSelectedMarker(found);
      } else if (msg.type === 'KIRIMIN_MAP_ERROR') {
        setWebFailed(true);
      }
    },
    [handleMapTap, allMarkers, onSelectLocation],
  );

  // Listen to Web iframe postMessages
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onMsg = (ev: MessageEvent) => {
      if (ev.data && typeof ev.data === 'object' && String(ev.data.type || '').startsWith('KIRIMIN_')) {
        handleBridgeMessage(ev.data);
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [handleBridgeMessage]);

  // Initial Leaflet HTML (mounted once, updated live via JS bridge)
  const initialHtml = useMemo(() => {
    const initialPayload = JSON.stringify({
      ...mapPayload,
      fitBounds: true,
    });

    return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { box-sizing: border-box; }
    body, html, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #E9EFF6; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .pin-wrap { display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -82%); cursor: pointer; }
    .pin-head {
      width: 28px; height: 28px; border-radius: 50%; border: 3px solid #fff;
      box-shadow: 0 4px 12px rgba(15,23,42,0.28); display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 11px; font-weight: 800; transition: transform 0.15s ease;
    }
    .pin-head:hover { transform: scale(1.1); }
    .pin-stem { width: 3px; height: 6px; border-radius: 2px; margin-top: -2px; }
    .pin-label {
      margin-top: 2px; background: rgba(255,255,255,0.96); padding: 2px 8px; border-radius: 999px;
      font-size: 10px; font-weight: 700; white-space: nowrap; max-width: 130px; overflow: hidden; text-overflow: ellipsis;
      box-shadow: 0 2px 8px rgba(15,23,42,0.18); border: 1px solid rgba(15,23,42,0.06);
    }
    .driver-puck-wrap { position: relative; width: 44px; height: 44px; transform: translate(-50%, -50%); display: flex; align-items: center; justify-content: center; cursor: pointer; }
    .driver-halo {
      position: absolute; width: 42px; height: 42px; border-radius: 50%;
      background: rgba(20, 99, 243, 0.22); animation: pulse 1.6s ease-out infinite;
    }
    .driver-puck {
      position: relative; width: 30px; height: 30px; border-radius: 50%;
      background: #FFFFFF; box-shadow: 0 3px 12px rgba(15,23,42,0.35);
      border: 2.5px solid #1463F3; display: flex; align-items: center; justify-content: center;
      transition: transform 0.35s ease;
    }
    @keyframes pulse { 0% { transform: scale(0.75); opacity: 0.9; } 100% { transform: scale(1.6); opacity: 0; } }
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
        // A single tap places a pin, so double-tap zoom would fire two taps; pinch or +/- zoom instead.
        doubleClickZoom: ${interactive && !editable},
        scrollWheelZoom: ${interactive},
        zoomSnap: 0.5,
        bounceAtZoomLimits: false,
        tapTolerance: 12
      }).setView([${DEFAULT_CENTER.lat}, ${DEFAULT_CENTER.lng}], 12);

      // "Bersih" (default) is CARTO Voyager: soft colours, few shop/POI labels, roads easy to read.
      // "Detail" is standard OpenStreetMap; "Malam" is CARTO Dark Matter.
      const osmUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
      const cartoVoyager = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
      const cartoDark = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
      const credit = '&copy; OpenStreetMap';
      const tiles = {
        apple: L.tileLayer(cartoVoyager, { maxZoom: 20, subdomains: 'abcd', attribution: credit + ', &copy; CARTO', className: 'tile-clean' }),
        osm: L.tileLayer(osmUrl, { maxZoom: 19, attribution: credit }),
        dark: L.tileLayer(cartoDark, { maxZoom: 20, subdomains: 'abcd', attribution: credit + ', &copy; CARTO' })
      };
      L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map);

      const styleEl = document.createElement('style');
      styleEl.textContent =
        '.tile-clean { filter: saturate(0.9) brightness(1.02); }' +
        '.leaflet-control-attribution { font-size: 8px !important; background: rgba(255,255,255,0.6) !important; padding: 0 4px !important; }' +
        '.leaflet-container { cursor: ${editable ? 'crosshair' : 'grab'}; }' +
        '.leaflet-bottom { bottom: ${overlayBottomInset}px; }';
      document.head.appendChild(styleEl);

      let activeLayerName = '${defaultLayer === 'vector' ? 'apple' : defaultLayer}';
      let activeTiles = (tiles[activeLayerName] || tiles.apple).addTo(map);
      let tileErrorCount = 0;

      Object.values(tiles).forEach(function(tl) {
        tl.on('tileerror', function() {
          tileErrorCount++;
          if (tileErrorCount > 8) postMsg({ type: 'KIRIMIN_MAP_ERROR' });
        });
      });

      const routeLayer = L.layerGroup().addTo(map);
      const markerLayer = L.layerGroup().addTo(map);
      let lastBounds = null;
      let lastDriverPos = null;

      map.on('dragstart', function() {
        postMsg({ type: 'KIRIMIN_MAP_DRAG' });
      });

      map.on('click', function(e) {
        postMsg({ type: 'KIRIMIN_MAP_TAP', lat: e.latlng.lat, lng: e.latlng.lng });
      });

      window.updateKiriminMap = function(data) {
        if (!data) return;
        if (data.layer && tiles[data.layer] && data.layer !== activeLayerName) {
          map.removeLayer(activeTiles);
          activeLayerName = data.layer;
          activeTiles = tiles[activeLayerName].addTo(map);
        }

        routeLayer.clearLayers();
        markerLayer.clearLayers();

        const isDark = activeLayerName === 'dark';
        const pts = [];

        // Traveled portion (muted road line behind driver)
        if (data.traveled && data.traveled.length >= 2) {
          const tCoords = data.traveled.map(p => [p.lat, p.lng]);
          L.polyline(tCoords, { color: isDark ? '#334155' : '#FFFFFF', weight: 9, opacity: 0.75, lineCap: 'round', lineJoin: 'round' }).addTo(routeLayer);
          L.polyline(tCoords, { color: '#94A3B8', weight: 5, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }).addTo(routeLayer);
        }

        // Remaining active road route (Apple Maps / Google Maps vivid blue with white casing)
        const activeRoute = (data.remaining && data.remaining.length >= 2) ? data.remaining : (data.route || []);
        if (activeRoute.length >= 2) {
          const rCoords = activeRoute.map(p => [p.lat, p.lng]);
          rCoords.forEach(c => pts.push(c));
          L.polyline(rCoords, { color: isDark ? '#0F172A' : '#FFFFFF', weight: 10, opacity: 0.92, lineCap: 'round', lineJoin: 'round' }).addTo(routeLayer);
          L.polyline(rCoords, { color: '#1D4ED8', weight: 6, opacity: 0.96, lineCap: 'round', lineJoin: 'round' }).addTo(routeLayer);
          L.polyline(rCoords, { color: '#60A5FA', weight: 2.5, opacity: 0.85, dashArray: '1, 12', lineCap: 'round' }).addTo(routeLayer);
        }

        lastDriverPos = data.driverLocation ? [data.driverLocation.lat, data.driverLocation.lng] : null;

        (data.markers || []).forEach(m => {
          const pos = [m.lat, m.lng];
          pts.push(pos);
          const color = m.color || '#1463F3';
          let html = '';

          if (m.type === 'driver') {
            const rot = typeof data.heading === 'number' ? Math.round(data.heading) : 0;
            html = '<div class="driver-puck-wrap">' +
              '<div class="driver-halo"></div>' +
              '<div class="driver-puck" style="transform:rotate(' + rot + 'deg)">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="#1463F3"><path d="M12 2L19 21L12 17L5 21L12 2Z"/></svg>' +
              '</div></div>';
          } else {
            const badgeText = m.type === 'pickup' ? 'A' : m.type === 'dropoff' ? 'B' : (m.orderIndex ? String(m.orderIndex) : '•');
            const tag = m.type === 'pickup' ? (m.title || 'Jemput') : m.type === 'dropoff' ? (m.title || 'Tujuan') : (m.title || '');
            html = '<div class="pin-wrap">' +
              '<div class="pin-head" style="background:' + color + ';">' + badgeText + '</div>' +
              '<div class="pin-stem" style="background:' + color + ';"></div>' +
              (tag ? '<div class="pin-label" style="color:' + (isDark ? '#0F172A' : color) + ';">' + tag + '</div>' : '') +
              '</div>';
          }

          const icon = L.divIcon({ className: '', html: html, iconSize: [0, 0] });
          const canDrag = !!data.editable && (m.type === 'pickup' || m.type === 'dropoff');
          const marker = L.marker(pos, { icon: icon, draggable: canDrag, autoPan: true, zIndexOffset: m.type === 'driver' ? 500 : 100 }).addTo(markerLayer);
          if (canDrag) {
            marker.on('dragend', function() {
              const ll = marker.getLatLng();
              postMsg({ type: 'KIRIMIN_MARKER_MOVED', markerType: m.type, lat: ll.lat, lng: ll.lng });
            });
          }
          marker.on('click', function(ev) {
            L.DomEvent.stopPropagation(ev);
            postMsg({
              type: 'KIRIMIN_MARKER_TAP',
              id: m.id,
              lat: m.lat,
              lng: m.lng,
              title: m.title,
              subtitle: m.subtitle,
              markerType: m.type,
              color: color
            });
          });
        });

        if (pts.length > 1) {
          lastBounds = L.latLngBounds(pts);
        } else {
          lastBounds = null;
        }

        if (data.followDriver && lastDriverPos) {
          map.panTo(lastDriverPos, { animate: true, duration: 0.6 });
          if (map.getZoom() < 14) map.setZoom(15);
        } else if (data.fitBounds !== false) {
          if (lastBounds) {
            map.fitBounds(lastBounds, { padding: [44, 44], maxZoom: 15 });
          } else if (pts.length === 1) {
            map.setView(pts[0], 14);
          }
        }
      };

      window.recenterKiriminMap = function(opts) {
        if (opts && opts.focusDriver && lastDriverPos) {
          map.setView(lastDriverPos, 15, { animate: true });
        } else if (lastBounds) {
          map.fitBounds(lastBounds, { padding: [44, 44], maxZoom: 15, animate: true });
        } else {
          map.setView([${DEFAULT_CENTER.lat}, ${DEFAULT_CENTER.lng}], 12);
        }
      };

      window.zoomKiriminMap = function(delta) {
        map.setZoom(map.getZoom() + delta);
      };

      window.focusKiriminPoint = function(lat, lng, zoom) {
        map.setView([lat, lng], zoom || 16, { animate: true });
      };

      window.addEventListener('message', function(ev) {
        if (!ev.data || typeof ev.data !== 'object') return;
        if (ev.data.type === 'KIRIMIN_MAP_UPDATE') window.updateKiriminMap(ev.data.payload);
        else if (ev.data.type === 'KIRIMIN_MAP_RECENTER') window.recenterKiriminMap(ev.data.payload);
        else if (ev.data.type === 'KIRIMIN_MAP_ZOOM') window.zoomKiriminMap(ev.data.payload.delta);
        else if (ev.data.type === 'KIRIMIN_MAP_FOCUS') window.focusKiriminPoint(ev.data.payload.lat, ev.data.payload.lng, ev.data.payload.zoom);
      });

      window.updateKiriminMap(${initialPayload});
      postMsg({ type: 'KIRIMIN_MAP_READY' });
    }
  </script>
</body>
</html>`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive, editable, overlayBottomInset]);

  // ─── Upgraded Offline Vector Map (South Bali Road Network SVG) ───────────────
  const vectorBounds = useMemo(() => {
    const pts = [...allMarkers, ...roadRoute.coordinates];
    const lats = pts.map((m) => m.lat);
    const lngs = pts.map((m) => m.lng);
    const minLat = Math.min(...lats, -8.805) - 0.018;
    const maxLat = Math.max(...lats, -8.67) + 0.018;
    const minLng = Math.min(...lngs, 115.165) - 0.018;
    const maxLng = Math.max(...lngs, 115.245) + 0.018;
    return {
      minLat,
      maxLat,
      minLng,
      maxLng,
      latSpan: Math.max(0.035, maxLat - minLat),
      lngSpan: Math.max(0.035, maxLng - minLng),
    };
  }, [allMarkers, roadRoute.coordinates]);

  const projectPoint = useCallback(
    (pt: LatLng, w: number, h: number) => {
      const padX = w * 0.14;
      const padY = h * 0.22;
      const nx = Math.max(0, Math.min(1, (pt.lng - vectorBounds.minLng) / vectorBounds.lngSpan));
      const ny = Math.max(0, Math.min(1, 1 - (pt.lat - vectorBounds.minLat) / vectorBounds.latSpan));
      return {
        x: padX + nx * (w - 2 * padX),
        y: padY + ny * (h - 2 * padY),
      };
    },
    [vectorBounds],
  );

  const handleVectorPress = (e: GestureResponderEvent) => {
    if (!selectionMode || !onSelectLocation) return;
    const { locationX, locationY } = e.nativeEvent;
    const w = vectorSize.width || 340;
    const h = vectorSize.height || height;
    const padX = w * 0.14;
    const padY = h * 0.22;
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

  const renderVectorMap = (canvasHeight: number) => {
    const w = vectorSize.width || 340;
    const h = canvasHeight;
    const activePts = (driverLocation ? navProgress.remaining : roadRoute.coordinates).map((p) =>
      projectPoint(p, w, h),
    );
    const traveledPts = (driverLocation ? navProgress.traveled : []).map((p) =>
      projectPoint(p, w, h),
    );
    const toPath = (pts: { x: number; y: number }[]) =>
      pts.length >= 2 ? pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') : '';

    return (
      <Pressable
        onLayout={handleVectorLayout}
        onPress={handleVectorPress}
        disabled={!selectionMode}
        style={[styles.vectorCanvas, { height: h }]}
      >
        <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
          {/* Clean Apple Maps warm land & coastal ocean */}
          <Rect x={0} y={0} width={w} height={h} fill="#F2F4F0" />
          <SvgPath
            d={`M 0 ${h * 0.78} Q ${w * 0.35} ${h * 0.72} ${w * 0.6} ${h * 0.84} T ${w} ${h * 0.74} L ${w} ${h} L 0 ${h} Z`}
            fill="#CFE7FA"
          />
          {/* Green parks (Renon & Bukit) */}
          <SvgCircle cx={w * 0.72} cy={h * 0.22} r={28} fill="#D9F2D9" />
          <SvgCircle cx={w * 0.25} cy={h * 0.84} r={32} fill="#D9F2D9" />
          {/* South Bali arterial road grid */}
          <Line x1={0} y1={h * 0.28} x2={w} y2={h * 0.22} stroke="#FFFFFF" strokeWidth={8} strokeLinecap="round" />
          <Line x1={w * 0.22} y1={0} x2={w * 0.16} y2={h} stroke="#FFFFFF" strokeWidth={8} strokeLinecap="round" />
          <Line x1={0} y1={h * 0.62} x2={w} y2={h * 0.56} stroke="#FEF08A" strokeWidth={9} strokeLinecap="round" />
          <Line x1={w * 0.68} y1={0} x2={w * 0.44} y2={h} stroke="#FFFFFF" strokeWidth={10} strokeLinecap="round" />
          <Line x1={w * 0.38} y1={h * 0.48} x2={w * 0.86} y2={h * 0.76} stroke="#FEF08A" strokeWidth={7} strokeLinecap="round" />

          {/* Road name hints */}
          <SvgText x={w * 0.56} y={h * 0.53} fill="#64748B" fontSize="9" fontWeight="600">
            Jl. Bypass Ngurah Rai
          </SvgText>
          <SvgText x={w * 0.12} y={h * 0.24} fill="#64748B" fontSize="9" fontWeight="600">
            Denpasar
          </SvgText>

          {/* Traveled road polyline */}
          {traveledPts.length >= 2 ? (
            <SvgPath
              d={toPath(traveledPts)}
              stroke="#94A3B8"
              strokeWidth={5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}

          {/* Remaining road polyline with white casing */}
          {activePts.length >= 2 ? (
            <>
              <SvgPath
                d={toPath(activePts)}
                stroke="#FFFFFF"
                strokeWidth={10}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <SvgPath
                d={toPath(activePts)}
                stroke="#1D4ED8"
                strokeWidth={5.5}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          ) : null}

          {/* Markers */}
          {allMarkers.map((m, idx) => {
            const p = projectPoint(m, w, h);
            const c = m.color || colors.primary;
            return (
              <React.Fragment key={`${m.id || m.type || 'pin'}-${idx}`}>
                <SvgCircle cx={p.x} cy={p.y} r={14} fill={c} fillOpacity={0.22} />
                <SvgCircle cx={p.x} cy={p.y} r={9} fill="#FFFFFF" />
                <SvgCircle cx={p.x} cy={p.y} r={6} fill={c} />
              </React.Fragment>
            );
          })}
        </Svg>
      </Pressable>
    );
  };

  const useVector = layer === 'vector' || webFailed;

  const renderMapSurface = (surfaceHeight: number, fullscreenSurface: boolean) => {
    const activeStep = navProgress.activeStep;
    const isNight = layer === 'dark';

    return (
      <View
        style={[
          styles.container,
          fullscreenSurface ? styles.fullscreenContainer : { height },
          !fullscreenSurface && style,
        ]}
        onTouchStart={fullscreenSurface ? undefined : () => onInteractionChange?.(true)}
        onTouchEnd={fullscreenSurface ? undefined : () => onInteractionChange?.(false)}
        onTouchCancel={fullscreenSurface ? undefined : () => onInteractionChange?.(false)}
      >
        {useVector ? (
          renderVectorMap(surfaceHeight)
        ) : Platform.OS === 'web' ? (
          <iframe
            ref={(fullscreenSurface ? fullIframeRef : iframeRef) as any}
            srcDoc={initialHtml}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              borderRadius: fullscreenSurface ? 0 : radii.lg,
            }}
            title="Peta"
          />
        ) : (
          <NativeWebView
            ref={fullscreenSurface ? fullWebViewRef : webViewRef}
            originWhitelist={['*']}
            source={{ html: initialHtml }}
            scrollEnabled={false}
            nestedScrollEnabled
            onError={() => setWebFailed(true)}
            onMessage={(event: { nativeEvent: { data: string } }) => {
              try {
                handleBridgeMessage(JSON.parse(event.nativeEvent.data));
              } catch {
                // ignore
              }
            }}
            style={styles.webview}
          />
        )}

        {/* Turn-by-Turn Navigation HUD Banner (Apple / Google Maps Driver Style) */}
        {navigationMode && activeStep && !selectionMode ? (
          <View style={styles.navHudWrap}>
            <Pressable
              onPress={() => setShowStepsSheet(true)}
              style={[styles.navHudBanner, isNight && styles.navHudBannerDark]}
              accessibilityLabel="Buka panduan belokan rute"
            >
              <View style={styles.navIconBox}>
                <ManeuverIcon type={activeStep.maneuver} size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, marginHorizontal: spacing.sm }}>
                <View style={styles.navDistanceRow}>
                  <Text variant="headline" color="#FFFFFF" weight="700">
                    {formatStepDistance(navProgress.distanceToNextM || activeStep.distanceM)}
                  </Text>

                </View>
                <Text variant="captionMedium" color="#ECFDF5" numberOfLines={1}>
                  {activeStep.instruction}
                </Text>
              </View>
              <View style={styles.stepsChip}>
                <List size={14} color="#FFFFFF" />
                <Text variant="caption" color="#FFFFFF" weight="700" style={{ marginLeft: 3, fontSize: 10 }}>
                  {roadRoute.steps.length}
                </Text>
              </View>
            </Pressable>
          </View>
        ) : null}

        {/* Selection mode prompt banner */}
        {editable && onSelectionModeChange ? (
          <View style={styles.targetSwitch}>
            <Text variant="caption" color={colors.text.secondary} weight="600" style={{ marginHorizontal: 6 }}>
              Ketuk peta:
            </Text>
            {(['pickup', 'dropoff'] as const).map((t) => {
              const on = selectionMode === t;
              const tint = t === 'pickup' ? colors.primary : colors.senja;
              return (
                <Pressable
                  key={t}
                  onPress={() => onSelectionModeChange(t)}
                  style={[styles.targetOpt, on && { backgroundColor: tint }]}
                  hitSlop={4}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  testID={`map-target-${t}`}
                >
                  <View style={[styles.targetDot, { backgroundColor: on ? '#FFFFFF' : tint }]} />
                  <Text variant="caption" weight="700" color={on ? '#FFFFFF' : colors.text.primary}>
                    {t === 'pickup' ? 'Jemput' : 'Antar'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : selectionMode ? (
          <View style={styles.selectionBanner} pointerEvents="none">
            <MapPin size={12} color="#FFF" />
            <Text variant="captionMedium" color="#FFF" weight="700" style={{ marginLeft: 5, fontSize: 11 }}>
              Ketuk peta untuk menaruh pin
            </Text>
          </View>
        ) : null}

        {/* Interactive Marker Quick Card (appears when user taps a marker) */}
        {selectedMarker ? (
          <View style={styles.markerCard}>
            <View style={[styles.markerDotBadge, { backgroundColor: selectedMarker.color || colors.primary }]}>
              <MapPin size={14} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1, marginHorizontal: spacing.sm }}>
              <Text variant="calloutSemibold" color={colors.text.primary} numberOfLines={1}>
                {selectedMarker.title || 'Titik Peta'}
              </Text>
              <Text variant="caption" color={colors.text.secondary} numberOfLines={1}>
                {selectedMarker.subtitle || `${selectedMarker.lat.toFixed(4)}, ${selectedMarker.lng.toFixed(4)}`}
              </Text>
            </View>
            <Pressable
              onPress={() => handleFocusPoint(selectedMarker.lat, selectedMarker.lng, 16)}
              style={styles.markerFocusBtn}
            >
              <Text variant="captionMedium" color={colors.primary} weight="700">
                Fokus
              </Text>
            </Pressable>
            <Pressable onPress={() => setSelectedMarker(null)} style={styles.markerCloseBtn} hitSlop={8}>
              <X size={14} color={colors.text.secondary} />
            </Pressable>
          </View>
        ) : null}

        {/* Bottom-left Live ETA & Distance Capsule (Apple Maps / Gojek Style) */}
        {roadRoute.distanceKm > 0 && !selectedMarker ? (
          <Pressable
            onPress={() => roadRoute.steps.length > 0 && setShowStepsSheet(true)}
            style={[
              styles.etaCapsule,
              isNight && styles.etaCapsuleDark,
              !fullscreenSurface && overlayBottomInset ? { bottom: spacing.sm + overlayBottomInset } : null,
            ]}
          >
            <Clock size={12} color={isNight ? '#34D399' : colors.driver} />
            <Text
              variant="captionMedium"
              color={isNight ? '#FFFFFF' : colors.text.primary}
              weight="700"
              style={{ marginLeft: 4, fontSize: 11 }}
            >
              {driverLocation ? navProgress.remainingMin : roadRoute.durationMin} mnt
            </Text>
            <View style={styles.etaDot} />
            <Navigation size={11} color={isNight ? '#60A5FA' : colors.primary} />
            <Text
              variant="captionMedium"
              color={isNight ? '#E2E8F0' : colors.text.secondary}
              weight="600"
              style={{ marginLeft: 3, fontSize: 11 }}
            >
              {(driverLocation ? navProgress.remainingKm : roadRoute.distanceKm).toFixed(1).replace('.', ',')} km
            </Text>
          </Pressable>
        ) : null}

        {/* Right Floating Map Controls */}
        {showSettings ? (
          <View
            style={[
              styles.controlsCol,
              navigationMode && activeStep && !selectionMode ? { top: 76 } : { top: spacing.sm },
            ]}
          >
            {allowExpand ? (
              <Pressable
                onPress={() => setIsFullscreen((v) => !v)}
                style={styles.controlBtn}
                accessibilityLabel={fullscreenSurface ? 'Kecilkan peta' : 'Perluas peta layar penuh'}
              >
                {fullscreenSurface ? (
                  <Minimize2 size={15} color={colors.text.primary} />
                ) : (
                  <Maximize2 size={15} color={colors.text.primary} />
                )}
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => setShowLayerMenu((v) => !v)}
              style={[styles.controlBtn, showLayerMenu && styles.controlBtnActive]}
              accessibilityLabel="Pengaturan lapisan peta"
            >
              <Layers size={15} color={showLayerMenu ? '#FFFFFF' : colors.text.primary} />
            </Pressable>

            {!useVector && interactive ? (
              <>
                <Pressable
                  onPress={handleRecenter}
                  style={[
                    styles.controlBtn,
                    followDriver && driverLocation && navigationMode && styles.controlBtnActive,
                  ]}
                  accessibilityLabel="Pusatkan rute atau ikuti driver"
                >
                  {navigationMode && driverLocation ? (
                    <Compass
                      size={15}
                      color={followDriver ? '#FFFFFF' : colors.text.primary}
                    />
                  ) : (
                    <Crosshair size={15} color={colors.text.primary} />
                  )}
                </Pressable>
                {fullscreenSurface || surfaceHeight >= 220 ? (
                  <>
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
              </>
            ) : null}
          </View>
        ) : null}

        {/* Layer Switcher Popover (Apple Clean, OSM Detail, Night Mode, Vector Offline) */}
        {showSettings && showLayerMenu ? (
          <View
            style={[
              styles.layerMenu,
              navigationMode && activeStep && !selectionMode ? { top: 76 } : { top: spacing.sm },
            ]}
          >
            {(
              [
                { id: 'apple', label: 'Bersih', icon: 'sun' },
                { id: 'osm', label: 'Detail', icon: 'map' },
                { id: 'dark', label: 'Malam', icon: 'moon' },
                { id: 'vector', label: 'Sederhana', icon: 'offline' },
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
                  {opt.icon === 'moon' ? (
                    <Moon size={13} color={active ? colors.primary : colors.text.secondary} style={{ marginRight: 6 }} />
                  ) : (
                    <Sun size={13} color={active ? colors.primary : colors.text.secondary} style={{ marginRight: 6 }} />
                  )}
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
  };

  return (
    <>
      {renderMapSurface(height, false)}

      {/* Fullscreen Interactive Map Modal */}
      <Modal
        visible={isFullscreen}
        animationType="slide"
        onRequestClose={() => setIsFullscreen(false)}
      >
        <View style={styles.fullscreenModal}>
          {renderMapSurface(640, true)}
          <Pressable onPress={() => setIsFullscreen(false)} style={styles.fullscreenClosePill}>
            <Minimize2 size={15} color="#FFFFFF" />
            <Text variant="captionMedium" color="#FFFFFF" weight="700" style={{ marginLeft: 6 }}>
              Tutup
            </Text>
          </Pressable>
        </View>
      </Modal>

      {/* Turn-by-Turn Route Steps Sheet */}
      <Modal
        visible={showStepsSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStepsSheet(false)}
      >
        <View style={styles.stepsOverlay}>
          <Pressable style={styles.stepsBackdrop} onPress={() => setShowStepsSheet(false)} />
          <View style={styles.stepsSheet}>
            <View style={styles.stepsHandle} />
            <View style={styles.stepsHeader}>
              <View>
                <Text variant="headline" color={colors.text.primary} weight="700">
                  Petunjuk arah
                </Text>
                <Text variant="caption" color={colors.text.secondary}>
                  Estimasi {roadRoute.durationMin} menit • {roadRoute.distanceKm.toFixed(1).replace('.', ',')} km ({roadRoute.steps.length} langkah)
                </Text>
              </View>
              <Pressable onPress={() => setShowStepsSheet(false)} style={styles.stepsCloseBtn}>
                <X size={18} color={colors.text.primary} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.stepsList}>
              {roadRoute.steps.map((step: RouteStep, index: number) => {
                const isCurrent = navProgress.activeStep?.id === step.id;
                return (
                  <Pressable
                    key={step.id}
                    onPress={() => {
                      handleFocusPoint(step.location.lat, step.location.lng, 16);
                      setShowStepsSheet(false);
                    }}
                    style={[styles.stepRow, isCurrent && styles.stepRowActive]}
                  >
                    <View style={[styles.stepIconCircle, isCurrent && styles.stepIconCircleActive]}>
                      <ManeuverIcon
                        type={step.maneuver}
                        size={16}
                        color={isCurrent ? '#FFFFFF' : colors.primary}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: spacing.md }}>
                      <Text variant="calloutSemibold" color={colors.text.primary}>
                        {step.instruction}
                      </Text>
                      <Text variant="caption" color={colors.text.secondary}>
                        {step.roadName}
                        {step.distanceM > 0 ? ` • ${formatStepDistance(step.distanceM)}` : ''}
                      </Text>
                    </View>
                    <Text variant="captionMedium" color={colors.text.muted}>
                      #{index + 1}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: '#E9EFF6',
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
  },
  fullscreenContainer: {
    flex: 1,
    borderRadius: 0,
    borderWidth: 0,
  },
  fullscreenModal: {
    flex: 1,
    backgroundColor: '#0F172A',
    position: 'relative',
  },
  fullscreenClosePill: {
    position: 'absolute',
    bottom: 28,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: radii.full,
    ...shadows.float,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  vectorCanvas: {
    width: '100%',
    position: 'relative',
  },
  navHudWrap: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
  },
  navHudBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(6, 78, 59, 0.96)',
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    ...shadows.float,
  },
  navHudBannerDark: {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
  },
  navIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(52, 211, 153, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navDistanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roadPill: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.full,
  },
  stepsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radii.md,
  },
  targetSwitch: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: radii.full,
    padding: 3,
    ...shadows.card,
  },
  targetOpt: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
    gap: 5,
  },
  targetDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  selectionBanner: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    right: 52,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 99, 243, 0.94)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    ...shadows.card,
  },
  etaCapsule: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.card,
  },
  etaCapsuleDark: {
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderColor: 'rgba(148, 163, 184, 0.3)',
  },
  etaDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.text.muted,
    marginHorizontal: 6,
  },
  markerCard: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: radii.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.float,
  },
  markerDotBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerFocusBtn: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
    marginRight: 6,
  },
  markerCloseBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlsCol: {
    position: 'absolute',
    right: spacing.sm,
    gap: 6,
  },
  controlBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  controlBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  layerMenu: {
    position: 'absolute',
    right: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: radii.md,
    padding: 5,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.float,
    minWidth: 172,
  },
  layerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radii.sm,
  },
  layerOptionActive: {
    backgroundColor: colors.primaryLight,
  },
  stepsOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  stepsBackdrop: {
    flex: 1,
  },
  stepsSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    maxHeight: '72%',
  },
  stepsHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  stepsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  stepsCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepsList: {
    gap: spacing.xs,
    paddingBottom: spacing.lg,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  stepRowActive: {
    backgroundColor: colors.primarySubtle,
    borderColor: colors.primary,
  },
  stepIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIconCircleActive: {
    backgroundColor: colors.primary,
  },
});
