import { type SQLiteDatabase } from "expo-sqlite";
import * as Crypto from "expo-crypto";
import { TransactionType, TransactionOrigin } from "../../types";

export interface FinancialTransaction {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  origin: TransactionOrigin;
  reference_id?: string;
  created_at: string;
}

export class TransactionRepository {
  constructor(private db: SQLiteDatabase) {}

  // Calcula o saldo total consolidado do livro-caixa
  async getCurrentBalance(): Promise<number> {
    const result = await this.db.getFirstAsync<{ balance: number }>(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'IN' THEN amount ELSE -amount END), 0.0) AS balance
      FROM financial_transactions
    `);
    return result?.balance ?? 0.0;
  }

  // Faturamento (entradas) e saídas do dia corrente
  async getDailySummary(): Promise<{ income: number; expense: number }> {
    const result = await this.db.getFirstAsync<{
      income: number;
      expense: number;
    }>(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'IN' THEN amount ELSE 0 END), 0.0) AS income,
        COALESCE(SUM(CASE WHEN type = 'OUT' THEN amount ELSE 0 END), 0.0) AS expense
      FROM financial_transactions
      WHERE date(created_at) = date('now', 'localtime')
    `);
    return {
      income: result?.income ?? 0.0,
      expense: result?.expense ?? 0.0,
    };
  }

  // Extrato das movimentações mais recentes
  async getRecentTransactions(limit = 10): Promise<FinancialTransaction[]> {
    return await this.db.getAllAsync<FinancialTransaction>(
      `
      SELECT * FROM financial_transactions 
      ORDER BY created_at DESC 
      LIMIT ?
    `,
      [limit],
    );
  }

  // Ajustes manuais de saldo (aporte ou sangria)
  async addManualAdjustment(
    type: TransactionType,
    amount: number,
    description: string,
  ): Promise<void> {
    const id = Crypto.randomUUID();
    await this.db.runAsync(
      `
      INSERT INTO financial_transactions (id, type, amount, description, origin)
      VALUES (?, ?, ?, ?, 'manual_adjustment')
    `,
      [id, type, amount, description],
    );
  }

  async getTransactionsByDate(
    dateString: string,
  ): Promise<FinancialTransaction[]> {
    return await this.db.getAllAsync<FinancialTransaction>(
      `SELECT * FROM financial_transactions
       WHERE date(created_at) = date(?)
       ORDER BY created_at DESC`,
      [dateString],
    );
  }

  // Movimentações entre duas datas (YYYY-MM-DD, inclusive), da mais recente para a mais antiga
  async getTransactionsByRange(
    startDate: string,
    endDate: string,
  ): Promise<FinancialTransaction[]> {
    return await this.db.getAllAsync<FinancialTransaction>(
      `SELECT * FROM financial_transactions
       WHERE date(created_at) BETWEEN date(?) AND date(?)
       ORDER BY created_at DESC`,
      [startDate, endDate],
    );
  }
}
