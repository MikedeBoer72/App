import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { StoreProvider, useStore } from './src/store';
import { theme } from './src/theme';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { SleepScreen } from './src/screens/SleepScreen';
import { NutritionScreen } from './src/screens/NutritionScreen';
import { WorkoutScreen } from './src/screens/WorkoutScreen';
import { WaterScreen } from './src/screens/WaterScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';

const Tab = createBottomTabNavigator();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: theme.colors.bg,
    card: theme.colors.bgElevated,
    text: theme.colors.text,
    border: theme.colors.cardBorder,
    primary: theme.colors.primary,
    notification: theme.colors.accent,
  },
};

function TabIcon({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.iconDot, { backgroundColor: color }]}>
      <Text style={styles.iconText}>{label}</Text>
    </View>
  );
}

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: { backgroundColor: theme.colors.bgElevated, borderTopColor: theme.colors.cardBorder },
        headerStyle: { backgroundColor: theme.colors.bg, borderBottomColor: theme.colors.cardBorder },
        headerTitleStyle: { color: theme.colors.text, fontWeight: '700' },
        headerShadowVisible: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={DashboardScreen}
        options={{
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon label="◆" color={focused ? theme.colors.accent : theme.colors.textMuted} />
          ),
        }}
      />
      <Tab.Screen
        name="Sleep"
        component={SleepScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="☾" color={focused ? theme.colors.sleep : theme.colors.textMuted} />
          ),
        }}
      />
      <Tab.Screen
        name="Nutrition"
        component={NutritionScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="◉" color={focused ? theme.colors.nutrition : theme.colors.textMuted} />
          ),
        }}
      />
      <Tab.Screen
        name="Workout"
        component={WorkoutScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="▲" color={focused ? theme.colors.workout : theme.colors.textMuted} />
          ),
        }}
      />
      <Tab.Screen
        name="Water"
        component={WaterScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="◐" color={focused ? theme.colors.water : theme.colors.textMuted} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="✦" color={focused ? theme.colors.xp : theme.colors.textMuted} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function Root() {
  const { hydrated } = useStore();
  if (!hydrated) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.colors.accent} />
        <Text style={styles.loadingText}>Summoning your stats...</Text>
      </View>
    );
  }
  return (
    <NavigationContainer theme={navTheme}>
      <Tabs />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <StoreProvider>
        <Root />
      </StoreProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: theme.colors.bg, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: theme.colors.textDim },
  iconDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  iconText: { color: theme.colors.bg, fontSize: 12, fontWeight: '800' },
});
