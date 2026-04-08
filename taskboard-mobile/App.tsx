import React, { useState } from "react";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { View, Text, ActivityIndicator, StyleSheet, useColorScheme } from "react-native";
import { AuthProvider, useAuth } from "./src/AuthContext";
import { ThemeProvider, useTheme } from "./src/theme";
import { ProjectProvider } from "./src/ProjectContext";
import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import TasksScreen from "./src/screens/TasksScreen";
import CalendarScreen from "./src/screens/CalendarScreen";
import SettingsScreen from "./src/screens/SettingsScreen";

const Tab = createBottomTabNavigator();

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = { Tasks: "☑", Calendar: "📅", Settings: "⚙️" };
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{icons[name]}</Text>;
}

function AppContent() {
  const { user, loading } = useAuth();
  const [authView, setAuthView] = useState<"login" | "register">("login");
  const { theme, isDark } = useTheme();

  const navigationTheme = isDark ? {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: theme.brandPrimary,
      background: theme.bgPrimary,
      card: theme.bgSecondary,
      text: theme.textPrimary,
      border: theme.borderDefault,
    },
  } : {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: theme.brandPrimary,
      background: theme.bgPrimary,
      card: theme.bgSecondary,
      text: theme.textPrimary,
      border: theme.borderDefault,
    },
  };

  if (loading) return (
    <View style={[s.loading, { backgroundColor: theme.bgPrimary }]}>
      <ActivityIndicator size="large" color={theme.brandPrimary} />
    </View>
  );

  if (!user) {
    if (authView === "register") return <RegisterScreen onLogin={() => setAuthView("login")} />;
    return <LoginScreen onRegister={() => setAuthView("register")} onForgot={() => {}} />;
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      <Tab.Navigator screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarActiveTintColor: theme.brandPrimary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: { 
          backgroundColor: theme.bgSecondary, 
          borderTopColor: theme.borderDefault, 
          paddingBottom: 4 
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
      })}>
        <Tab.Screen name="Tasks" component={TasksScreen} />
        <Tab.Screen name="Calendar" component={CalendarScreen} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <ProjectProvider>
            <AppContent />
          </ProjectProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
});
