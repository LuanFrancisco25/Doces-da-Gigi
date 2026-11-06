import React, { useCallback, useState } from "react";
import { colors } from "@/src/theme";
import { formatBRL } from "@/src/utils/currency";
import { formatDateTimeBR } from "@/src/utils/date";
import {
  StyleSheet,
  View,
  ScrollView,
  RefreshControl,
  Alert,
  View as RNView,
} from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { useFocusEffect } from "expo-router";
import {
  Card,
  Text,
  Button,
  SegmentedButtons,
  List,
  Divider,
} from "react-native-paper";
import { AppModal } from "@/src/components/AppModal";
import { AppTextInput } from "@/src/components/AppTextInput";
import {
  TransactionRepository,
  FinancialTransaction,
} from "@/src/database/repositories/transactionRepo";
import { TransactionType } from "@/src/types";

export default function DashboardScreen() {
  const db = useSQLiteContext();
  const repo = new TransactionRepository(db);

  const [balance, setBalance] = useState<number>(0);
  const [dailySummary, setDailySummary] = useState<{
    income: number;
    expense: number;
  }>({ income: 0, expense: 0 });
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Estados do Modal de Ajuste Manual
  const [modalVisible, setModalVisible] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<TransactionType>("IN");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadFinancialData = async () => {
    try {
      const [currentBalance, summary, recents] = await Promise.all([
        repo.getCurrentBalance(),
        repo.getDailySummary(),
        repo.getRecentTransactions(8),
      ]);
      setBalance(currentBalance);
      setDailySummary(summary);
      setTransactions(recents);
    } catch (error) {
      console.error("Erro ao carregar dados financeiros:", error);
    }
  };

  // Recarrega sempre que o usuário entra na aba
  useFocusEffect(
    useCallback(() => {
      loadFinancialData();
    }, []),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFinancialData();
    setRefreshing(false);
  };

  const handleSaveAdjustment = async () => {
    const parsedAmount = parseFloat(amount.replace(",", "."));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert("Valor inválido", "Insira um valor numérico maior que zero.");
      return;
    }

    if (!description.trim()) {
      Alert.alert(
        "Descrição obrigatória",
        "Informe o motivo do ajuste (ex: Troco inicial, Sangria).",
      );
      return;
    }

    try {
      setSubmitting(true);
      await repo.addManualAdjustment(
        adjustmentType,
        parsedAmount,
        description.trim(),
      );
      setAmount("");
      setDescription("");
      setModalVisible(false);
      await loadFinancialData();
    } catch (error) {
      Alert.alert("Erro", "Não foi possível salvar o ajuste manual.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
    >
      {/* Card Principal de Saldo */}
      <Card style={styles.balanceCard} mode="elevated">
        <Card.Content>
          <Text variant="titleMedium" style={styles.cardLabel}>
            Saldo em Caixa
          </Text>
          <Text
            variant="headlineLarge"
            style={[
              styles.balanceValue,
              { color: balance >= 0 ? colors.success : colors.danger },
            ]}
          >
            {formatBRL(balance)}
          </Text>

          <View style={styles.actionButtonsRow}>
            <Button
              mode="contained-tonal"
              icon="plus-circle"
              onPress={() => {
                setAdjustmentType("IN");
                setModalVisible(true);
              }}
              style={styles.actionBtn}
            >
              Adicionar
            </Button>
            <Button
              mode="contained-tonal"
              icon="minus-circle"
              onPress={() => {
                setAdjustmentType("OUT");
                setModalVisible(true);
              }}
              style={styles.actionBtn}
            >
              Remover
            </Button>
          </View>
        </Card.Content>
      </Card>

      {/* Resumo do Dia */}
      <View style={styles.summaryRow}>
        <Card style={[styles.summaryCard, { marginRight: 8 }]} mode="outlined">
          <Card.Content>
            <Text variant="bodySmall" style={styles.cardLabel}>
              Entradas Hoje
            </Text>
            <Text variant="titleMedium" style={styles.incomeText}>
              + {formatBRL(dailySummary.income)}
            </Text>
          </Card.Content>
        </Card>

        <Card style={[styles.summaryCard, { marginLeft: 8 }]} mode="outlined">
          <Card.Content>
            <Text variant="bodySmall" style={styles.cardLabel}>
              Saídas Hoje
            </Text>
            <Text variant="titleMedium" style={styles.expenseText}>
              - {formatBRL(dailySummary.expense)}
            </Text>
          </Card.Content>
        </Card>
      </View>

      {/* Extrato Recente */}
      <Text variant="titleMedium" style={styles.sectionTitle}>
        Últimas Movimentações
      </Text>

      <Card style={styles.historyCard} mode="outlined">
        {transactions.length === 0 ? (
          <Text style={styles.emptyText}>Nenhuma movimentação registrada.</Text>
        ) : (
          <RNView>
            {transactions.map((tx, index) => (
              <React.Fragment key={tx.id}>
                <List.Item
                  title={tx.description}
                  description={formatDateTimeBR(tx.created_at)}
                  left={(props) => (
                    <List.Icon
                      {...props}
                      icon={
                        tx.type === "IN"
                          ? "arrow-bottom-left"
                          : "arrow-top-right"
                      }
                      color={tx.type === "IN" ? colors.success : colors.danger}
                    />
                  )}
                  right={() => (
                    <Text
                      style={[
                        styles.txAmount,
                        {
                          color:
                            tx.type === "IN" ? colors.success : colors.danger,
                        },
                      ]}
                    >
                      {tx.type === "IN" ? "+" : "-"} {formatBRL(tx.amount)}
                    </Text>
                  )}
                />
                {index < transactions.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </RNView>
        )}
      </Card>

      {/* Modal para Ajuste Manual de Caixa */}
      <AppModal visible={modalVisible} onDismiss={() => setModalVisible(false)}>
        <Text variant="titleLarge" style={styles.modalTitle}>
          Ajuste Manual de Saldo
        </Text>

        <SegmentedButtons
          value={adjustmentType}
          onValueChange={(val) => setAdjustmentType(val as TransactionType)}
          buttons={[
            { value: "IN", label: "Adicionar (Aporte)" },
            { value: "OUT", label: "Remover (Sangria)" },
          ]}
          style={styles.segmented}
        />

        <AppTextInput
          label="Valor (R$)"
          value={amount}
          onChangeText={setAmount}
          mode="outlined"
          keyboardType="decimal-pad"
          style={styles.input}
        />

        <AppTextInput
          label="Descrição / Motivo"
          placeholder="Ex: Troco de início do dia, retirada pessoal"
          value={description}
          onChangeText={setDescription}
          mode="outlined"
          style={styles.input}
        />

        <Button
          mode="contained"
          onPress={handleSaveAdjustment}
          loading={submitting}
          style={styles.modalBtn}
        >
          Confirmar Ajuste
        </Button>
      </AppModal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  balanceCard: {
    backgroundColor: colors.primarySoft,
    marginBottom: 16,
    borderRadius: 12,
  },
  cardLabel: {
    color: colors.textMuted,
    fontWeight: "500",
  },
  balanceValue: {
    fontWeight: "bold",
    marginVertical: 8,
  },
  actionButtonsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
    backgroundColor: "transparent",
  },
  actionBtn: {
    flex: 1,
  },
  summaryRow: {
    flexDirection: "row",
    marginBottom: 20,
    backgroundColor: "transparent",
  },
  summaryCard: {
    flex: 1,
    borderRadius: 8,
  },
  incomeText: {
    fontWeight: "bold",
    color: colors.success,
    marginTop: 4,
  },
  expenseText: {
    fontWeight: "bold",
    color: colors.danger,
    marginTop: 4,
  },
  sectionTitle: {
    fontWeight: "bold",
    marginBottom: 10,
    color: colors.text,
  },
  historyCard: {
    borderRadius: 8,
  },
  emptyText: {
    padding: 16,
    textAlign: "center",
    color: colors.textMuted,
  },
  txAmount: {
    alignSelf: "center",
    fontWeight: "600",
    marginRight: 8,
  },
  modal: {
    backgroundColor: "white",
    padding: 20,
    margin: 20,
    borderRadius: 12,
  },
  modalTitle: {
    fontWeight: "bold",
    marginBottom: 16,
    color: colors.text,
  },
  segmented: {
    marginBottom: 16,
  },
  input: {
    marginBottom: 12,
  },
  modalBtn: {
    marginTop: 8,
    backgroundColor: colors.primary,
  },
});
