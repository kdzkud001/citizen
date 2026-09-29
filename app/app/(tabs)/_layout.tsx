import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";

import { Icon } from "@/components/Icon";
import { Colors } from "@/constants/Colors";

function TabIcon({ ios, android, color }: { ios: string; android: string; color: ColorValue }) {
  return <Icon icon={{ ios, android }} color={color} size={24} />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerTitleAlign: "left",
        headerStyle: { backgroundColor: Colors.background },
        headerTitleStyle: { color: Colors.text, fontSize: 24, fontWeight: "800" },
        headerShadowVisible: false,
        tabBarActiveTintColor: Colors.tint,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: { backgroundColor: Colors.card, borderTopColor: Colors.border },
        sceneStyle: { backgroundColor: Colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          // Home draws its own greeting header.
          headerShown: false,
          tabBarIcon: ({ color }) => <TabIcon ios="house.fill" android="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="habits"
        options={{
          title: "Habits",
          tabBarIcon: ({ color }) => <TabIcon ios="checkmark.circle.fill" android="check_circle" color={color} />,
        }}
      />
      <Tabs.Screen
        name="wellness"
        options={{
          title: "Wellness",
          tabBarIcon: ({ color }) => <TabIcon ios="circle.hexagongrid.fill" android="hub" color={color} />,
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
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <TabIcon ios="person.crop.circle.fill" android="account_circle" color={color} />,
        }}
      />
    </Tabs>
  );
}
