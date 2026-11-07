import { type SQLiteDatabase } from "expo-sqlite";
import {
  Ingredient,
  CreateIngredientInput,
  UpdateIngredientInput,
} from "../../types";
import * as Crypto from "expo-crypto";

export class IngredientRepository {
  constructor(private db: SQLiteDatabase) {}

  async findAll(): Promise<Ingredient[]> {
    return await this.db.getAllAsync<Ingredient>(
      `SELECT * FROM ingredients ORDER BY name ASC`,
    );
  }

  async findById(id: string): Promise<Ingredient | null> {
    return await this.db.getFirstAsync<Ingredient>(
      `SELECT * FROM ingredients WHERE id = ?`,
      [id],
    );
  }

  async create(input: CreateIngredientInput): Promise<string> {
    const id = Crypto.randomUUID();
    const costPerBaseUnit = input.package_price / input.package_quantity;

    await this.db.withTransactionAsync(async () => {
      // 1. Inserir o ingrediente
      await this.db.runAsync(
        `INSERT INTO ingredients (id, name, package_quantity, package_unit, package_price, cost_per_base_unit)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.name,
          input.package_quantity,
          input.package_unit,
          input.package_price,
          costPerBaseUnit,
        ],
      );

      // 2. Se marcado para registrar despesa, criar transação financeira
      if (input.register_expense) {
        const transactionId = Crypto.randomUUID();
        await this.db.runAsync(
          `INSERT INTO financial_transactions (id, type, amount, description, origin, reference_id)
           VALUES (?, 'OUT', ?, ?, 'ingredient_purchase', ?)`,
          [
            transactionId,
            input.package_price,
            `Compra de Insumo: ${input.name}`,
            id,
          ],
        );
      }
    });

    return id;
  }

  async delete(id: string): Promise<void> {
    await this.db.runAsync(`DELETE FROM ingredients WHERE id = ?`, [id]);
  }

  // Em quantas receitas (doces) o insumo é usado
  async countRecipeUsage(id: string): Promise<number> {
    const row = await this.db.getFirstAsync<{ total: number }>(
      `SELECT COUNT(*) AS total FROM product_recipes WHERE ingredient_id = ?`,
      [id],
    );
    return row?.total ?? 0;
  }

  /**
   * Edita o insumo (nome, embalagem, unidade e preço).
   *
   * Preço desacoplado (RF01.3): só muda o custo das PRÓXIMAS produções. O custo unitário
   * guardado nos doces que usam o insumo é recalculado agora, mas lançamentos do caixa e
   * pedidos já gravados não são tocados. Editar não lança despesa (isso só acontece na compra).
   */
  async update(id: string, input: UpdateIngredientInput): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      const existing = await this.findById(id);
      if (!existing) throw new Error("Ingrediente não encontrado");

      // Trocar g/ml/un mudaria o sentido das quantidades já gravadas nas receitas
      if (
        input.package_unit !== existing.package_unit &&
        (await this.countRecipeUsage(id)) > 0
      ) {
        throw new Error(
          "A unidade não pode ser alterada: o insumo já é usado em receitas.",
        );
      }

      const costPerBaseUnit = input.package_price / input.package_quantity;

      await this.db.runAsync(
        `UPDATE ingredients
         SET name = ?, package_quantity = ?, package_unit = ?, package_price = ?,
             cost_per_base_unit = ?, updated_at = datetime('now', 'localtime')
         WHERE id = ?`,
        [
          input.name,
          input.package_quantity,
          input.package_unit,
          input.package_price,
          costPerBaseUnit,
          id,
        ],
      );

      await this.refreshProductCosts(id);
    });
  }

  async updatePrice(id: string, newPrice: number): Promise<void> {
    const ingredient = await this.findById(id);
    if (!ingredient) throw new Error("Ingrediente não encontrado");

    await this.update(id, {
      name: ingredient.name,
      package_quantity: ingredient.package_quantity,
      package_unit: ingredient.package_unit,
      package_price: newPrice,
    });
  }

  // Recalcula o custo unitário (soma dos insumos ÷ rendimento) dos doces que usam o insumo
  private async refreshProductCosts(ingredientId: string): Promise<void> {
    await this.db.runAsync(
      `UPDATE products
       SET unit_production_cost = (
             SELECT COALESCE(SUM(pr.quantity_used * i.cost_per_base_unit), 0)
             FROM product_recipes pr
             JOIN ingredients i ON i.id = pr.ingredient_id
             WHERE pr.product_id = products.id
           ) / MAX(COALESCE(yield_units, 1), 1),
           updated_at = datetime('now', 'localtime')
       WHERE id IN (SELECT product_id FROM product_recipes WHERE ingredient_id = ?)`,
      [ingredientId],
    );
  }
}
