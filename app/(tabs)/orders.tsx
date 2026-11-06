import React, { useCallback, useState } from "react";
import { colors } from "@/src/theme";
import { formatBRL } from "@/src/utils/currency";
import {
  StyleSheet,
  View,
  FlatList,
  Alert,
  View as RNView,
} from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Card,
  Text,
  FAB,
  Chip,
  Button,
  Divider,
  Portal,
  Dialog,
  IconButton,
} from "react-native-paper";
import { OrderRepository } from "@/src/database/repositories/orderRepo";
import { OrderWithItems } from "@/src/types";

export default function OrdersScreen() {
  const db = useSQLiteContext();
  const repo = new OrderRepository(db);
  const router = useRouter();

  const [orders, setOrders] = useState<OrderWithItems[]>([]);

  // Modal de Cancelamento
  const [cancelDialogVisible, setCancelDialogVisible] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const loadOrders = async () => {
    try {
      const data = await repo.findCurrentMonthOrders();
      setOrders(data);
    } catch (error) {
      console.error("Erro ao carregar pedidos:", error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, []),
  );

  const handleComplete = async (orderId: string) => {
    try {
      await repo.completeOrder(orderId);
      await loadOrders();
    } catch (error) {
      Alert.alert("Erro", "Não foi possível concluir o pedido.");
    }
  };

  const handleOpenCancelDialog = (orderId: string) => {
    setSelectedOrderId(orderId);
    setCancelDialogVisible(true);
  };

  const handleConfirmCancel = async (returnToStock: boolean) => {
    if (!selectedOrderId) return;
    try {
      await repo.cancelOrder(selectedOrderId, returnToStock);
      setCancelDialogVisible(false);
      setSelectedOrderId(null);
      await loadOrders();
    } catch (error) {
      Alert.alert("Erro", "Falha ao cancelar o pedido.");
    }
  };

  return (
    <View style={styles.container}>
      <RNView style={styles.topBar}>
        <Text style={styles.screenHeaderTitle} variant="titleMedium">
          Pedidos do Mês
        </Text>
        <IconButton
          icon="calendar-month-outline"
          iconColor={colors.primary}
          size={24}
          onPress={() => router.push("/orders/history")}
        />
      </RNView>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              Nenhum pedido registrado neste mês.
            </Text>
            <Text style={styles.emptySubtext}>
              Toque no botão "+" para lançar uma venda.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isPending = item.status === "pending";
          const isCompleted = item.status === "completed";
          const isCanceled = item.status === "canceled";

          return (
            <Card style={styles.card} mode="outlined">
              <Card.Content>
                <RNView style={styles.cardHeader}>
                  <RNView style={{ flex: 1 }}>
                    <Text variant="titleMedium" style={styles.customerName}>
                      {item.customer_name}
                    </Text>
                    {item.customer_phone ? (
                      <Text variant="bodySmall" style={styles.phoneText}>
                        {item.customer_phone}
                      </Text>
                    ) : null}
                  </RNView>

                  <Chip
                    compact
                    style={[
                      styles.statusChip,
                      isPending
                        ? styles.chipPending
                        : isCompleted
                          ? styles.chipCompleted
                          : styles.chipCanceled,
                    ]}
                    textStyle={[
                      styles.statusChipText,
                      isPending
                        ? styles.chipTextPending
                        : isCompleted
                          ? styles.chipTextCompleted
                          : styles.chipTextCanceled,
                    ]}
                  >
                    {isPending
                      ? "Pagamento Pendente"
                      : isCompleted
                        ? "Concluído"
                        : "Cancelado"}
                  </Chip>
                </RNView>

                <RNView style={styles.itemsBox}>
                  <Text variant="bodySmall" style={styles.itemsSummary}>
                    {item.items_summary || "Nenhum item listado"}
                  </Text>
                </RNView>

                <Divider style={styles.divider} />

                <RNView style={styles.cardFooter}>
                  <RNView>
                    <Text variant="labelSmall" style={styles.metaLabel}>
                      Entrega: {item.delivery_date}
                    </Text>
                    <Text variant="labelSmall" style={styles.metaLabel}>
                      Pagamento: {item.payment_method.toUpperCase()}
                    </Text>
                    <Text variant="titleMedium" style={styles.totalText}>
                      {formatBRL(item.total_amount)}
                    </Text>
                  </RNView>

                  {/* Ações contextuais de acordo com o status */}
                  {isPending && (
                    <RNView style={styles.actionsRow}>
                      <Button
                        mode="outlined"
                        compact
                        textColor={colors.danger}
                        onPress={() => handleOpenCancelDialog(item.id)}
                        style={styles.cancelBtn}
                      >
                        Cancelar
                      </Button>
                      <Button
                        mode="contained"
                        compact
                        onPress={() => handleComplete(item.id)}
                        style={styles.completeBtn}
                      >
                        Concluir
                      </Button>
                    </RNView>
                  )}

                  {isCompleted && (
                    <Button
                      mode="text"
                      compact
                      textColor={colors.danger}
                      onPress={() => handleOpenCancelDialog(item.id)}
                    >
                      Cancelar Pedido
                    </Button>
                  )}
                </RNView>
              </Card.Content>
            </Card>
          );
        }}
      />

      {/* FAB para lançar nova encomenda */}
      <FAB
        color={colors.onPrimary}
        icon="plus"
        label="Novo Pedido"
        style={styles.fab}
        onPress={() => router.push("/orders/new")}
      />

      {/* Modal de Cancelamento com Retorno Opcional ao Estoque */}
      <Portal>
        <Dialog
          visible={cancelDialogVisible}
          onDismiss={() => setCancelDialogVisible(false)}
        >
          <Dialog.Title>Cancelar Pedido</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Deseja retornar os itens desse pedido ao Estoque?
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: colors.textMuted, marginTop: 8 }}
            >
              Escolha "Não" caso os doces tenham sido consumidos, descartados ou
              calote.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => setCancelDialogVisible(false)}
              textColor={colors.textMuted}
            >
              Voltar
            </Button>
            <Button
              onPress={() => handleConfirmCancel(false)}
              textColor={colors.danger}
            >
              Não Devolver
            </Button>
            <Button
              onPress={() => handleConfirmCancel(true)}
              textColor={colors.success}
            >
              Sim, Devolver
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 80 },
  emptyContainer: {
    alignItems: "center",
    marginTop: 40,
    backgroundColor: "transparent",
  },
  emptyText: { color: colors.textMuted, fontSize: 16, fontWeight: "500" },
  emptySubtext: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  card: { marginBottom: 12, borderRadius: 10 },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  customerName: { fontWeight: "bold", color: colors.text },
  phoneText: { color: colors.textMuted },
  statusChip: { borderRadius: 16, height: 28 },
  chipPending: { backgroundColor: colors.warningSoft },
  chipCompleted: { backgroundColor: colors.successSoft },
  chipCanceled: { backgroundColor: colors.dangerSoft },
  statusChipText: { fontWeight: "bold", fontSize: 11 },
  chipTextPending: { color: colors.warning },
  chipTextCompleted: { color: colors.success },
  chipTextCanceled: { color: colors.danger },
  itemsBox: {
    marginTop: 8,
    padding: 8,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 6,
  },
  itemsSummary: { color: colors.text },
  divider: { marginVertical: 10 },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  metaLabel: { color: colors.textMuted },
  totalText: { fontWeight: "bold", color: colors.success, marginTop: 2 },
  actionsRow: { flexDirection: "row", gap: 6 },
  cancelBtn: { borderColor: colors.dangerBorder },
  completeBtn: { backgroundColor: colors.success },
  fab: {
    position: "absolute",
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: colors.primary,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: "transparent",
  },
  screenHeaderTitle: {
    fontWeight: "bold",
    color: colors.text,
  },
});
