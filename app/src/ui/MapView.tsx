import React, { useMemo } from 'react';
import { StyleSheet, View, ViewStyle, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import type { Place, LatLng } from '@kirimin/shared';
import { colors, radii } from '../theme/tokens';
import { Text } from './Text';

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
}

export function MapView({
  pickup,
  dropoff,
  driverLocation,
  stops = [],
  markers: customMarkers,
  interactive = true,
  height = 200,
  style,
}: MapViewProps) {
  // Build marker list
  const allMarkers = useMemo(() => {
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
        title: (s as Place).label || `Pemberhentian ${idx + 1}`,
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

    // Default to Denpasar if empty
    if (list.length === 0) {
      list.push({
        lat: -8.6726,
        lng: 115.2335,
        title: 'Denpasar',
        color: colors.primary,
      });
    }

    return list;
  }, [pickup, dropoff, driverLocation, stops, customMarkers]);

  // Leaflet HTML template
  const htmlContent = useMemo(() => {
    const center = allMarkers[0] || { lat: -8.6726, lng: 115.2335 };
    const markersJson = JSON.stringify(allMarkers);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body, html, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #F5F7FA; }
          .custom-pin {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          const map = L.map('map', {
            zoomControl: ${interactive},
            attributionControl: false,
            dragging: ${interactive},
            touchZoom: ${interactive},
            doubleClickZoom: ${interactive},
            scrollWheelZoom: ${interactive}
          }).setView([${center.lat}, ${center.lng}], 13);

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19
          }).addTo(map);

          const markers = ${markersJson};
          const latLngs = [];

          markers.forEach(m => {
            const pos = [m.lat, m.lng];
            latLngs.push(pos);
            const icon = L.divIcon({
              className: 'custom-icon',
              html: '<div class="custom-pin" style="background-color: ' + (m.color || '#1463F3') + ';"></div>',
              iconSize: [24, 24],
              iconAnchor: [12, 12]
            });
            const marker = L.marker(pos, { icon }).addTo(map);
            if (m.title) {
              marker.bindPopup(m.title);
            }
          });

          if (latLngs.length > 1) {
            L.polyline(latLngs, { color: '#1463F3', weight: 4, opacity: 0.8, dashArray: '6, 8' }).addTo(map);
            map.fitBounds(L.latLngBounds(latLngs), { padding: [30, 30] });
          }
        </script>
      </body>
      </html>
    `;
  }, [allMarkers, interactive]);

  // If on web or webview unsupported, fallback view
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { height }, style]}>
        <iframe
          srcDoc={htmlContent}
          style={{ width: '100%', height: '100%', border: 'none', borderRadius: radii.lg }}
          title="Map View"
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }, style]}>
      <WebView
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        scrollEnabled={false}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

