import React from 'react';
import { Tabs } from 'expo-router';
import { Home, Package, Bell, User } from '../../src/ui/icons';
import { colors, typography, fonts } from '../../src/theme/tokens';
import { useNotifications } from '../../src/api/hooks/useApi';

export default function KirimTabsLayout() {
  const { data: notifData } = useNotifications();
  const unreadCount = notifData?.unreadCount || 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.borderLight,
          height: 74,
          paddingBottom: 14,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          ...typography.captionMedium,
          fontFamily: fonts['600'],
          fontWeight: undefined,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="beranda"
        options={{
          title: 'Beranda',
          tabBarIcon: ({ color, focused }) => <Home size={24} color={color} weight={focused ? 'fill' : 'duotone'} />,
        }}
      />
      <Tabs.Screen
        name="aktivitas"
        options={{
          title: 'Aktivitas',
          tabBarIcon: ({ color, focused }) => <Package size={24} color={color} weight={focused ? 'fill' : 'duotone'} />,
        }}
      />
      <Tabs.Screen
        name="notifikasi"
        options={{
          title: 'Notifikasi',
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarIcon: ({ color, focused }) => <Bell size={24} color={color} weight={focused ? 'fill' : 'duotone'} />,
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, focused }) => <User size={24} color={color} weight={focused ? 'fill' : 'duotone'} />,
        }}
      />
    </Tabs>
  );
}

