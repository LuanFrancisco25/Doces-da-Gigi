import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, View, ScrollView } from "react-native";
import { Stack } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { Calendar, DateData, LocaleConfig } from "react-native-calendars";
import {
  Card,
  Text,
  Divider,
  List,
  SegmentedButtons,
} from "react-native-paper";

import { colors } from "@/src/theme";
import { OrderRepository } from "@/src/database/repositories/orderRepo";
import {
  TransactionRepository,
  FinancialTransaction,
} from "@/src/database/repositories/transactionRepo";
import { OrderWithItems, TransactionOrigin } from "@/src/types";
import { StatusBadge } from "@/src/components/StatusBadge";
import "@/src/utils/calendarLocale";
import {
  eachDay,
  formatDateBR,
  getLocalDateString,
  getMonthRange,
  getWeekRange,
} from "@/src/utils/date";
import { formatBRL } from "@/src/utils/currency";

type Mode = "day" | "week" | "month" | "range";
type MonthSummary = Record<string, { orders: number; revenue: number }>;
interface Marking {
  marked?: boolean;
  dotColor?: string;
  selected?: boolean;
  selectedColor?: string;
  selectedTextColor?: string;
}

const HINTS: Record<Mode, string> = {
  day: "Toque em um dia para ver os detalhes dele.",
  week: "Toque em qualquer dia para ver a semana inteira (domingo a sábado).",
  month: "Use as setas do calendário para trocar de mês.",
  range: "Toque na data inicial e depois na data final.",
};

const ORIGIN_LABEL: Record<TransactionOrigin, string> = {
  order: "Venda",
  production: "Produção",
  ingredient_purchase: "Compra de insumo",
  manual_adjustment: "Ajuste manual",
};

export default function OrderHistoryScreen() {
  const db = useSQLiteContext();
  const orderRepo = new OrderRepository(db);
  const txRepo = new TransactionRepository(db);

  const todayStr = getLocalDateString();

  const [mode, setMode] = useState<Mode>("day");
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [currentYearMonth, setCurrentYearMonth] = useState<string>(
    todayStr.slice(0, 7),
  );
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);

  const [monthSummary, setMonthSummary] = useState<MonthSummary>({});
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);

  // Intervalo [start, end] que está sendo consultado, conforme o modo escolhido
  const range = useMemo(() => {
    switch (mode) {
      case "week":
        return getWeekRange(selectedDate);
      case "month":
        return getMonthRange(currentYearMonth);
      case "range": {
        const start = rangeStart ?? selectedDate;
        return { start, end: rangeEnd ?? start };
      }
      default:
        return { start: selectedDate, end: selectedDate };
    }
  }, [mode, selectedDate, currentYearMonth, rangeStart, rangeEnd]);

  const isSingleDay = range.start === range.end;

  // Pontinhos do calendário: indicadores do mês visível
  const loadMonthIndicators = async (yearMonth: string) => {
    try {
      const rows = await orderRepo.getMonthlyOrderSummary(yearMonth);
      const map: MonthSummary = {};
      for (const r of rows) {
        map[r.delivery_date] = {
          orders: r.total_orders,
          revenue: r.completed_revenue,
        };
      }
      setMonthSummary(map);
    } catch (error) {
      console.error("Erro ao carregar resumo mensal:", error);
    }
  };

  // Detalhes (pedidos + caixa) do intervalo selecionado
  const loadRangeDetails = async (start: string, end: string) => {
    try {
      const [ordersData, txData] = await Promise.all([
        orderRepo.getOrdersByDeliveryRange(start, end),
        txRepo.getTransactionsByRange(start, end),
      ]);
      setOrders(ordersData);
      setTransactions(txData);
    } catch (error) {
      console.error("Erro ao carregar detalhes do período:", error);
    }
  };

  useEffect(() => {
    loadMonthIndicators(currentYearMonth);
  }, [currentYearMonth]);

  useEffect(() => {
    loadRangeDetails(range.start, range.end);
  }, [range.start, range.end]);

  const handleModeChange = (value: string) => {
    const next = value as Mode;
    setMode(next);
    if (next === "range") {
      // começa a partir do dia que já estava selecionado; falta só tocar na data final
      setRangeStart(selectedDate);
      setRangeEnd(null);
    }
  };

  const handleDayPress = (dateStr: string) => {
    setSelectedDate(dateStr);
    if (mode !== "range") return;

    if (!rangeStart || rangeEnd) {
      setRangeStart(dateStr); // novo intervalo
      setRangeEnd(null);
    } else if (dateStr < rangeStart) {
      setRangeEnd(rangeStart); // tocou numa data anterior: inverte
      setRangeStart(dateStr);
    } else {
      setRangeEnd(dateStr);
    }
  };

  // Marcações do calendário
  const markedDates: Record<string, Marking> = {};
  Object.keys(monthSummary).forEach((dateKey) => {
    const info = monthSummary[dateKey];
    markedDates[dateKey] = {
      marked: info.orders > 0,
      dotColor: info.revenue > 0 ? colors.success : colors.primary,
    };
  });

  if (mode === "day") {
    markedDates[selectedDate] = {
      ...(markedDates[selectedDate] || {}),
      selected: true,
      selectedColor: colors.primary,
    };
  } else if (mode === "week" || mode === "range") {
    for (const day of eachDay(range.start, range.end)) {
      const isEdge = day === range.start || day === range.end;
      markedDates[day] = {
        ...(markedDates[day] || {}),
        selected: true,
        selectedColor: isEdge ? colors.primary : colors.primarySoft,
        selectedTextColor: isEdge ? colors.onPrimary : colors.primary,
      };
    }
  }

  // Totais do intervalo
  const income = transactions
    .filter((t) => t.type === "IN")
    .reduce((acc, t) => acc + t.amount, 0);
  const expense = transactions
    .filter((t) => t.type === "OUT")
    .reduce((acc, t) => acc + t.amount, 0);
  const net = income - expense;

  // Título do detalhamento
  const monthNames = LocaleConfig.locales["pt"].monthNames;
  const [ymYear, ymMonth] = currentYearMonth.split("-");
  const periodLabel =
    mode === "month"
      ? `${monthNames[Number(ymMonth) - 1]} de ${ymYear}`
      : isSingleDay
        ? formatDateBR(range.start)
        : `${formatDateBR(range.start)} a ${formatDateBR(range.end)}`;
  const sectionTitle = {
    day: "Detalhamento",
    week: "Semana",
    month: "Mês",
    range: "Período",
  }[mode];

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Calendário Histórico" }} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
      >
        <SegmentedButtons
          value={mode}
          onValueChange={handleModeChange}
          buttons={[
            { value: "day", label: "Dia" },
            { value: "week", label: "Semana" },
            { value: "month", label: "Mês" },
            { value: "range", label: "Período" },
          ]}
          style={styles.modeButtons}
        />
        <Text variant="bodySmall" style={styles.hint}>
          {HINTS[mode]}
        </Text>

        <Card mode="outlined" style={styles.calendarCard}>
          <Calendar
            current={todayStr}
            onDayPress={(day: DateData) => handleDayPress(day.dateString)}
            onMonthChange={(month: DateData) => {
              const ym = `${month.year}-${String(month.month).padStart(2, "0")}`;
              setCurrentYearMonth(ym);
            }}
            markedDates={markedDates}
            theme={{
              calendarBackground: colors.surface,
              textSectionTitleColor: colors.textMuted,
              dayTextColor: colors.text,
              textDisabledColor: colors.border,
              monthTextColor: colors.text,
              todayTextColor: colors.primary,
              arrowColor: colors.primary,
              selectedDayBackgroundColor: colors.primary,
              selectedDayTextColor: colors.onPrimary,
              textMonthFontWeight: "bold",
            }}
          />
        </Card>

        <Text style={styles.sectionHeader} variant="titleMedium">
          {sectionTitle}: {periodLabel}
        </Text>

        {/* Resumo financeiro do intervalo */}
        <View style={styles.summaryRow}>
          <Card
            mode="outlined"
            style={[styles.summaryCard, { marginRight: 6 }]}
          >
            <Card.Content>
              <Text style={styles.mutedText} variant="labelSmall">
                Entradas
              </Text>
              <Text
                style={styles.incomeText}
                variant="titleMedium"
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                + {formatBRL(income)}
              </Text>
            </Card.Content>
          </Card>

          <Card mode="outlined" style={[styles.summaryCard, { marginLeft: 6 }]}>
            <Card.Content>
              <Text style={styles.mutedText} variant="labelSmall">
                Saídas
              </Text>
              <Text
                style={styles.expenseText}
                variant="titleMedium"
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                - {formatBRL(expense)}
              </Text>
            </Card.Content>
          </Card>
        </View>

        <Card mode="outlined" style={styles.netCard}>
          <Card.Content style={styles.netContent}>
            <Text style={styles.mutedText} variant="labelMedium">
              Saldo líquido {isSingleDay ? "do dia" : "do período"}
            </Text>
            <Text
              variant="titleMedium"
              style={[
                styles.netValue,
                { color: net >= 0 ? colors.success : colors.danger },
              ]}
            >
              {formatBRL(net)}
            </Text>
          </Card.Content>
        </Card>

        {/* Pedidos com entrega no intervalo */}
        <Text style={styles.subHeader} variant="titleSmall">
          Pedidos ({orders.length})
        </Text>

        {orders.length === 0 ? (
          <Card mode="outlined" style={styles.listCard}>
            <Text style={styles.emptyText}>
              Nenhum pedido com entrega{" "}
              {isSingleDay ? "neste dia" : "neste período"}.
            </Text>
          </Card>
        ) : (
          orders.map((order) => (
            <Card key={order.id} mode="outlined" style={styles.orderCard}>
              <Card.Content>
                <View style={styles.rowBetween}>
                  <Text
                    style={styles.customerName}
                    variant="titleSmall"
                    numberOfLines={1}
                  >
                    {order.customer_name}
                  </Text>
                  <StatusBadge status={order.status} />
                </View>
                <Text style={styles.itemsText} variant="bodySmall">
                  {order.items_summary}
                </Text>
                <Divider style={styles.orderDivider} />
                <View style={styles.rowBetween}>
                  <View>
                    {!isSingleDay && (
                      <Text style={styles.mutedText} variant="labelSmall">
                        Entrega: {formatDateBR(order.delivery_date)}
                      </Text>
                    )}
                    <Text style={styles.mutedText} variant="labelSmall">
                      Pagto: {order.payment_method.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.orderTotal} variant="titleSmall">
                    {formatBRL(order.total_amount)}
                  </Text>
                </View>
              </Card.Content>
            </Card>
          ))
        )}

        {/* Movimentações de caixa do intervalo */}
        <Text style={styles.subHeader} variant="titleSmall">
          Movimentações do Caixa ({transactions.length})
        </Text>

        <Card mode="outlined" style={styles.listCard}>
          {transactions.length === 0 ? (
            <Text style={styles.emptyText}>
              Nenhuma movimentação{" "}
              {isSingleDay ? "nesta data" : "neste período"}.
            </Text>
          ) : (
            <View>
              {transactions.map((tx, idx) => {
                const time = tx.created_at.slice(11, 16);
                const when = isSingleDay
                  ? time
                  : `${tx.created_at.slice(8, 10)}/${tx.created_at.slice(5, 7)} ${time}`;

                return (
                  <React.Fragment key={tx.id}>
                    <List.Item
                      title={tx.description}
                      description={`${ORIGIN_LABEL[tx.origin]} · ${when}`}
                      left={(props) => (
                        <List.Icon
                          {...props}
                          icon={
                            tx.type === "IN"
                              ? "arrow-bottom-left"
                              : "arrow-top-right"
                          }
                          color={
                            tx.type === "IN" ? colors.success : colors.danger
                          }
                        />
                      )}
                      right={() => (
                        <Text
                          style={[
                            styles.txValue,
                            {
                              color:
                                tx.type === "IN"
                                  ? colors.success
                                  : colors.danger,
                            },
                          ]}
                        >
                          {tx.type === "IN" ? "+" : "-"} {formatBRL(tx.amount)}
                        </Text>
                      )}
                    />
                    {idx < transactions.length - 1 && <Divider />}
                  </React.Fragment>
                );
              })}
            </View>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  modeButtons: { marginBottom: 8 },
  hint: { color: colors.textMuted, marginBottom: 12 },
  calendarCard: { borderRadius: 12, overflow: "hidden", marginBottom: 16 },
  sectionHeader: { fontWeight: "bold", color: colors.text, marginBottom: 10 },
  subHeader: {
    fontWeight: "600",
    color: colors.text,
    marginTop: 12,
    marginBottom: 8,
  },
  summaryRow: { flexDirection: "row", marginBottom: 8 },
  summaryCard: { flex: 1, borderRadius: 8 },
  netCard: { borderRadius: 8 },
  netContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  netValue: { fontWeight: "bold" },
  mutedText: { color: colors.textMuted },
  incomeText: { fontWeight: "bold", color: colors.success, marginTop: 2 },
  expenseText: { fontWeight: "bold", color: colors.danger, marginTop: 2 },
  listCard: { borderRadius: 8 },
  emptyText: { color: colors.textMuted, textAlign: "center", padding: 16 },
  orderCard: { marginBottom: 8, borderRadius: 8 },
  customerName: { flex: 1, fontWeight: "bold", marginRight: 8 },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemsText: { color: colors.textMuted, marginTop: 6 },
  orderDivider: { marginVertical: 8 },
  orderTotal: { fontWeight: "bold", color: colors.success },
  txValue: { alignSelf: "center", fontWeight: "600", marginRight: 8 },
});
