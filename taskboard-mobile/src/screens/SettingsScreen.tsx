import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme, ThemeMode } from "../theme";
import { useAuth } from "../AuthContext";

export default function SettingsScreen() {
  const { theme, themeMode, setThemeMode } = useTheme();
  const { logout } = useAuth();

  const themeOptions: { mode: ThemeMode; label: string; icon: string; description: string }[] = [
    { mode: "light", label: "Light", icon: "☀️", description: "Always use light theme" },
    { mode: "dark", label: "Dark", icon: "🌙", description: "Always use dark theme" },
    { mode: "system", label: "System", icon: "⚙️", description: "Match system settings" },
  ];

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bgPrimary }]} edges={["top"]}>
      <View style={s.header}>
        <Text style={[s.headerTitle, { color: theme.textPrimary }]}>Settings</Text>
      </View>

      <View style={s.section}>
        <Text style={[s.sectionLabel, { color: theme.textMuted }]}>APPEARANCE</Text>
        <View style={[s.card, { backgroundColor: theme.bgSecondary }]}>
          {themeOptions.map((option, index) => (
            <TouchableOpacity
              key={option.mode}
              style={[
                s.themeOption,
                index < themeOptions.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.borderDefault },
              ]}
              onPress={() => setThemeMode(option.mode)}
              activeOpacity={0.7}
            >
              <View style={s.themeOptionLeft}>
                <Text style={s.themeIcon}>{option.icon}</Text>
                <View>
                  <Text style={[s.themeLabel, { color: theme.textPrimary }]}>{option.label}</Text>
                  <Text style={[s.themeDesc, { color: theme.textMuted }]}>{option.description}</Text>
                </View>
              </View>
              {themeMode === option.mode && (
                <Text style={[s.checkmark, { color: theme.brandPrimary }]}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={s.section}>
        <Text style={[s.sectionLabel, { color: theme.textMuted }]}>ACCOUNT</Text>
        <View style={[s.card, { backgroundColor: theme.bgSecondary }]}>
          <TouchableOpacity
            style={s.actionButton}
            onPress={() =>
              Alert.alert("Sign out", "Are you sure you want to sign out?", [
                { text: "Cancel", style: "cancel" },
                { text: "Sign out", style: "destructive", onPress: logout },
              ])
            }
            activeOpacity={0.7}
          >
            <Text style={[s.actionButtonText, { color: theme.danger }]}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={s.footer}>
        <Text style={[s.footerText, { color: theme.textMuted }]}>TaskBoard v1.0.0</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },
  headerTitle: { fontSize: 28, fontWeight: "800" },
  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 10, paddingHorizontal: 4 },
  card: { borderRadius: 12, overflow: "hidden" },
  themeOption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 },
  themeOptionLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  themeIcon: { fontSize: 24 },
  themeLabel: { fontSize: 16, fontWeight: "600", marginBottom: 2 },
  themeDesc: { fontSize: 13 },
  checkmark: { fontSize: 20, fontWeight: "700" },
  actionButton: { padding: 16, alignItems: "center" },
  actionButtonText: { fontSize: 16, fontWeight: "600" },
  footer: { flex: 1, justifyContent: "flex-end", alignItems: "center", paddingBottom: 32 },
  footerText: { fontSize: 12 },
});
