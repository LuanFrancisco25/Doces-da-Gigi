import { type SQLiteDatabase } from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { Product, CreateProductWithRecipeInput } from '../../types';

export interface ProductRecipeDetail {
  ingredient_id: string;
  ingredient_name: string;
  package_unit: string;
  quantity_used: number;
  cost_per_base_unit: number;
  item_cost: number;
}

export class ProductRepository {
  constructor(private db: SQLiteDatabase) {}

  async findAll(): Promise<Product[]> {
    return await this.db.getAllAsync<Product>(
      `SELECT * FROM products ORDER BY name ASC`
    );
  }

  async findById(id: string): Promise<Product | null> {
    return await this.db.getFirstAsync<Product>(
      `SELECT * FROM products WHERE id = ?`,
      [id]
    );
  }

  // Busca os ingredientes vinculados a um doce específico
  async getRecipeItems(productId: string): Promise<ProductRecipeDetail[]> {
    return await this.db.getAllAsync<ProductRecipeDetail>(`
      SELECT 
        pr.ingredient_id,
        i.name AS ingredient_name,
        i.package_unit,
        pr.quantity_used,
        i.cost_per_base_unit,
        (pr.quantity_used * i.cost_per_base_unit) AS item_cost
      FROM product_recipes pr
      JOIN ingredients i ON i.id = pr.ingredient_id
      WHERE pr.product_id = ?
    `, [productId]);
  }

  // Criação do produto com Ficha Técnica atômica
  async createWithRecipe(input: CreateProductWithRecipeInput): Promise<string> {
    const productId = Crypto.randomUUID();

    await this.db.withTransactionAsync(async () => {
      // 1. Gravar produto
      await this.db.runAsync(`
        INSERT INTO products (
          id, name, price, stock_quantity, min_stock_alert, yield_units, unit_production_cost
        ) VALUES (?, ?, ?, 0, ?, ?, ?)
      `, [
        productId,
        input.name,
        input.price,
        input.min_stock_alert ?? 5,
        input.yield_units ?? 1,
        input.unit_production_cost ?? 0.0,
      ]);

      // 2. Gravar itens da receita (se houver)
      if (input.recipes && input.recipes.length > 0) {
        for (const item of input.recipes) {
          const recipeId = Crypto.randomUUID();
          await this.db.runAsync(`
            INSERT INTO product_recipes (id, product_id, ingredient_id, quantity_used)
            VALUES (?, ?, ?, ?)
          `, [recipeId, productId, item.ingredient_id, item.quantity_used]);
        }
      }
    });

    return productId;
  }

  // Duplicar doce (clona dados cadastrais e a ficha técnica)
  async duplicate(originalProductId: string, newName: string): Promise<string> {
    const newProductId = Crypto.randomUUID();

    await this.db.withTransactionAsync(async () => {
      const original = await this.findById(originalProductId);
      if (!original) throw new Error('Produto original não encontrado');

      // 1. Clona registro de produto
      await this.db.runAsync(`
        INSERT INTO products (
          id, name, price, stock_quantity, min_stock_alert, yield_units, unit_production_cost
        ) VALUES (?, ?, ?, 0, ?, ?, ?)
      `, [
        newProductId,
        newName,
        original.price,
        original.min_stock_alert,
        original.yield_units,
        original.unit_production_cost,
      ]);

      // 2. Clona os ingredientes da receita
      const recipeRows = await this.db.getAllAsync<{ ingredient_id: string; quantity_used: number }>(`
        SELECT ingredient_id, quantity_used FROM product_recipes WHERE product_id = ?
      `, [originalProductId]);

      for (const row of recipeRows) {
        const newRecipeId = Crypto.randomUUID();
        await this.db.runAsync(`
          INSERT INTO product_recipes (id, product_id, ingredient_id, quantity_used)
          VALUES (?, ?, ?, ?)
        `, [newRecipeId, newProductId, row.ingredient_id, row.quantity_used]);
      }
    });

    return newProductId;
  }

  /**
   * Incrementa o estoque de um doce.
   * Se deductFromBalance for true, debita o custo do lote do caixa.
   */
  async increaseStock(params: {
    productId: string;
    quantityToAdd: number;
    deductFromBalance: boolean;
    transactionId: string;
  }): Promise<void> {
    const { productId, quantityToAdd, deductFromBalance, transactionId } = params;

    await this.db.withTransactionAsync(async () => {
      const product = await this.findById(productId);
      if (!product) {
        throw new Error(`Produto com ID ${productId} não foi encontrado.`);
      }

      // 1. Incrementa as unidades no estoque físico
      await this.db.runAsync(
        `UPDATE products 
         SET stock_quantity = stock_quantity + ?, updated_at = datetime('now', 'localtime')
         WHERE id = ?`,
        [quantityToAdd, productId]
      );

      // 2. Se marcado para deduzir e o doce tiver custo unitário registrado, lança a saída no caixa
      if (deductFromBalance && product.unit_production_cost > 0) {
        const totalCost = product.unit_production_cost * quantityToAdd;

        await this.db.runAsync(
          `INSERT INTO financial_transactions 
           (id, type, amount, description, origin, reference_id)
           VALUES (?, 'OUT', ?, ?, 'production', ?)`,
          [
            transactionId,
            totalCost,
            `Produção: +${quantityToAdd} un de ${product.name}`,
            productId,
          ]
        );
      }
    });
  }

  // Excluir produto
  async delete(id: string): Promise<void> {
    await this.db.runAsync(`DELETE FROM products WHERE id = ?`, [id]);
  }
}