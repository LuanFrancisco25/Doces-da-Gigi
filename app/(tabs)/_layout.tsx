import React from "react";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Tabs, useRouter } from "expo-router";
import { ColorValue, Pressable } from "react-native";

import { colors } from "@/src/theme";

// Ícones disponíveis em https://icons.expo.fyi/ (família FontAwesome)
function TabBarIcon({
  name,
  color,
}: {
  name: React.ComponentProps<typeof FontAwesome>["name"];
  color: ColorValue;
}) {
  return (
    <FontAwesome
      name={name}
      size={24}
      style={{ marginBottom: -3 }}
      color={color as string}
    />
  );
}

// Atalho para a tela de backup e relatórios, no cabeçalho da aba Caixa
function BackupButton() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push("/backup")}
      hitSlop={10}
      accessibilityLabel="Backup e relatórios"
      style={{ marginRight: 16 }}
    >
      <FontAwesome name="cloud-upload" size={22} color={colors.primary} />
    </Pressable>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontWeight: "600" },
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.text, fontWeight: "700" },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Caixa",
          headerRight: () => <BackupButton />,
          tabBarIcon: ({ color }) => <TabBarIcon name="money" color={color} />,
        }}
      />
      <Tabs.Screen
        name="ingredients"
        options={{
          title: "Insumos",
          tabBarIcon: ({ color }) => (
            <TabBarIcon name="shopping-basket" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="stock"
        options={{
          title: "Estoque",
          tabBarIcon: ({ color }) => <TabBarIcon name="cubes" color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Pedidos",
          tabBarIcon: ({ color }) => (
            <TabBarIcon name="shopping-cart" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
