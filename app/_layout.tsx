import FontAwesome from "@expo/vector-icons/FontAwesome";
import { colors, navigationTheme, paperTheme } from "@/src/theme";
import { ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, Suspense } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SQLiteProvider } from "expo-sqlite";
import "react-native-reanimated";
import { PaperProvider } from "react-native-paper";
import { StatusBar } from "expo-status-bar";

import { migrateDbIfNeeded } from "../src/database/schema";

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

// Impede que o splash screen suma antes do carregamento das fontes
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

// Botão "Cancelar" do cabeçalho das telas abertas como folha (iOS não mostra botão de voltar nelas).
function CancelButton() {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.back()} hitSlop={10}>
      <Text style={{ color: colors.primary, fontSize: 17 }}>Cancelar</Text>
    </Pressable>
  );
}

function RootLayoutNav() {
  return (
    <ThemeProvider value={navigationTheme}>
      <PaperProvider theme={paperTheme}>
        {/* Tema único claro: barra de status escura para não sumir no fundo rosado */}
        <StatusBar style="dark" />
        <Suspense
          fallback={
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          }
        >
          <SQLiteProvider
            databaseName="doces_app.db"
            onInit={migrateDbIfNeeded}
            useSuspense
          >
            <Stack
              screenOptions={{
                headerTintColor: colors.primary,
                headerTitleStyle: { color: colors.text },
                contentStyle: { backgroundColor: colors.background },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

              {/* Cadastros abrem como folha deslizando de baixo (a tela anterior fica visível atrás) */}
              <Stack.Screen
                name="products/new"
                options={{
                  title: "Novo Doce",
                  presentation: "modal",
                  headerLeft: () => <CancelButton />,
                }}
              />
              <Stack.Screen
                name="orders/new"
                options={{
                  title: "Novo Pedido",
                  presentation: "modal",
                  headerLeft: () => <CancelButton />,
                }}
              />

              <Stack.Screen
                name="backup"
                options={{
                  title: "Backup e Relatórios",
                  headerBackTitle: "Voltar",
                }}
              />

              {/* Tela empilhada normal, só com título e botão de voltar em português */}
              <Stack.Screen
                name="orders/history"
                options={{ title: "Calendário", headerBackTitle: "Voltar" }}
              />
            </Stack>
          </SQLiteProvider>
        </Suspense>
      </PaperProvider>
    </ThemeProvider>
  );
}
