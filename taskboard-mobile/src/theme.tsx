import { useColorScheme } from "react-native";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemeMode = "light" | "dark" | "system";

export interface Theme {
  // Background colors
  bgPrimary: string;
  bgSecondary: string;
  bgElevated: string;
  bgOverlay: string;
  
  // Text colors
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  
  // Border colors
  borderDefault: string;
  borderSubtle: string;
  
  // Brand colors
  brandPrimary: string;
  brandPrimaryHover: string;
  
  // Status colors
  statusTodo: { bg: string; text: string };
  statusInProgress: { bg: string; text: string };
  statusCompleted: { bg: string; text: string };
  
  // Priority colors
  priorityHigh: string;
  priorityMedium: string;
  priorityLow: string;
  
  // Semantic colors
  danger: string;
  dangerBg: string;
  warning: string;
  success: string;
  
  // Shadow
  shadowColor: string;
}

const lightTheme: Theme = {
  bgPrimary: "#f0f2f5",
  bgSecondary: "#ffffff",
  bgElevated: "#ffffff",
  bgOverlay: "rgba(0, 0, 0, 0.5)",
  
  textPrimary: "#0f1c2e",
  textSecondary: "#4a5568",
  textMuted: "#9aa5b4",
  textInverse: "#ffffff",
  
  borderDefault: "#e2e6ed",
  borderSubtle: "#f0f2f5",
  
  brandPrimary: "#1a56db",
  brandPrimaryHover: "#1e40af",
  
  statusTodo: { bg: "#eff4ff", text: "#1a56db" },
  statusInProgress: { bg: "#fffbeb", text: "#d97706" },
  statusCompleted: { bg: "#ecfdf5", text: "#059669" },
  
  priorityHigh: "#dc2626",
  priorityMedium: "#ca8a04",
  priorityLow: "#16a34a",
  
  danger: "#dc2626",
  dangerBg: "#fef2f2",
  warning: "#d97706",
  success: "#059669",
  
  shadowColor: "#0f1c2e",
};

const darkTheme: Theme = {
  bgPrimary: "#0f1419",
  bgSecondary: "#1a1f26",
  bgElevated: "#242a33",
  bgOverlay: "rgba(0, 0, 0, 0.7)",
  
  textPrimary: "#e8eaed",
  textSecondary: "#b8bcc2",
  textMuted: "#6b7280",
  textInverse: "#0f1c2e",
  
  borderDefault: "#2d3440",
  borderSubtle: "#1f2530",
  
  brandPrimary: "#3b82f6",
  brandPrimaryHover: "#2563eb",
  
  statusTodo: { bg: "#1e3a5f", text: "#60a5fa" },
  statusInProgress: { bg: "#3d2e1f", text: "#fbbf24" },
  statusCompleted: { bg: "#1f3d33", text: "#34d399" },
  
  priorityHigh: "#ef4444",
  priorityMedium: "#eab308",
  priorityLow: "#22c55e",
  
  danger: "#ef4444",
  dangerBg: "#3d1f1f",
  warning: "#f59e0b",
  success: "#10b981",
  
  shadowColor: "#000000",
};

interface ThemeContextValue {
  theme: Theme;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_STORAGE_KEY = "@taskboard_theme_mode";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");
  const [isLoading, setIsLoading] = useState(true);

  // Load saved theme preference on mount
  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((saved) => {
        if (saved && (saved === "light" || saved === "dark" || saved === "system")) {
          setThemeModeState(saved as ThemeMode);
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
  };

  // Determine actual theme based on mode and system preference
  const isDark = themeMode === "dark" || (themeMode === "system" && systemColorScheme === "dark");
  const theme = isDark ? darkTheme : lightTheme;

  if (isLoading) {
    return null; // Or a loading screen
  }

  return (
    <ThemeContext.Provider value={{ theme, themeMode, setThemeMode, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
