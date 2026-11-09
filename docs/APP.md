# Kirimin Mobile App Architecture & Component System

This document describes the structure of the mobile app (`app/`), the component system, design tokens, and instructions for adding new screens.

## Overview

The mobile app is built with:
- **Expo SDK 58 + React Native + TypeScript**
- **expo-router** (file-based navigation with tab groups and modal stacks)
- **@tanstack/react-query** (server state, caching, background polling)
- **expo-secure-store** (encrypted token storage)
- **expo-image-picker** & **expo-file-system** (photo capture and binary uploads)
- **react-native-sse** (realtime server-sent events for orders, trips, and chat)
- **react-native-webview + Leaflet** (lightweight OSM mapping wrapper)

---

## Directory Layout

```
app/
├── app/                        # expo-router routes ONLY (thin controllers)
│   ├── _layout.tsx             # Root layout: QueryClient, AuthProvider, Realtime SSE
│   ├── index.tsx               # Auth & activeRole redirector
│   ├── (auth)/                 # Auth group
│   │   ├── welcome.tsx         # O1: Splash & quick demo logins
│   │   ├── login.tsx           # O1: Masuk
│   │   ├── register.tsx        # O1: Daftar
│   │   └── pilih-peran.tsx     # O2: Pilih Peran (Kirim vs Angkut)
│   ├── (kirim)/                # Sender tab navigator (O3, O4, O5, ST1)
│   │   ├── beranda.tsx         # Home with active order banner & Kirim CTA
│   │   ├── aktivitas.tsx       # Active & completed send history
│   │   ├── notifikasi.tsx      # Notifications & mark as read
│   │   └── profil.tsx          # Sender profile & switch to driver mode
│   ├── (angkut)/               # Driver tab navigator (O3, D6, O4/D9, ST1)
│   │   ├── beranda.tsx         # Driver home with active trip & earnings
│   │   ├── rute.tsx            # D6: Published & ongoing routes
│   │   ├── aktivitas.tsx       # Manifested deliveries
│   │   └── profil.tsx          # Driver profile, vehicle info, role switch
│   ├── kirim/                  # Sender flow stack
│   │   ├── paket.tsx           # S1: Package details & photo
│   │   ├── rute.tsx            # S2: Pickup, dropoff & price estimate
│   │   ├── driver.tsx          # S3: Route matching (Direct & Detour)
│   │   ├── konfirmasi.tsx      # S4: Order review & submission
│   │   ├── lacak/[id].tsx      # S5: Live tracking & 4-digit code display
│   │   ├── menunggu/[id].tsx   # S6: Open request waiting state
│   │   └── batal/[id].tsx      # S7: Order cancellation & refund calculation
│   ├── angkut/                 # Driver flow stack
│   │   ├── buat-rute.tsx       # D1-D2: Publish new route
│   │   ├── permintaan/[tripId].tsx # D3: Incoming requests
│   │   ├── detail-permintaan/[id].tsx # D4: Request details (Accept / Decline)
│   │   └── jalan/[tripId].tsx  # D5: Ongoing trip, GPS ping & manifest
│   ├── chat/[orderId].tsx      # X1: Realtime chat between sender and driver
│   ├── serah-terima/[orderId].tsx # X2: 4-digit handover code entry & proof photo
│   ├── rating/[orderId].tsx    # X3: 5-star rating & tags
│   ├── bayar/[orderId].tsx     # P1: Payment method selector (mocked)
│   └── placeholder.tsx         # "Segera hadir" placeholder for future features
└── src/
    ├── theme/
    │   └── tokens.ts           # Design tokens (colors, spacing, typography, radii)
    ├── ui/                     # Design system components
    │   ├── Text.tsx
    │   ├── Button.tsx
    │   ├── IconButton.tsx
    │   ├── Card.tsx
    │   ├── ListItem.tsx
    │   ├── Chip.tsx & ChipGroup.tsx
    │   ├── SegmentedControl.tsx
    │   ├── TextField.tsx
    │   ├── Stepper.tsx
    │   ├── StatusPill.tsx
    │   ├── Avatar.tsx
    │   ├── PriceRow.tsx
    │   ├── Divider.tsx
    │   ├── BottomSheet.tsx
    │   ├── Dialog.tsx
    │   ├── TopBar.tsx
    │   ├── Skeleton.tsx
    │   ├── EmptyState.tsx
    │   ├── ErrorState.tsx
    │   ├── MapView.tsx
    │   ├── ProgressSteps.tsx
    │   ├── CodeDisplay.tsx
    │   └── CodeInput.tsx
    ├── api/
    │   ├── client.ts           # HTTP client with Bearer auth & binary upload
    │   ├── hooks/useApi.ts     # React Query hooks for orders, trips, auth
    │   └── sse.ts              # Server-Sent Events realtime listener
    ├── auth/
    │   ├── AuthContext.tsx     # Context providing user, token, activeRole
    │   └── storage.ts          # SecureStore token persistence
    └── utils/
        ├── config.ts           # API URL resolver
        └── format.ts           # Rupiah, time, and distance formatters
```

---

## Design Tokens (`src/theme/tokens.ts`)

The app strictly uses design tokens rather than raw CSS or hex values:

- **Colors**:
  - `primary`: `#1463F3` (Brand Blue), `primaryPressed`: `#0E4BC1`, `primaryLight`: `#EBF2FE`
  - `background`: `#F5F7FA`, `surface`: `#FFFFFF`
  - `semantic`: `success: #16A34A`, `warning: #D97706` (simpangan), `danger: #DC2626`
- **Typography**: Apple HIG scale (`largeTitle`, `title`, `headline`, `body`, `callout`, `caption`).
- **Spacing**: 8-pt grid (`4, 8, 12, 16, 20, 24, 32, 40`).
- **Touch Target**: Minimum 44×44 pt touchables.

---

## Component System (`src/ui/`)

All presentational components are typed, reusable, and accessible:

- **`Text`**: Semantic typography variants (`variant="largeTitle|title|headline|body|caption"`).
- **`Button`**: Variants (`primary|secondary|ghost|danger|outline`), sizes (`lg|md|sm`), loading spinner, and 44pt touch targets.
- **`Card`**: Elevated, flat, or outlined cards with 16pt border radius.
- **`StatusPill`**: Renders domain `OrderStatus` and `TripStatus` using official Indonesian domain labels and corresponding status colors.
- **`MapView`**: Wrap around `react-native-webview` + Leaflet + OpenStreetMap tiles without requiring proprietary API keys.
- **`ProgressSteps`**: S5 5-step horizontal tracker (`Diterima → Dijemput → Jalan → Tiba → Selesai`).
- **`CodeDisplay`**: Prominent 4-digit handover code card with one-click copy.
- **`CodeInput`**: 4-box pin input for the driver to confirm delivery on X2.

---

## How to Add a New Screen

1. **Add Route File**:
   Create a new file in `app/app/<route>.tsx`. For example, `app/app/kirim/struk/[id].tsx`.
2. **Use Design Tokens & `src/ui`**:
   Import presentational components exclusively from `../../src/ui` and tokens from `../../src/theme/tokens`.
3. **Connect API Hooks**:
   Use React Query hooks from `../../src/api/hooks/useApi`.
4. **Handle 3 States**:
   Every data-driven screen must provide:
   - **Loading**: `<SkeletonCard />`
   - **Empty**: `<EmptyState title="..." description="..." />`
   - **Error**: `<ErrorState message="..." onRetry={...} />`
