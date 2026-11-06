import { type SQLiteDatabase } from 'expo-sqlite';
import { Ingredient, CreateIngredientInput } from '../../types';
import * as Crypto from 'expo-crypto';

export class IngredientRepository {
  constructor(private db: SQLiteDatabase) {}

  async findAll(): Promise<Ingredient[]> {
    return await this.db.getAllAsync<Ingredient>(
      `SELECT * FROM ingredients ORDER BY name ASC`
    );
  }

  async findById(id: string): Promise<Ingredient | null> {
    return await this.db.getFirstAsync<Ingredient>(
      `SELECT * FROM ingredients WHERE id = ?`,
      [id]
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
        ]
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
          ]
        );
      }
    });

    return id;
  }

  async delete(id: string): Promise<void> {
    await this.db.runAsync(`DELETE FROM ingredients WHERE id = ?`, [id]);
  }

  async updatePrice(id: string, newPrice: number): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      const ingredient = await this.findById(id);
      if (!ingredient) throw new Error('Ingrediente não encontrado');

      const newCostPerUnit = newPrice / ingredient.package_quantity;

      await this.db.runAsync(
        `UPDATE ingredients 
         SET package_price = ?, cost_per_base_unit = ?, updated_at = datetime('now', 'localtime')
         WHERE id = ?`,
        [newPrice, newCostPerUnit, id]
      );
    });
  }
}
