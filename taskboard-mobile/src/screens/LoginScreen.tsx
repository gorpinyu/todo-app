import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from "react-native";
import { useAuth } from "../AuthContext";

export default function LoginScreen({ onRegister, onForgot }: { onRegister: () => void; onForgot: () => void }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) { Alert.alert("Error", "Please enter email and password"); return; }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err: any) {
      const msg = err.message ?? "Login failed";
      Alert.alert("Sign in failed", msg, [
        { text: "Reset password", onPress: onForgot },
        { text: "OK" },
      ]);
    } finally { setLoading(false); }
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={s.card}>
        <View style={s.logoRow}>
          <View style={s.logoIcon}><Text style={s.logoEmoji}>⊞</Text></View>
          <Text style={s.logoText}>Task<Text style={s.logoAccent}>Board</Text></Text>
        </View>
        <Text style={s.title}>Welcome back</Text>
        <Text style={s.subtitle}>Sign in to your account</Text>
        <Text style={s.label}>EMAIL</Text>
        <TextInput style={s.input} placeholder="you@company.com" placeholderTextColor="#9aa5b4"
          value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <Text style={s.label}>PASSWORD</Text>
        <TextInput style={s.input} placeholder="••••••••" placeholderTextColor="#9aa5b4"
          value={password} onChangeText={setPassword} secureTextEntry />
        <TouchableOpacity onPress={onForgot} style={s.forgotRow}>
          <Text style={s.forgotText}>Forgot password?</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Sign in</Text>}
        </TouchableOpacity>
        <View style={s.switchRow}>
          <Text style={s.switchText}>Don't have an account? </Text>
          <TouchableOpacity onPress={onRegister}><Text style={s.link}>Create one</Text></TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f2f5", justifyContent: "center", padding: 20 },
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
  forgotRow: { alignItems: "flex-end", marginBottom: 20, marginTop: -8 },
  forgotText: { color: "#1a56db", fontSize: 13, fontWeight: "600" },
  btn: { backgroundColor: "#1a56db", borderRadius: 10, padding: 16, alignItems: "center", marginBottom: 20 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  switchRow: { flexDirection: "row", justifyContent: "center" },
  switchText: { color: "#4a5568", fontSize: 14 },
  link: { color: "#1a56db", fontSize: 14, fontWeight: "600" },
});
