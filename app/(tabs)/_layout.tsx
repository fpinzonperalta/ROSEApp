import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native'; // Importante para detectar Web

export default function TabsLayout() {
  // 1. Detectamos si estamos en Web
  const isWeb = Platform.OS === 'web';

  return (
    <Tabs screenOptions={{ 
      tabBarActiveTintColor: '#007AFF',
      headerShown: false,
      tabBarInactiveTintColor: '#8e8e93',
      tabBarStyle: {
        backgroundColor: '#ffffff',
        borderTopWidth: 0,
        elevation: 5,
        shadowOpacity: 0.1,
      }
    }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Ventas',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'cart' : 'cart-outline'} size={24} color={color} />
          ),
        }}
      />
      
      <Tabs.Screen
        name="reporte"
        options={{
          title: 'Reporte',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'bar-chart' : 'bar-chart-outline'} size={24} color={color} />
          ),
        }}
      />

      {/* 2. Pestaña condicional: Solo se renderiza si es Web */}
      {isWeb && (
        <Tabs.Screen
          name="admin"
          options={{
            title: 'Admin Web',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'settings' : 'settings-outline'} size={24} color={color} />
            ),
          }}
        />
      )}
    </Tabs>
  );
}