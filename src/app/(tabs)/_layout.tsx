import { View, StyleSheet, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MiniPlayer } from '@/features/player/MiniPlayer';
import { colors } from '@/theme/colors';

const TAB_BAR_HEIGHT = 60;

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = TAB_BAR_HEIGHT + insets.bottom;

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: 'transparent',
            height: tabBarHeight,
            paddingBottom: insets.bottom + 4,
            paddingTop: 6,
            // Subtle top shadow instead of hard border
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -1 },
            shadowOpacity: 0.15,
            shadowRadius: 4,
            elevation: 8,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textTertiary,
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
            marginTop: -2,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: 'Search',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'search' : 'search-outline'} size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="library"
          options={{
            title: 'Library',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'library' : 'library-outline'} size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'settings' : 'settings-outline'} size={22} color={color} />
            ),
          }}
        />
      </Tabs>
      {/* MiniPlayer sits above the tab bar */}
      <View style={[styles.miniPlayerWrapper, { bottom: tabBarHeight }]}>
        <MiniPlayer />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  miniPlayerWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 100,
    elevation: 12,
  },
});
