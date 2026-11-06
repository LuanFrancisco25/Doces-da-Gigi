import React, { useCallback, useState } from "react";
import { colors } from "@/src/theme";
import { formatBRL } from "@/src/utils/currency";
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

  // Form states
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState<PackageUnit>("g");

  const loadIngredients = async () => {
    const data = await repo.findAll();
    setIngredients(data);
  };

  useFocusEffect(
    useCallback(() => {
      loadIngredients();
    }, []),
  );

  const handleSave = async () => {
    if (!name || !price || !quantity) {
      Alert.alert("Erro", "Preencha todos os campos");
      return;
    }

    try {
      setLoading(true);
      await repo.create({
        name,
        package_price: parseFloat(price.replace(",", ".")),
        package_quantity: parseFloat(quantity.replace(",", ".")),
        package_unit: unit,
        register_expense: true, // Por padrão, deduz do caixa
      });

      setName("");
      setPrice("");
      setQuantity("");
      setVisible(false);
      loadIngredients();
    } catch (error) {
      Alert.alert("Erro", "Falha ao salvar ingrediente");
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
        renderItem={({ item }) => (
          <List.Item
            title={item.name}
            description={`${item.package_quantity}${item.package_unit} - ${formatBRL(item.package_price)} (${formatBRL(item.cost_per_base_unit, 4)}/${item.package_unit})`}
            right={(props) => (
              <IconButton
                {...props}
                icon="delete"
                onPress={() => handleDelete(item.id)}
              />
            )}
          />
        )}
      />

      <AppModal visible={visible} onDismiss={() => setVisible(false)}>
        <PaperText variant="titleLarge" style={styles.modalTitle}>
          Novo Insumo
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
            { value: "g", label: "Gramas (g)" },
            { value: "ml", label: "ML" },
            { value: "un", label: "Unid." },
          ]}
          style={styles.segmented}
        />

        <Button
          mode="contained"
          onPress={handleSave}
          loading={loading}
          style={styles.saveBtn}
        >
          Salvar e Lançar Despesa
        </Button>
      </AppModal>

      <FAB
        color={colors.onPrimary}
        icon="plus"
        style={styles.fab}
        onPress={() => setVisible(true)}
        label="Novo Insumo"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
    borderRadius: 8,
  },
  modalTitle: {
    fontWeight: "bold",
    marginBottom: 16,
  },
  input: {
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    marginBottom: 12,
    backgroundColor: "transparent",
  },
  segmented: {
    marginBottom: 20,
  },
  saveBtn: {
    backgroundColor: colors.primary,
  },
});
