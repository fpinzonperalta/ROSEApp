import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform } from "react-native";
import { color } from "../../lib/tema";

export default function TabsLayout() {
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.fresa,
        tabBarInactiveTintColor: color.ciruelaSuave,
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
        tabBarStyle: {
          backgroundColor: color.superficie,
          borderTopColor: color.linea,
          borderTopWidth: 1,
          elevation: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Ventas",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "ice-cream" : "ice-cream-outline"} size={24} color={color as string} />
          ),
        }}
      />

      <Tabs.Screen
        name="reporte"
        options={{
          title: "Reporte",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "bar-chart" : "bar-chart-outline"} size={24} color={color as string} />
          ),
        }}
      />

      {/* Admin solo aparece en web */}
      <Tabs.Screen
        name="admin"
        options={{
          title: "Admin",
          href: isWeb ? "/admin" : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "settings" : "settings-outline"} size={24} color={color as string} />
          ),
        }}
      />
    </Tabs>
  );
}
