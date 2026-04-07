import React, { useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { AuthProvider, useAuth } from "./src/AuthContext";
import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import TasksScreen from "./src/screens/TasksScreen";
import CalendarScreen from "./src/screens/CalendarScreen";

const Tab = createBottomTabNavigator();

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = { Tasks: "☑", Calendar: "📅" };
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{icons[name]}</Text>;
}

function AppContent() {
  const { user, loading } = useAuth();
  const [authView, setAuthView] = useState<"login" | "register">("login");

  if (loading) return (
    <View style={s.loading}><ActivityIndicator size="large" color="#1a56db" /></View>
  );

  if (!user) {
    if (authView === "register") return <RegisterScreen onLogin={() => setAuthView("login")} />;
    return <LoginScreen onRegister={() => setAuthView("register")} onForgot={() => {}} />;
  }

  return (
    <NavigationContainer>
      <Tab.Navigator screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarActiveTintColor: "#1a56db",
        tabBarInactiveTintColor: "#9aa5b4",
        tabBarStyle: { backgroundColor: "#fff", borderTopColor: "#e2e6ed", paddingBottom: 4 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
      })}>
        <Tab.Screen name="Tasks" component={TasksScreen} />
        <Tab.Screen name="Calendar" component={CalendarScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f0f2f5" },
});
