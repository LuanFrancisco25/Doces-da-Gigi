import React, { useEffect, useState } from "react";
import { colors } from "@/src/theme";
import { formatBRL } from "@/src/utils/currency";
import { StyleSheet, View, ScrollView, Alert } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { useRouter } from "expo-router";
import {
  Button,
  Card,
  Text,
  List,
  IconButton,
  Divider,
  Portal,
} from "react-native-paper";
import { AppModal } from "@/src/components/AppModal";
import { AppTextInput } from "@/src/components/AppTextInput";
import { ProductRepository } from "@/src/database/repositories/productRepo";
import { IngredientRepository } from "@/src/database/repositories/ingredientRepo";
import { Ingredient } from "@/src/types";

interface RecipeEntry {
  ingredient: Ingredient;
  quantityUsed: number;
}

export default function NewProductScreen() {
  const db = useSQLiteContext();
  const productRepo = new ProductRepository(db);
  const ingredientRepo = new IngredientRepository(db);
  const router = useRouter();

  // Dados do Produto
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [minStock, setMinStock] = useState("5");
  const [yieldUnits, setYieldUnits] = useState("1");

  // Ficha Técnica
  const [availableIngredients, setAvailableIngredients] = useState<
    Ingredient[]
  >([]);
  const [recipeEntries, setRecipeEntries] = useState<RecipeEntry[]>([]);

  // Modal de adição de ingrediente na receita
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedIngredient, setSelectedIngredient] =
    useState<Ingredient | null>(null);
  const [quantityInput, setQuantityInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    ingredientRepo.findAll().then(setAvailableIngredients);
  }, []);

  // Cálculos dinâmicos em tempo real
  const totalRecipeCost = recipeEntries.reduce((acc, item) => {
    return acc + item.quantityUsed * item.ingredient.cost_per_base_unit;
  }, 0);

  const parsedYield = Math.max(1, parseInt(yieldUnits || "1", 10));
  const unitCost = totalRecipeCost > 0 ? totalRecipeCost / parsedYield : 0;
  const parsedPrice = parseFloat(price.replace(",", ".")) || 0;
  const profitMargin =
    parsedPrice > 0 ? ((parsedPrice - unitCost) / parsedPrice) * 100 : 0;

  const handleAddIngredient = () => {
    if (!selectedIngredient) {
      Alert.alert("Atenção", "Selecione um ingrediente.");
      return;
    }
    const qty = parseFloat(quantityInput.replace(",", "."));
    if (isNaN(qty) || qty <= 0) {
      Alert.alert("Atenção", "Insira uma quantidade válida.");
      return;
    }

    setRecipeEntries((prev) => [
      ...prev.filter((r) => r.ingredient.id !== selectedIngredient.id),
      { ingredient: selectedIngredient, quantityUsed: qty },
    ]);

    setSelectedIngredient(null);
    setQuantityInput("");
    setModalVisible(false);
  };

  const handleRemoveIngredient = (id: string) => {
    setRecipeEntries((prev) =>
      prev.filter((item) => item.ingredient.id !== id),
    );
  };

  const handleSaveProduct = async () => {
    if (!name.trim() || !price.trim()) {
      Alert.alert("Erro", "Nome e Preço de Venda são obrigatórios.");
      return;
    }

    try {
      setSaving(true);
      await productRepo.createWithRecipe({
        name: name.trim(),
        price: parsedPrice,
        min_stock_alert: parseInt(minStock || "5", 10),
        yield_units: parsedYield,
        unit_production_cost: unitCost,
        recipes: recipeEntries.map((e) => ({
          ingredient_id: e.ingredient.id,
          quantity_used: e.quantityUsed,
        })),
      });

      Alert.alert("Sucesso", "Doce cadastrado com sucesso!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert("Erro", "Não foi possível cadastrar o doce.");
    } finally {
      setSaving(false);
    }
  };

  return (
    // Portal.Host próprio: esta tela abre como folha nativa do iOS e o host da raiz fica
    // escondido atrás dela, então o AppModal precisa de um host dentro da própria folha.
    <Portal.Host>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior="automatic"
      >
        {/* Dados Principais */}
        <Card style={styles.card} mode="outlined">
          <Card.Content>
            <AppTextInput
              label="Nome do Doce"
              value={name}
              onChangeText={setName}
              mode="outlined"
              style={styles.input}
            />
            <View style={styles.row}>
              <AppTextInput
                label="Preço de venda (R$)"
                value={price}
                onChangeText={setPrice}
                mode="outlined"
                keyboardType="decimal-pad"
                style={[styles.input, { flex: 1, marginRight: 8 }]}
              />
              <AppTextInput
                label="Estoque mínimo"
                value={minStock}
                onChangeText={setMinStock}
                mode="outlined"
                keyboardType="number-pad"
                style={[styles.input, { flex: 1 }]}
              />
            </View>
          </Card.Content>
        </Card>

        {/* Ficha Técnica / Receita */}
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Ficha Técnica (Opcional)
        </Text>
        <Card style={styles.card} mode="outlined">
          <Card.Content>
            <View style={styles.row}>
              <AppTextInput
                label="Rendimento (unidades)"
                value={yieldUnits}
                onChangeText={setYieldUnits}
                mode="outlined"
                keyboardType="number-pad"
                style={[styles.input, { flex: 1 }]}
              />
            </View>

            <Button
              mode="outlined"
              icon="plus"
              onPress={() => setModalVisible(true)}
              style={styles.addIngredientBtn}
            >
              Adicionar Ingrediente
            </Button>

            {recipeEntries.length > 0 && (
              <View style={{ marginTop: 12 }}>
                {recipeEntries.map((item) => (
                  <View key={item.ingredient.id}>
                    <List.Item
                      title={item.ingredient.name}
                      description={`Usa: ${item.quantityUsed}${item.ingredient.package_unit} (Custo: ${formatBRL(item.quantityUsed * item.ingredient.cost_per_base_unit)})`}
                      right={(props) => (
                        <IconButton
                          {...props}
                          icon="close-circle-outline"
                          onPress={() =>
                            handleRemoveIngredient(item.ingredient.id)
                          }
                        />
                      )}
                    />
                    <Divider />
                  </View>
                ))}
              </View>
            )}

            {/* Painel de Custos Calculados */}
            <View style={styles.costBox}>
              <Text variant="bodyMedium">
                Custo Total da Receita:{" "}
                <Text style={{ fontWeight: "bold" }}>
                  {formatBRL(totalRecipeCost)}
                </Text>
              </Text>
              <Text variant="titleMedium" style={styles.unitCostHighlight}>
                Custo Unitário: {formatBRL(unitCost)} / un
              </Text>
              {parsedPrice > 0 && (
                <Text
                  variant="bodySmall"
                  style={{
                    color: profitMargin >= 0 ? colors.success : colors.danger,
                  }}
                >
                  Margem Estimada: {profitMargin.toFixed(1).replace(".", ",")}%
                </Text>
              )}
            </View>
          </Card.Content>
        </Card>

        <Button
          mode="contained"
          onPress={handleSaveProduct}
          loading={saving}
          style={styles.saveBtn}
        >
          Salvar Doce
        </Button>

        {/* Modal para Escolher Ingrediente */}
        <AppModal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
        >
          <Text variant="titleMedium" style={styles.modalTitle}>
            Adicionar à Receita
          </Text>

          <ScrollView style={{ maxHeight: 200, marginBottom: 16 }}>
            {availableIngredients.length === 0 ? (
              <Text style={{ color: colors.textMuted }}>
                Nenhum insumo cadastrado na aba Insumos.
              </Text>
            ) : (
              availableIngredients.map((ing) => (
                <List.Item
                  key={ing.id}
                  title={ing.name}
                  description={`${formatBRL(ing.cost_per_base_unit, 4)} / ${ing.package_unit}`}
                  style={[
                    styles.ingredientOption,
                    selectedIngredient?.id === ing.id && styles.selectedOption,
                  ]}
                  onPress={() => setSelectedIngredient(ing)}
                />
              ))
            )}
          </ScrollView>

          {selectedIngredient && (
            <AppTextInput
              label={`Quantidade gasta (${selectedIngredient.package_unit})`}
              value={quantityInput}
              onChangeText={setQuantityInput}
              mode="outlined"
              keyboardType="decimal-pad"
              style={styles.input}
            />
          )}

          <Button
            mode="contained"
            onPress={handleAddIngredient}
            disabled={!selectedIngredient}
            style={styles.modalBtn}
          >
            Incluir na Ficha
          </Button>
        </AppModal>
      </ScrollView>
    </Portal.Host>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontWeight: "bold", marginBottom: 16, color: colors.text },
  card: { marginBottom: 16, borderRadius: 8 },
  sectionTitle: { fontWeight: "600", marginBottom: 8, color: colors.text },
  input: { marginBottom: 12 },
  row: { flexDirection: "row", backgroundColor: "transparent" },
  addIngredientBtn: { borderColor: colors.primary, marginVertical: 8 },
  costBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
  },
  unitCostHighlight: {
    fontWeight: "bold",
    color: colors.primary,
    marginVertical: 4,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 4,
    marginTop: 8,
  },
  modal: {
    backgroundColor: "white",
    padding: 20,
    margin: 20,
    borderRadius: 12,
  },
  modalTitle: { fontWeight: "bold", marginBottom: 12 },
  ingredientOption: { borderRadius: 6, marginBottom: 4 },
  selectedOption: { backgroundColor: colors.warningSoft },
  modalBtn: { backgroundColor: colors.primary, marginTop: 8 },
});
