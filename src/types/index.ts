export type PackageUnit = "g" | "ml" | "un";
export type OrderStatus = "pending" | "completed" | "canceled";
export type PaymentMethod = "pix" | "cash" | "card";
export type TransactionType = "IN" | "OUT";
export type TransactionOrigin =
  | "order"
  | "production"
  | "ingredient_purchase"
  | "manual_adjustment";

export interface Ingredient {
  id: string;
  name: string;
  package_quantity: number;
  package_unit: PackageUnit;
  package_price: number;
  cost_per_base_unit: number;
  created_at: string;
  updated_at: string;
}

export interface CreateIngredientInput {
  name: string;
  package_quantity: number;
  package_unit: PackageUnit;
  package_price: number;
  register_expense: boolean;
}

export type UpdateIngredientInput = Omit<
  CreateIngredientInput,
  "register_expense"
>;

export interface Product {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
  min_stock_alert: number;
  yield_units: number;
  unit_production_cost: number;
  created_at: string;
  updated_at: string;
}

export interface CreateProductInput {
  id: string;
  name: string;
  price: number;
  min_stock_alert?: number;
  yield_units?: number;
  unit_production_cost?: number;
}

export interface ProductRecipeItem {
  ingredient_id: string;
  quantity_used: number;
}

export interface CreateProductWithRecipeInput {
  name: string;
  price: number;
  min_stock_alert?: number;
  yield_units?: number;
  unit_production_cost?: number;
  recipes?: ProductRecipeItem[];
}

export interface OrderItemInput {
  product_id: string;
  quantity: number;
  unit_price: number;
}

export interface CreateOrderInput {
  customer_name: string;
  customer_phone?: string;
  status: OrderStatus;
  payment_method: PaymentMethod;
  total_amount: number;
  delivery_date: string; // YYYY-MM-DD
  items: OrderItemInput[];
}

export interface OrderWithItems {
  id: string;
  customer_name: string;
  customer_phone?: string;
  status: OrderStatus;
  payment_method: PaymentMethod;
  total_amount: number;
  delivery_date: string;
  created_at: string;
  items_summary?: string; // Agrupado para exibição rápida na lista
}
