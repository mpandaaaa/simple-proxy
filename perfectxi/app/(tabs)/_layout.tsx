import { Tabs } from 'expo-router';
import { Platform, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { color } from '../../src/ui/tokens';
import { font } from '../../src/ui/type';
import { IconToday, IconPlay, IconCareer, IconYou } from '../../src/ui/icons';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.accent,
        tabBarInactiveTintColor: color.text3,
        tabBarStyle: {
          backgroundColor: color.surface1,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: color.border,
          // The blur that iOS puts behind a tab bar washes out a dark
          // surface, so the bar is painted solid instead.
          position: Platform.OS === 'ios' ? 'absolute' : 'relative',
        },
        tabBarBackground: () => null,
        tabBarLabelStyle: {
          fontFamily: font.displaySemi,
          fontSize: 11,
          letterSpacing: 1.1,
          textTransform: 'uppercase',
        },
      }}
      screenListeners={{
        tabPress: () => {
          Haptics.selectionAsync();
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color: c }) => <IconToday color={c} />,
        }}
      />
      <Tabs.Screen
        name="play"
        options={{
          title: 'Play',
          tabBarIcon: ({ color: c }) => <IconPlay color={c} />,
        }}
      />
      <Tabs.Screen
        name="career"
        options={{
          title: 'Career',
          tabBarIcon: ({ color: c }) => <IconCareer color={c} />,
        }}
      />
      <Tabs.Screen
        name="you"
        options={{
          title: 'You',
          tabBarIcon: ({ color: c }) => <IconYou color={c} />,
        }}
      />
    </Tabs>
  );
}
