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
  IconButton,
  Checkbox,
  Button,
  Chip,
  Divider,
  Switch,
} from "react-native-paper";
import { AppModal } from "@/src/components/AppModal";
import { AppTextInput } from "@/src/components/AppTextInput";
import { ProductRepository } from "@/src/database/repositories/productRepo";
import { Product } from "@/src/types";
import { SettingsService } from "@/src/services/settingsService";
import * as Crypto from "expo-crypto";

export default function StockScreen() {
  const db = useSQLiteContext();
  const repo = new ProductRepository(db);
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  // Estados do Modal de Produção / Adicionar Estoque
  const [produceModalVisible, setProduceModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantityToAdd, setQuantityToAdd] = useState("");
  const [deductCost, setDeductCost] = useState(true);
  const [alwaysDeduct, setAlwaysDeduct] = useState(false);
  const [rememberPreference, setRememberPreference] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);

  // Estados do Modal de Duplicação
  const [duplicateModalVisible, setDuplicateModalVisible] = useState(false);
  const [duplicateName, setDuplicateName] = useState("");

  const loadProducts = async () => {
    try {
      const data = await repo.findAll();
      setProducts(data);
    } catch (error) {
      console.error("Erro ao buscar produtos:", error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, []),
  );

  // Abre modal para produzir/aumentar estoque lendo a preferência salva
  const handleOpenProduce = async (product: Product) => {
    setSelectedProduct(product);
    setQuantityToAdd(
      product.yield_units > 0 ? String(product.yield_units) : "10",
    );

    // Consulta se o usuário já marcou a opção global de "sempre deduzir"
    const isAlwaysDeductActive = await SettingsService.getAlwaysDeduct();
    setAlwaysDeduct(isAlwaysDeductActive);
    setDeductCost(true);
    setRememberPreference(false);

    setProduceModalVisible(true);
  };

  const handleToggleAlwaysDeduct = async (value: boolean) => {
    setAlwaysDeduct(value);
    await SettingsService.setAlwaysDeduct(value);
  };

  // Confirma a adição de lote ao estoque
  const handleConfirmProduce = async () => {
    if (!selectedProduct) return;

    const qty = parseInt(quantityToAdd, 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert(
        "Quantidade inválida",
        "Informe um número inteiro maior que zero.",
      );
      return;
    }

    try {
      setSubmitting(true);

      // Se não estava no modo automático mas marcou para lembrar agora, salva globalmente
      if (!alwaysDeduct && rememberPreference && deductCost) {
        await SettingsService.setAlwaysDeduct(true);
      }

      const transactionId = Crypto.randomUUID();

      await repo.increaseStock({
        productId: selectedProduct.id,
        quantityToAdd: qty,
        deductFromBalance: alwaysDeduct ? true : deductCost,
        transactionId,
      });

      setProduceModalVisible(false);
      setSelectedProduct(null);
      await loadProducts();
    } catch (error) {
      Alert.alert("Erro", "Não foi possível atualizar o estoque.");
    } finally {
      setSubmitting(false);
    }
  };

  // Abre modal para duplicar doce
  const handleOpenDuplicate = (product: Product) => {
    setSelectedProduct(product);
    setDuplicateName(`${product.name} (Cópia)`);
    setDuplicateModalVisible(true);
  };

  // Confirma duplicação
  const handleConfirmDuplicate = async () => {
    if (!selectedProduct || !duplicateName.trim()) {
      Alert.alert("Atenção", "Informe o nome para o novo doce.");
      return;
    }

    try {
      setSubmitting(true);
      await repo.duplicate(selectedProduct.id, duplicateName.trim());
      setDuplicateModalVisible(false);
      setSelectedProduct(null);
      await loadProducts();
    } catch (error) {
      Alert.alert("Erro", "Falha ao duplicar o produto.");
    } finally {
      setSubmitting(false);
    }
  };

  // Exclusão de produto
  const handleDelete = (id: string, name: string) => {
    Alert.alert("Excluir Doce", `Deseja realmente excluir "${name}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            await repo.delete(id);
            await loadProducts();
          } catch (error) {
            Alert.alert(
              "Não permitido",
              "Não é possível excluir um doce que já possui pedidos registrados.",
            );
          }
        },
      },
    ]);
  };

  const calculatedBatchCost = selectedProduct
    ? selectedProduct.unit_production_cost * (parseInt(quantityToAdd, 10) || 0)
    : 0;

  return (
    <View style={styles.container}>
      <RNView style={styles.topBar}>
        <Text variant="titleMedium" style={styles.screenHeaderTitle}>
          Doces em Estoque
        </Text>
        <IconButton
          icon="cog-outline"
          size={22}
          onPress={() => setSettingsModalVisible(true)}
        />
      </RNView>
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              Nenhum doce cadastrado no estoque.
            </Text>
            <Text style={styles.emptySubtext}>
              Toque no botão "+" para cadastrar o primeiro.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isCritical = item.stock_quantity <= 0;
          const isLow =
            item.stock_quantity < item.min_stock_alert && !isCritical;

          return (
            <Card style={styles.card} mode="outlined">
              <Card.Content>
                <RNView style={styles.cardHeader}>
                  <RNView style={{ flex: 1 }}>
                    <Text variant="titleMedium" style={styles.productName}>
                      {item.name}
                    </Text>
                    <Text variant="bodySmall" style={styles.priceTag}>
                      Preço de Venda: {formatBRL(item.price)}
                    </Text>
                  </RNView>

                  {/* Badge de Alerta de Estoque */}
                  <Chip
                    compact
                    style={[
                      styles.stockChip,
                      isCritical
                        ? styles.chipCritical
                        : isLow
                          ? styles.chipLow
                          : styles.chipHealthy,
                    ]}
                    textStyle={[
                      styles.stockChipText,
                      isCritical
                        ? styles.chipTextCritical
                        : isLow
                          ? styles.chipTextLow
                          : styles.chipTextHealthy,
                    ]}
                  >
                    {item.stock_quantity} un
                  </Chip>
                </RNView>

                <Divider style={styles.divider} />

                <RNView style={styles.cardFooter}>
                  <RNView>
                    <Text variant="labelSmall" style={styles.metaLabel}>
                      Custo Unit.: {formatBRL(item.unit_production_cost)}
                    </Text>
                    <Text variant="labelSmall" style={styles.metaLabel}>
                      Mínimo desejado: {item.min_stock_alert} un
                    </Text>
                  </RNView>

                  <RNView style={styles.actionsRow}>
                    <IconButton
                      icon="content-copy"
                      size={20}
                      onPress={() => handleOpenDuplicate(item)}
                    />
                    <IconButton
                      icon="delete-outline"
                      size={20}
                      onPress={() => handleDelete(item.id, item.name)}
                    />
                    <Button
                      mode="contained-tonal"
                      icon="plus-box"
                      compact
                      onPress={() => handleOpenProduce(item)}
                      style={styles.produceBtn}
                    >
                      Produzir
                    </Button>
                  </RNView>
                </RNView>
              </Card.Content>
            </Card>
          );
        }}
      />

      {/* FAB para criar novo doce */}
      <FAB
        color={colors.onPrimary}
        icon="plus"
        label="Novo Doce"
        style={styles.fab}
        onPress={() => router.push("/products/new")}
      />

      {/* Modal de Configurações de Produção */}
      <AppModal
        visible={settingsModalVisible}
        onDismiss={() => setSettingsModalVisible(false)}
      >
        <Text variant="titleLarge" style={styles.modalTitle}>
          Preferências de Produção
        </Text>

        <RNView style={styles.switchRow}>
          <RNView style={{ flex: 1, marginRight: 12 }}>
            <Text variant="bodyLarge" style={{ fontWeight: "500" }}>
              Sempre deduzir custo do saldo
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: colors.textMuted, marginTop: 2 }}
            >
              Ao produzir um lote, debita o valor automaticamente sem perguntar.
            </Text>
          </RNView>
          <Switch
            value={alwaysDeduct}
            onValueChange={handleToggleAlwaysDeduct}
            color={colors.primary}
          />
        </RNView>

        <Button
          mode="contained"
          onPress={() => setSettingsModalVisible(false)}
          style={[styles.confirmBtn, { marginTop: 20 }]}
        >
          Concluir
        </Button>
      </AppModal>

      {/* Modal de Produção / Adicionar Estoque */}
      <AppModal
        visible={produceModalVisible}
        onDismiss={() => setProduceModalVisible(false)}
      >
        <Text variant="titleLarge" style={styles.modalTitle}>
          Produzir: {selectedProduct?.name}
        </Text>

        <AppTextInput
          label="Quantidade Produzida (unidades)"
          value={quantityToAdd}
          onChangeText={setQuantityToAdd}
          mode="outlined"
          keyboardType="number-pad"
          style={styles.input}
        />

        {/* Seção de Dedução de Saldo */}
        {selectedProduct &&
          selectedProduct.unit_production_cost > 0 &&
          (alwaysDeduct ? (
            // 1. Cenário Automático: Usuário já configurou para sempre deduzir
            <RNView style={styles.autoDeductNotice}>
              <Text variant="bodySmall" style={styles.autoDeductText}>
                ✓ Custo de produção será debitado do caixa automaticamente.
              </Text>
            </RNView>
          ) : (
            // 2. Cenário Manual: Escolha por lote + checkbox para fixar preferência
            <RNView style={{ marginBottom: 12 }}>
              <RNView style={styles.checkboxRow}>
                <Checkbox.Android
                  status={deductCost ? "checked" : "unchecked"}
                  onPress={() => setDeductCost(!deductCost)}
                  color={colors.primary}
                />
                <Text
                  variant="bodyMedium"
                  style={styles.checkboxLabel}
                  onPress={() => setDeductCost(!deductCost)}
                >
                  Deduzir custo de produção do saldo
                </Text>
              </RNView>

              {deductCost && (
                <RNView
                  style={[styles.checkboxRow, { marginLeft: 28, marginTop: 4 }]}
                >
                  <Checkbox.Android
                    status={rememberPreference ? "checked" : "unchecked"}
                    onPress={() => setRememberPreference(!rememberPreference)}
                    color={colors.primary}
                  />
                  <Text
                    variant="bodySmall"
                    style={{ color: colors.textMuted, flex: 1 }}
                    onPress={() => setRememberPreference(!rememberPreference)}
                  >
                    Sempre deduzir automaticamente (não perguntar mais)
                  </Text>
                </RNView>
              )}
            </RNView>
          ))}

        {/* Estimativa de valor a ser debitado */}
        {(alwaysDeduct || deductCost) && calculatedBatchCost > 0 && (
          <RNView style={styles.costEstimateBox}>
            <Text variant="bodySmall" style={styles.costEstimateText}>
              Será debitado do caixa:{" "}
              <Text style={{ fontWeight: "bold" }}>
                {formatBRL(calculatedBatchCost)}
              </Text>
            </Text>
          </RNView>
        )}

        <Button
          mode="contained"
          onPress={handleConfirmProduce}
          loading={submitting}
          style={styles.confirmBtn}
        >
          Confirmar Entrada no Estoque
        </Button>
      </AppModal>

      {/* Modal de Duplicação */}
      <AppModal
        visible={duplicateModalVisible}
        onDismiss={() => setDuplicateModalVisible(false)}
      >
        <Text variant="titleLarge" style={styles.modalTitle}>
          Duplicar Doce
        </Text>
        <Text
          variant="bodySmall"
          style={{ marginBottom: 12, color: colors.textMuted }}
        >
          Será criada uma cópia com a mesma ficha técnica, rendimento e custo de
          produção.
        </Text>

        <AppTextInput
          label="Nome da Variação"
          value={duplicateName}
          onChangeText={setDuplicateName}
          mode="outlined"
          style={styles.input}
        />

        <Button
          mode="contained"
          onPress={handleConfirmDuplicate}
          loading={submitting}
          style={styles.confirmBtn}
        >
          Salvar Cópia
        </Button>
      </AppModal>
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
  productName: { fontWeight: "bold", color: colors.text },
  priceTag: { color: colors.textMuted, marginTop: 2 },
  stockChip: { borderRadius: 16, height: 28 },
  chipHealthy: { backgroundColor: colors.successSoft },
  chipLow: { backgroundColor: colors.warningSoft },
  chipCritical: { backgroundColor: colors.dangerSoft },
  stockChipText: { fontWeight: "bold", fontSize: 12 },
  chipTextHealthy: { color: colors.success },
  chipTextLow: { color: colors.warning },
  chipTextCritical: { color: colors.danger },
  divider: { marginVertical: 10 },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metaLabel: { color: colors.textMuted },
  actionsRow: { flexDirection: "row", alignItems: "center" },
  produceBtn: { marginLeft: 4, backgroundColor: colors.primarySoft },
  fab: {
    position: "absolute",
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: colors.primary,
  },
  modal: {
    backgroundColor: "white",
    padding: 20,
    margin: 20,
    borderRadius: 12,
  },
  modalTitle: { fontWeight: "bold", marginBottom: 16 },
  input: { marginBottom: 12 },
  checkboxRow: { flexDirection: "row", alignItems: "center" },
  checkboxLabel: { flex: 1, color: colors.text },
  autoDeductNotice: {
    padding: 10,
    backgroundColor: colors.successSoft,
    borderRadius: 6,
    marginBottom: 12,
  },
  autoDeductText: { color: colors.success, fontWeight: "500" },
  costEstimateBox: {
    padding: 10,
    backgroundColor: colors.primarySoft,
    borderRadius: 6,
    marginBottom: 16,
  },
  costEstimateText: { color: colors.warning },
  confirmBtn: { backgroundColor: colors.primary, marginTop: 4 },
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
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 8,
  },
});
