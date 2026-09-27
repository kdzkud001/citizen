import { Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import type { ColorValue } from "react-native";

import { useThemeColors } from "@/hooks/useThemeColors";

function TabIcon({ ios, android, color }: { ios: string; android: string; color: ColorValue }) {
  return (
    <SymbolView name={{ ios, android, web: android } as never} tintColor={color} size={24} />
  );
}

export default function TabLayout() {
  const colors = useThemeColors();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.tabIconDefault,
        headerStyle: { backgroundColor: colors.card },
        headerTitleStyle: { color: colors.text },
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <TabIcon ios="house.fill" android="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: "Workouts",
          tabBarIcon: ({ color }) => (
            <TabIcon ios="figure.strengthtraining.traditional" android="fitness_center" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="habits"
        options={{
          title: "Habits",
          tabBarIcon: ({ color }) => (
            <TabIcon ios="checkmark.circle.fill" android="check_circle" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="clan"
        options={{
          title: "Clan",
          tabBarIcon: ({ color }) => <TabIcon ios="person.3.fill" android="groups" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <TabIcon ios="gearshape.fill" android="settings" color={color} />,
        }}
      />
    </Tabs>
  );
}
