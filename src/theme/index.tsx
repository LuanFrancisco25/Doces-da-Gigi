import { MD3LightTheme } from "react-native-paper";
import { DefaultTheme as NavigationLightTheme } from "@react-navigation/native";
import { colors } from "./colors";

/**
 * Identidade visual "Rosa Doce": rosa framboesa + creme rosado + marrom-chocolate.
 * Toda cor do app deve vir daqui, nunca escrita direto nas telas.
 */
export { colors };

export const paperTheme = {
  ...MD3LightTheme,
  roundness: 4,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    onPrimary: colors.onPrimary,
    primaryContainer: colors.primarySoft,
    onPrimaryContainer: colors.primary,
    secondary: colors.primary,
    onSecondary: colors.onPrimary,
    secondaryContainer: colors.primarySoft,
    onSecondaryContainer: colors.primary,
    background: colors.background,
    onBackground: colors.text,
    surface: colors.surface,
    onSurface: colors.text,
    surfaceVariant: colors.surfaceAlt,
    onSurfaceVariant: colors.textMuted,
    outline: colors.primaryBorder,
    outlineVariant: colors.border,
    elevation: {
      level0: "transparent",
      level1: colors.surface,
      level2: colors.surface,
      level3: colors.surface,
      level4: colors.surface,
      level5: colors.surface,
    },
  },
};

export const navigationTheme = {
  ...NavigationLightTheme,
  colors: {
    ...NavigationLightTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    border: colors.border,
    notification: colors.primary,
  },
};
