import React from 'react';
import { Tabs } from 'expo-router';
import { Home, Navigation, PackageCheck, User } from '../../src/ui/icons';
import { colors, typography, fonts } from '../../src/theme/tokens';

export default function AngkutTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.driver,
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
        name="rute"
        options={{
          title: 'Rute Saya',
          tabBarIcon: ({ color, focused }) => <Navigation size={24} color={color} weight={focused ? 'fill' : 'duotone'} />,
        }}
      />
      <Tabs.Screen
        name="aktivitas"
        options={{
          title: 'Kiriman',
          tabBarIcon: ({ color, focused }) => <PackageCheck size={24} color={color} weight={focused ? 'fill' : 'duotone'} />,
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

