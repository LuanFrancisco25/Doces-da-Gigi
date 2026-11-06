import React, { useEffect, useState } from "react";
import { colors } from "@/src/theme";
import { formatBRL } from "@/src/utils/currency";
import {
  StyleSheet,
  View,
  ScrollView,
  Alert,
  View as RNView,
} from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { useRouter } from "expo-router";
import {
  Button,
  Card,
  Text,
  SegmentedButtons,
  IconButton,
  Divider,
} from "react-native-paper";
import { AppTextInput } from "@/src/components/AppTextInput";
import { ProductRepository } from "@/src/database/repositories/productRepo";
import { OrderRepository } from "@/src/database/repositories/orderRepo";
import { Product, OrderStatus, PaymentMethod } from "@/src/types";
import { getLocalDateString } from "@/src/utils/date";
import { DatePickerField } from "@/src/components/DatePickerField";

interface CartItem {
  product: Product;
  quantity: number;
}

export default function NewOrderScreen() {
  const db = useSQLiteContext();
  const productRepo = new ProductRepository(db);
  const orderRepo = new OrderRepository(db);
  const router = useRouter();

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(getLocalDateString());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [status, setStatus] = useState<OrderStatus>("pending");

  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    productRepo.findAll().then(setProducts);
  }, []);

  const handleUpdateCart = (product: Product, delta: number) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      const currentQty = existing ? existing.quantity : 0;
      const newQty = currentQty + delta;

      if (newQty <= 0) {
        return prev.filter((item) => item.product.id !== product.id);
      }

      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: newQty } : item,
        );
      }

      return [...prev, { product, quantity: newQty }];
    });
  };

  const totalAmount = cart.reduce(
    (acc, item) => acc + item.product.price * item.quantity,
    0,
  );

  const handleSaveOrder = async () => {
    if (!customerName.trim()) {
      Alert.alert("Atenção", "Informe o nome do cliente.");
      return;
    }

    if (cart.length === 0) {
      Alert.alert("Atenção", "Adicione pelo menos um doce ao pedido.");
      return;
    }

    // Alerta se a quantidade pedida exceder o estoque físico atual
    const hasInsufficientStock = cart.some(
      (item) => item.quantity > item.product.stock_quantity,
    );

    if (hasInsufficientStock) {
      Alert.alert(
        "Estoque insuficiente",
        "Um ou mais itens pedidos ultrapassam a quantidade atual em estoque. Deseja registrar a reserva mesmo assim?",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Continuar", onPress: () => processSave() },
        ],
      );
    } else {
      await processSave();
    }
  };

  const processSave = async () => {
    try {
      setSaving(true);
      await orderRepo.create({
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || undefined,
        delivery_date: deliveryDate,
        payment_method: paymentMethod,
        status,
        total_amount: totalAmount,
        items: cart.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: item.product.price,
        })),
      });

      Alert.alert("Sucesso", "Pedido registrado com sucesso!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert("Erro", "Não foi possível salvar o pedido.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
      contentInsetAdjustmentBehavior="automatic"
    >
      {/* Dados do Cliente */}
      <Card style={styles.card} mode="outlined">
        <Card.Content>
          <AppTextInput
            label="Nome do Cliente *"
            value={customerName}
            onChangeText={setCustomerName}
            mode="outlined"
            style={styles.input}
          />
          <AppTextInput
            label="Telefone (Opcional)"
            value={customerPhone}
            onChangeText={setCustomerPhone}
            mode="outlined"
            keyboardType="phone-pad"
            style={styles.input}
          />
          <DatePickerField
            label="Data de entrega"
            value={deliveryDate}
            onChange={setDeliveryDate}
          />
        </Card.Content>
      </Card>

      {/* Seleção dos Produtos */}
      <Text variant="titleMedium" style={styles.sectionTitle}>
        Escolha os Doces
      </Text>
      <Card style={styles.card} mode="outlined">
        <Card.Content>
          {products.length === 0 ? (
            <Text style={{ color: colors.textMuted }}>
              Nenhum doce cadastrado.
            </Text>
          ) : (
            products.map((prod) => {
              const inCart = cart.find((c) => c.product.id === prod.id);
              const qty = inCart ? inCart.quantity : 0;

              return (
                <RNView key={prod.id}>
                  <RNView style={styles.productSelectionRow}>
                    <RNView style={{ flex: 1 }}>
                      <Text variant="titleSmall" style={{ fontWeight: "600" }}>
                        {prod.name}
                      </Text>
                      <Text
                        variant="bodySmall"
                        style={{ color: colors.textMuted }}
                      >
                        {formatBRL(prod.price)} | Disp.: {prod.stock_quantity}{" "}
                        un
                      </Text>
                    </RNView>

                    <RNView style={styles.counterRow}>
                      <IconButton
                        icon="minus"
                        size={18}
                        disabled={qty === 0}
                        onPress={() => handleUpdateCart(prod, -1)}
                      />
                      <Text variant="titleSmall" style={styles.counterText}>
                        {qty}
                      </Text>
                      <IconButton
                        icon="plus"
                        size={18}
                        onPress={() => handleUpdateCart(prod, 1)}
                      />
                    </RNView>
                  </RNView>
                  <Divider style={{ marginVertical: 6 }} />
                </RNView>
              );
            })
          )}
        </Card.Content>
      </Card>

      {/* Pagamento e Status Inicial */}
      <Text variant="titleMedium" style={styles.sectionTitle}>
        Condição da Venda
      </Text>
      <Card style={styles.card} mode="outlined">
        <Card.Content>
          <Text
            variant="labelMedium"
            style={{ marginBottom: 6, color: colors.textMuted }}
          >
            Forma de Pagamento
          </Text>
          <SegmentedButtons
            value={paymentMethod}
            onValueChange={(val) => setPaymentMethod(val as PaymentMethod)}
            buttons={[
              { value: "pix", label: "Pix" },
              { value: "cash", label: "Dinheiro" },
              { value: "card", label: "Cartão" },
            ]}
            style={styles.segmented}
          />

          <Text
            variant="labelMedium"
            style={{ marginBottom: 6, color: colors.textMuted }}
          >
            Status do Pedido
          </Text>
          <SegmentedButtons
            value={status}
            onValueChange={(val) => setStatus(val as OrderStatus)}
            buttons={[
              { value: "pending", label: "Pendente" },
              { value: "completed", label: "Concluído" },
            ]}
            style={styles.segmented}
          />

          <RNView style={styles.totalBox}>
            <Text variant="titleMedium">Total do Pedido:</Text>
            <Text variant="headlineSmall" style={styles.totalPrice}>
              {formatBRL(totalAmount)}
            </Text>
          </RNView>
        </Card.Content>
      </Card>

      <Button
        mode="contained"
        onPress={handleSaveOrder}
        loading={saving}
        style={styles.saveBtn}
      >
        Gravar Pedido
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontWeight: "bold", marginBottom: 16, color: colors.text },
  card: { marginBottom: 16, borderRadius: 8 },
  sectionTitle: { fontWeight: "600", marginBottom: 8, color: colors.text },
  input: { marginBottom: 12 },
  productSelectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  counterRow: { flexDirection: "row", alignItems: "center" },
  counterText: { minWidth: 24, textAlign: "center", fontWeight: "bold" },
  segmented: { marginBottom: 14 },
  totalBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  totalPrice: { fontWeight: "bold", color: colors.success },
  saveBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 4,
    marginTop: 4,
  },
});
