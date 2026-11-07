import React, { useCallback, useState } from "react";
import { colors } from "@/src/theme";
import { formatBRL } from "@/src/utils/currency";
import { parsePositiveNumber } from "@/src/utils/number";
import { StyleSheet, View, FlatList, Alert } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { useFocusEffect } from "expo-router";
import { IngredientRepository } from "@/src/database/repositories/ingredientRepo";
import { Ingredient, PackageUnit } from "@/src/types";
import {
  FAB,
  List,
  IconButton,
  Button,
  Checkbox,
  SegmentedButtons,
  Text as PaperText,
} from "react-native-paper";
import { AppModal } from "@/src/components/AppModal";
import { AppTextInput } from "@/src/components/AppTextInput";

export default function IngredientsScreen() {
  const db = useSQLiteContext();
  const repo = new IngredientRepository(db);

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  // Insumo sendo editado (null = cadastrando um novo)
  const [editing, setEditing] = useState<Ingredient | null>(null);
  // A unidade fica travada quando o insumo já é usado em alguma receita
  const [unitLocked, setUnitLocked] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState<PackageUnit>("g");
  const [registerExpense, setRegisterExpense] = useState(true);

  const loadIngredients = async () => {
    const data = await repo.findAll();
    setIngredients(data);
  };

  useFocusEffect(
    useCallback(() => {
      loadIngredients();
    }, []),
  );

  const resetForm = () => {
    setEditing(null);
    setUnitLocked(false);
    setName("");
    setPrice("");
    setQuantity("");
    setUnit("g");
    setRegisterExpense(true);
  };

  const openCreate = () => {
    resetForm();
    setVisible(true);
  };

  const openEdit = async (item: Ingredient) => {
    setEditing(item);
    setName(item.name);
    setPrice(item.package_price.toFixed(2).replace(".", ","));
    setQuantity(String(item.package_quantity).replace(".", ","));
    setUnit(item.package_unit);
    setUnitLocked((await repo.countRecipeUsage(item.id)) > 0);
    setVisible(true);
  };

  const expensePreview = parsePositiveNumber(price);

  const handleSave = async () => {
    const trimmedName = name.trim();
    const parsedQuantity = parsePositiveNumber(quantity);
    const parsedPrice = parsePositiveNumber(price);

    if (!trimmedName) {
      Alert.alert("Atenção", "Informe o nome do insumo.");
      return;
    }
    if (parsedQuantity === null) {
      Alert.alert(
        "Quantidade inválida",
        "Informe um número maior que zero (ex: 395 ou 1,5).",
      );
      return;
    }
    if (parsedPrice === null) {
      Alert.alert(
        "Preço inválido",
        "Informe um valor maior que zero (ex: 7,90).",
      );
      return;
    }

    try {
      setLoading(true);

      if (editing) {
        await repo.update(editing.id, {
          name: trimmedName,
          package_quantity: parsedQuantity,
          package_unit: unit,
          package_price: parsedPrice,
        });
      } else {
        await repo.create({
          name: trimmedName,
          package_quantity: parsedQuantity,
          package_unit: unit,
          package_price: parsedPrice,
          register_expense: registerExpense,
        });
      }

      resetForm();
      setVisible(false);
      await loadIngredients();
    } catch (error) {
      Alert.alert("Erro", "Não foi possível salvar o insumo.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert("Excluir", "Deseja realmente excluir este insumo?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            await repo.delete(id);
            loadIngredients();
          } catch (error) {
            Alert.alert(
              "Não permitido",
              "Este insumo não pode ser excluído pois faz parte da receita de um doce cadastrado.",
            );
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={ingredients}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <PaperText style={styles.emptyText}>
            Nenhum insumo cadastrado. Toque em &quot;Novo Insumo&quot; para
            começar.
          </PaperText>
        }
        renderItem={({ item }) => (
          <List.Item
            title={item.name}
            description={`${item.package_quantity}${item.package_unit} - ${formatBRL(item.package_price)} (${formatBRL(item.cost_per_base_unit, 4)}/${item.package_unit})`}
            onPress={() => openEdit(item)}
            right={() => (
              <View style={styles.actions}>
                <IconButton
                  icon="pencil-outline"
                  accessibilityLabel="Editar insumo"
                  onPress={() => openEdit(item)}
                />
                <IconButton
                  icon="delete-outline"
                  iconColor={colors.danger}
                  accessibilityLabel="Excluir insumo"
                  onPress={() => handleDelete(item.id)}
                />
              </View>
            )}
          />
        )}
      />

      <AppModal visible={visible} onDismiss={() => setVisible(false)}>
        <PaperText variant="titleLarge" style={styles.modalTitle}>
          {editing ? "Editar Insumo" : "Novo Insumo"}
        </PaperText>

        <AppTextInput
          label="Nome do insumo"
          value={name}
          onChangeText={setName}
          autoCapitalize="sentences"
          style={styles.input}
        />
        <AppTextInput
          label="Quantidade na embalagem"
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="decimal-pad"
          style={styles.input}
        />
        <AppTextInput
          label="Preço pago (R$)"
          value={price}
          onChangeText={setPrice}
          keyboardType="decimal-pad"
          style={styles.input}
        />

        <SegmentedButtons
          value={unit}
          onValueChange={(value) => setUnit(value as PackageUnit)}
          buttons={[
            { value: "g", label: "Gramas (g)", disabled: unitLocked },
            { value: "ml", label: "ML", disabled: unitLocked },
            { value: "un", label: "Unid.", disabled: unitLocked },
          ]}
          style={styles.segmented}
        />

        {!editing && (
          <View style={styles.expenseBox}>
            <View style={styles.checkboxRow}>
              <Checkbox.Android
                status={registerExpense ? "checked" : "unchecked"}
                onPress={() => setRegisterExpense(!registerExpense)}
                color={colors.primary}
              />
              <PaperText
                variant="bodyMedium"
                style={styles.checkboxLabel}
                onPress={() => setRegisterExpense(!registerExpense)}
              >
                Lançar a compra como despesa no caixa
              </PaperText>
            </View>
            {registerExpense && expensePreview !== null && (
              <PaperText variant="bodySmall" style={styles.expensePreview}>
                Será debitado do caixa: {formatBRL(expensePreview)}
              </PaperText>
            )}
            {!registerExpense && (
              <PaperText variant="bodySmall" style={styles.note}>
                O insumo será cadastrado sem alterar o saldo do caixa.
              </PaperText>
            )}
          </View>
        )}

        {editing && (
          <View style={styles.notes}>
            {unitLocked && (
              <PaperText variant="bodySmall" style={styles.note}>
                A unidade não pode ser alterada: este insumo já faz parte de
                receitas.
              </PaperText>
            )}
            <PaperText variant="bodySmall" style={styles.note}>
              Alterar o preço não lança despesa. O custo dos doces que usam este
              insumo muda a partir das próximas produções; o caixa e os pedidos
              anteriores não são alterados.
            </PaperText>
          </View>
        )}

        <Button
          mode="contained"
          onPress={handleSave}
          loading={loading}
          style={styles.saveBtn}
        >
          {editing ? "Salvar alterações" : "Salvar insumo"}
        </Button>
      </AppModal>

      <FAB
        color={colors.onPrimary}
        icon="plus"
        style={styles.fab}
        onPress={openCreate}
        label="Novo Insumo"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 90,
  },
  emptyText: {
    color: colors.textMuted,
    textAlign: "center",
    padding: 24,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
  },
  fab: {
    position: "absolute",
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: colors.primary,
  },
  modalTitle: {
    fontWeight: "bold",
    marginBottom: 16,
  },
  input: {
    marginBottom: 12,
  },
  segmented: {
    marginBottom: 16,
  },
  notes: {
    marginBottom: 16,
    gap: 6,
  },
  note: {
    color: colors.textMuted,
  },
  expenseBox: {
    marginBottom: 16,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkboxLabel: {
    flex: 1,
    color: colors.text,
  },
  expensePreview: {
    color: colors.warning,
    backgroundColor: colors.primarySoft,
    borderRadius: 6,
    padding: 10,
    marginTop: 4,
  },
  saveBtn: {
    backgroundColor: colors.primary,
  },
});
