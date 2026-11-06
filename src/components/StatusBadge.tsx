import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import { colors } from "@/src/theme";
import { OrderStatus } from "@/src/types";

const CONFIG: Record<
  OrderStatus,
  { label: string; background: string; color: string }
> = {
  pending: {
    label: "Pendente",
    background: colors.warningSoft,
    color: colors.warning,
  },
  completed: {
    label: "Concluído",
    background: colors.successSoft,
    color: colors.success,
  },
  canceled: {
    label: "Cancelado",
    background: colors.dangerSoft,
    color: colors.danger,
  },
};

/**
 * Selo de status do pedido. Não tem altura fixa (o <Chip> do Paper tinha e cortava o texto):
 * a altura vem do próprio texto + padding.
 */
export function StatusBadge({ status }: { status: OrderStatus }) {
  const { label, background, color } = CONFIG[status];

  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Text variant="labelMedium" style={[styles.text, { color }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
  },
  text: { fontWeight: "700" },
});
