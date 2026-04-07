import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView } from "react-native";
import { useAuth } from "../AuthContext";

export default function RegisterScreen({ onLogin }: { onLogin: () => void }) {
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!email || !password) { Alert.alert("Error", "Please fill in all fields"); return; }
    if (password.length < 8) { Alert.alert("Error", "Password must be at least 8 characters"); return; }
    if (password !== confirm) { Alert.alert("Error", "Passwords do not match"); return; }
    setLoading(true);
    try { await register(email.trim().toLowerCase(), password); }
    catch (err: any) { Alert.alert("Registration failed", err.message ?? "Please try again"); }
    finally { setLoading(false); }
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.card}>
          <View style={s.logoRow}>
            <View style={s.logoIcon}><Text style={s.logoEmoji}>⊞</Text></View>
            <Text style={s.logoText}>Task<Text style={s.logoAccent}>Board</Text></Text>
          </View>
          <Text style={s.title}>Create account</Text>
          <Text style={s.subtitle}>Start managing your tasks today</Text>
          <Text style={s.label}>EMAIL</Text>
          <TextInput style={s.input} placeholder="you@company.com" placeholderTextColor="#9aa5b4"
            value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <Text style={s.label}>PASSWORD</Text>
          <TextInput style={s.input} placeholder="Min. 8 characters" placeholderTextColor="#9aa5b4"
            value={password} onChangeText={setPassword} secureTextEntry />
          <Text style={s.label}>CONFIRM PASSWORD</Text>
          <TextInput style={s.input} placeholder="••••••••" placeholderTextColor="#9aa5b4"
            value={confirm} onChangeText={setConfirm} secureTextEntry />
          <TouchableOpacity style={s.btn} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Create account</Text>}
          </TouchableOpacity>
          <View style={s.switchRow}>
            <Text style={s.switchText}>Already have an account? </Text>
            <TouchableOpacity onPress={onLogin}><Text style={s.link}>Sign in</Text></TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f2f5" },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 20 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 28, shadowColor: "#0f1c2e", shadowOpacity: 0.1, shadowRadius: 20, elevation: 4 },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 28 },
  logoIcon: { width: 38, height: 38, backgroundColor: "#0f1c2e", borderRadius: 10, alignItems: "center", justifyContent: "center" },
  logoEmoji: { color: "#fff", fontSize: 18 },
  logoText: { fontSize: 20, fontWeight: "700", color: "#0f1c2e" },
  logoAccent: { color: "#1a56db" },
  title: { fontSize: 24, fontWeight: "700", color: "#0f1c2e", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#4a5568", marginBottom: 24 },
  label: { fontSize: 11, fontWeight: "600", color: "#9aa5b4", letterSpacing: 1, marginBottom: 6 },
  input: { backgroundColor: "#f8f9fb", borderWidth: 1, borderColor: "#e2e6ed", borderRadius: 10, padding: 14, fontSize: 15, color: "#0f1c2e", marginBottom: 16 },
  btn: { backgroundColor: "#1a56db", borderRadius: 10, padding: 16, alignItems: "center", marginBottom: 20, marginTop: 4 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  switchRow: { flexDirection: "row", justifyContent: "center" },
  switchText: { color: "#4a5568", fontSize: 14 },
  link: { color: "#1a56db", fontSize: 14, fontWeight: "600" },
});
