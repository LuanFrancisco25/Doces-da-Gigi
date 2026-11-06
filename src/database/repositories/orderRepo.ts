import { type SQLiteDatabase } from "expo-sqlite";
import * as Crypto from "expo-crypto";
import { CreateOrderInput, OrderWithItems, OrderStatus } from "../../types";

export class OrderRepository {
  constructor(private db: SQLiteDatabase) {}

  // Busca pedidos do mês atual (ano-mês corrente: YYYY-MM)
  async findCurrentMonthOrders(): Promise<OrderWithItems[]> {
    return await this.db.getAllAsync<OrderWithItems>(`
      SELECT 
        o.id,
        o.customer_name,
        o.customer_phone,
        o.status,
        o.payment_method,
        o.total_amount,
        o.delivery_date,
        o.created_at,
        GROUP_CONCAT(p.name || ' (' || oi.quantity || 'un)', ', ') AS items_summary
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE strftime('%Y-%m', o.delivery_date) = strftime('%Y-%m', 'now', 'localtime')
      GROUP BY o.id
      ORDER BY o.delivery_date DESC, o.created_at DESC
    `);
  }

  // Criação atômica de pedido com reserva de estoque
  async create(input: CreateOrderInput): Promise<string> {
    const orderId = Crypto.randomUUID();

    await this.db.withTransactionAsync(async () => {
      // 1. Gravar cabeçalho do pedido
      await this.db.runAsync(
        `
        INSERT INTO orders (
          id, customer_name, customer_phone, status, payment_method, total_amount, delivery_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
        [
          orderId,
          input.customer_name,
          input.customer_phone ?? null,
          input.status,
          input.payment_method,
          input.total_amount,
          input.delivery_date,
        ],
      );

      // 2. Gravar itens e baixar o estoque imediatamente (reserva)
      for (const item of input.items) {
        const itemId = Crypto.randomUUID();
        await this.db.runAsync(
          `
          INSERT INTO order_items (id, order_id, product_id, quantity, unit_price)
          VALUES (?, ?, ?, ?, ?)
        `,
          [itemId, orderId, item.product_id, item.quantity, item.unit_price],
        );

        await this.db.runAsync(
          `
          UPDATE products 
          SET stock_quantity = stock_quantity - ?, updated_at = datetime('now', 'localtime')
          WHERE id = ?
        `,
          [item.quantity, item.product_id],
        );
      }

      // 3. Se já nasceu Concluído, credita imediatamente no livro-caixa
      if (input.status === "completed") {
        const txId = Crypto.randomUUID();
        await this.db.runAsync(
          `
          INSERT INTO financial_transactions (id, type, amount, description, origin, reference_id)
          VALUES (?, 'IN', ?, ?, 'order', ?)
        `,
          [
            txId,
            input.total_amount,
            `Venda: ${input.customer_name} (${input.payment_method.toUpperCase()})`,
            orderId,
          ],
        );
      }
    });

    return orderId;
  }

  // Transição: Marcar pedido como Concluído
  async completeOrder(orderId: string): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      const order = await this.db.getFirstAsync<{
        id: string;
        status: OrderStatus;
        total_amount: number;
        customer_name: string;
        payment_method: string;
      }>(
        `SELECT id, status, total_amount, customer_name, payment_method FROM orders WHERE id = ?`,
        [orderId],
      );

      if (!order) throw new Error("Pedido não encontrado");
      if (order.status === "completed") return;

      // 1. Atualizar status
      await this.db.runAsync(
        `UPDATE orders SET status = 'completed', updated_at = datetime('now', 'localtime') WHERE id = ?`,
        [orderId],
      );

      // 2. Creditar no saldo
      const txId = Crypto.randomUUID();
      await this.db.runAsync(
        `
        INSERT INTO financial_transactions (id, type, amount, description, origin, reference_id)
        VALUES (?, 'IN', ?, ?, 'order', ?)
      `,
        [
          txId,
          order.total_amount,
          `Venda Concluída: ${order.customer_name} (${order.payment_method.toUpperCase()})`,
          orderId,
        ],
      );
    });
  }

  // Transição: Cancelar Pedido (com opção de estornar doces ao estoque)
  async cancelOrder(
    orderId: string,
    returnItemsToStock: boolean,
  ): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      const order = await this.db.getFirstAsync<{
        id: string;
        status: OrderStatus;
        total_amount: number;
        customer_name: string;
      }>(
        `SELECT id, status, total_amount, customer_name FROM orders WHERE id = ?`,
        [orderId],
      );

      if (!order) throw new Error("Pedido não encontrado");
      if (order.status === "canceled") return;

      // 1. Se o pedido já estava concluído, estorna a entrada de caixa
      if (order.status === "completed") {
        const txId = Crypto.randomUUID();
        await this.db.runAsync(
          `
          INSERT INTO financial_transactions (id, type, amount, description, origin, reference_id)
          VALUES (?, 'OUT', ?, ?, 'manual_adjustment', ?)
        `,
          [
            txId,
            order.total_amount,
            `Estorno Cancelamento: ${order.customer_name}`,
            orderId,
          ],
        );
      }

      // 2. Se o usuário optou por devolver itens ao estoque físico
      if (returnItemsToStock) {
        const items = await this.db.getAllAsync<{
          product_id: string;
          quantity: number;
        }>(`SELECT product_id, quantity FROM order_items WHERE order_id = ?`, [
          orderId,
        ]);

        for (const item of items) {
          await this.db.runAsync(
            `
            UPDATE products 
            SET stock_quantity = stock_quantity + ?, updated_at = datetime('now', 'localtime')
            WHERE id = ?
          `,
            [item.quantity, item.product_id],
          );
        }
      }

      // 3. Atualizar status para cancelado
      await this.db.runAsync(
        `UPDATE orders SET status = 'canceled', updated_at = datetime('now', 'localtime') WHERE id = ?`,
        [orderId],
      );
    });
  }

  async getMonthlyOrderSummary(
    yearMonth: string,
  ): Promise<
    { delivery_date: string; total_orders: number; completed_revenue: number }[]
  > {
    return await this.db.getAllAsync<{
      delivery_date: string;
      total_orders: number;
      completed_revenue: number;
    }>(
      `SELECT 
         delivery_date,
         COUNT(id) AS total_orders,
         COALESCE(SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END), 0.0) AS completed_revenue
       FROM orders
       WHERE strftime('%Y-%m', delivery_date) = ?
       GROUP BY delivery_date`,
      [yearMonth],
    );
  }

  async getOrdersByDeliveryDate(dateString: string): Promise<OrderWithItems[]> {
    return await this.db.getAllAsync<OrderWithItems>(
      `SELECT 
         o.id, o.customer_name, o.customer_phone, o.status,
         o.payment_method, o.total_amount, o.delivery_date, o.created_at,
         GROUP_CONCAT(p.name || ' (' || oi.quantity || 'un)', ', ') AS items_summary
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE o.delivery_date = ?
       GROUP BY o.id
       ORDER BY o.created_at DESC`,
      [dateString],
    );
  }

  // Pedidos com entrega entre duas datas (YYYY-MM-DD, inclusive)
  async getOrdersByDeliveryRange(
    startDate: string,
    endDate: string,
  ): Promise<OrderWithItems[]> {
    return await this.db.getAllAsync<OrderWithItems>(
      `SELECT 
         o.id, o.customer_name, o.customer_phone, o.status,
         o.payment_method, o.total_amount, o.delivery_date, o.created_at,
         GROUP_CONCAT(p.name || ' (' || oi.quantity || 'un)', ', ') AS items_summary
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE o.delivery_date BETWEEN ? AND ?
       GROUP BY o.id
       ORDER BY o.delivery_date ASC, o.created_at ASC`,
      [startDate, endDate],
    );
  }
}
