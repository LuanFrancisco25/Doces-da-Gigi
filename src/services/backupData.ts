import { type SQLiteDatabase } from "expo-sqlite";
import type { FinancialTransaction } from "../database/repositories/transactionRepo";
import type {
  OrderStatus,
  OrderWithItems,
  PaymentMethod,
  TransactionOrigin,
} from "../types";
import { colors } from "../theme/colors";
import { formatBRL } from "../utils/currency";
import { formatDateBR } from "../utils/date";

/**
 * Lógica pura de backup e relatórios (sem acesso a arquivos).
 * A parte que grava/compartilha arquivos fica em backupFiles.ts.
 */

// ---------------------------------------------------------------------------
// Backup completo (JSON)
// ---------------------------------------------------------------------------

export const BACKUP_APP_ID = "doces-da-gigi";
export const BACKUP_VERSION = 1;

// Colunas de cada tabela, na ordem em que são gravadas. Os nomes vêm daqui e nunca do
// arquivo importado, então um backup adulterado não consegue injetar SQL.
const TABLES = {
  ingredients: [
    "id",
    "name",
    "package_quantity",
    "package_unit",
    "package_price",
    "cost_per_base_unit",
    "created_at",
    "updated_at",
  ],
  products: [
    "id",
    "name",
    "price",
    "stock_quantity",
    "min_stock_alert",
    "yield_units",
    "unit_production_cost",
    "created_at",
    "updated_at",
  ],
  product_recipes: ["id", "product_id", "ingredient_id", "quantity_used"],
  orders: [
    "id",
    "customer_name",
    "customer_phone",
    "status",
    "payment_method",
    "total_amount",
    "delivery_date",
    "created_at",
    "updated_at",
  ],
  order_items: ["id", "order_id", "product_id", "quantity", "unit_price"],
  financial_transactions: [
    "id",
    "type",
    "amount",
    "description",
    "origin",
    "reference_id",
    "created_at",
  ],
} as const;

type TableName = keyof typeof TABLES;

// Ordem que respeita as chaves estrangeiras (pais antes dos filhos)
const TABLE_ORDER: TableName[] = [
  "ingredients",
  "products",
  "product_recipes",
  "orders",
  "order_items",
  "financial_transactions",
];

type Cell = string | number | null;
type Row = Record<string, Cell>;

export interface BackupFile {
  app: string;
  version: number;
  exported_at: string;
  tables: Record<TableName, Row[]>;
}

export interface BackupSummary {
  exportedAt: string;
  ingredients: number;
  products: number;
  orders: number;
  transactions: number;
}

export async function exportData(db: SQLiteDatabase): Promise<BackupFile> {
  const tables = {} as Record<TableName, Row[]>;
  for (const table of TABLE_ORDER) {
    tables[table] = await db.getAllAsync<Row>(
      `SELECT ${TABLES[table].join(", ")} FROM ${table}`,
    );
  }
  return {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    tables,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCell(value: unknown): value is Cell {
  return (
    value === null || typeof value === "string" || typeof value === "number"
  );
}

/** Lê e valida o texto de um arquivo de backup. Lança Error com mensagem em português. */
export function parseBackup(text: string): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(text.replace(/^﻿/, ""));
  } catch {
    throw new Error(
      "O arquivo não é um backup válido (não foi possível ler o JSON).",
    );
  }

  if (!isRecord(data) || data.app !== BACKUP_APP_ID) {
    throw new Error("Este arquivo não é um backup do Doces da Gigi.");
  }
  if (typeof data.version !== "number" || data.version > BACKUP_VERSION) {
    throw new Error("Este backup foi gerado por uma versão mais nova do app.");
  }
  if (!isRecord(data.tables)) {
    throw new Error("Backup incompleto: não há dados de tabelas.");
  }

  const tables = {} as Record<TableName, Row[]>;
  for (const table of TABLE_ORDER) {
    const rows = data.tables[table];
    if (!Array.isArray(rows)) {
      throw new Error(`Backup incompleto: falta a tabela "${table}".`);
    }
    tables[table] = rows.map((row, index) => {
      if (!isRecord(row)) {
        throw new Error(
          `Backup inválido: linha ${index + 1} de "${table}" está corrompida.`,
        );
      }
      const clean: Row = {};
      for (const column of TABLES[table]) {
        const value = row[column];
        if (value === undefined) {
          clean[column] = null;
        } else if (isCell(value)) {
          clean[column] = value;
        } else {
          throw new Error(
            `Backup inválido: valor inesperado em "${table}", coluna "${column}".`,
          );
        }
      }
      return clean;
    });
  }

  return {
    app: BACKUP_APP_ID,
    version: data.version,
    exported_at: typeof data.exported_at === "string" ? data.exported_at : "",
    tables,
  };
}

export function summarizeBackup(backup: BackupFile): BackupSummary {
  return {
    exportedAt: backup.exported_at,
    ingredients: backup.tables.ingredients.length,
    products: backup.tables.products.length,
    orders: backup.tables.orders.length,
    transactions: backup.tables.financial_transactions.length,
  };
}

/**
 * Substitui TODOS os dados atuais pelos do backup, numa única transação:
 * se qualquer linha falhar, nada é alterado.
 */
export async function restoreBackup(
  db: SQLiteDatabase,
  backup: BackupFile,
): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const table of [...TABLE_ORDER].reverse()) {
      await db.runAsync(`DELETE FROM ${table}`);
    }
    for (const table of TABLE_ORDER) {
      const columns = TABLES[table];
      const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns
        .map(() => "?")
        .join(", ")})`;
      for (const row of backup.tables[table]) {
        await db.runAsync(
          sql,
          columns.map((column) => row[column] ?? null),
        );
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Relatórios (CSV / PDF)
// ---------------------------------------------------------------------------

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  pix: "Pix",
  cash: "Dinheiro",
  card: "Cartão",
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pendente",
  completed: "Concluído",
  canceled: "Cancelado",
};

const ORIGIN_LABEL: Record<TransactionOrigin, string> = {
  order: "Venda",
  production: "Produção",
  ingredient_purchase: "Compra de insumo",
  manual_adjustment: "Ajuste manual",
};

// CSV pensado para o Excel/Numbers em português: separador ";", decimal com vírgula e BOM UTF-8.
function csvCell(value: string): string {
  return /[;"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

// Texto digitado pelo usuário: o apóstrofo impede que "=..." vire fórmula na planilha.
function csvText(value: string): string {
  return csvCell(/^[=+\-@\t\r]/.test(value) ? `'${value}` : value);
}

function decimalComma(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

function toCsv(headers: string[], rows: string[][]): string {
  return (
    "﻿" + [headers, ...rows].map((row) => row.join(";")).join("\r\n") + "\r\n"
  );
}

function splitDateTime(createdAt: string): { date: string; time: string } {
  return {
    date: formatDateBR(createdAt.slice(0, 10)),
    time: createdAt.slice(11, 16),
  };
}

export function buildOrdersCsv(orders: OrderWithItems[]): string {
  const rows = orders.map((order) => [
    formatDateBR(order.delivery_date),
    csvText(order.customer_name),
    csvText(order.customer_phone ?? ""),
    csvText(order.items_summary ?? ""),
    PAYMENT_LABEL[order.payment_method],
    STATUS_LABEL[order.status],
    decimalComma(order.total_amount),
  ]);
  return toCsv(
    [
      "Data de entrega",
      "Cliente",
      "Telefone",
      "Itens",
      "Pagamento",
      "Status",
      "Total (R$)",
    ],
    rows,
  );
}

export function buildLedgerCsv(transactions: FinancialTransaction[]): string {
  // do mais antigo para o mais recente
  const rows = [...transactions].reverse().map((tx) => {
    const { date, time } = splitDateTime(tx.created_at);
    return [
      date,
      time,
      tx.type === "IN" ? "Entrada" : "Saída",
      ORIGIN_LABEL[tx.origin],
      csvText(tx.description),
      decimalComma(tx.type === "IN" ? tx.amount : -tx.amount),
    ];
  });
  return toCsv(
    ["Data", "Hora", "Tipo", "Origem", "Descrição", "Valor (R$)"],
    rows,
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface ReportInput {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  orders: OrderWithItems[];
  transactions: FinancialTransaction[];
}

export function buildReportHtml({
  start,
  end,
  orders,
  transactions,
}: ReportInput): string {
  const income = transactions
    .filter((t) => t.type === "IN")
    .reduce((a, t) => a + t.amount, 0);
  const expense = transactions
    .filter((t) => t.type === "OUT")
    .reduce((a, t) => a + t.amount, 0);
  const net = income - expense;
  const count = (status: OrderStatus) =>
    orders.filter((o) => o.status === status).length;

  const period =
    start === end
      ? formatDateBR(start)
      : `${formatDateBR(start)} a ${formatDateBR(end)}`;

  const orderRows = orders
    .map(
      (o) => `<tr>
        <td>${formatDateBR(o.delivery_date)}</td>
        <td>${escapeHtml(o.customer_name)}</td>
        <td>${escapeHtml(o.items_summary ?? "")}</td>
        <td>${PAYMENT_LABEL[o.payment_method]}</td>
        <td>${STATUS_LABEL[o.status]}</td>
        <td class="num">${formatBRL(o.total_amount)}</td>
      </tr>`,
    )
    .join("");

  const txRows = [...transactions]
    .reverse()
    .map((tx) => {
      const { date, time } = splitDateTime(tx.created_at);
      const isIn = tx.type === "IN";
      return `<tr>
        <td>${date} ${time}</td>
        <td>${ORIGIN_LABEL[tx.origin]}</td>
        <td>${escapeHtml(tx.description)}</td>
        <td class="num ${isIn ? "in" : "out"}">${isIn ? "+" : "-"} ${formatBRL(tx.amount)}</td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<style>
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: ${colors.text}; padding: 8px; font-size: 12px; }
  h1 { color: ${colors.primary}; font-size: 22px; margin: 0 0 2px; }
  h2 { color: ${colors.text}; font-size: 15px; margin: 22px 0 8px; }
  .period { color: ${colors.textMuted}; margin-bottom: 16px; }
  .cards { display: flex; gap: 10px; }
  .card { flex: 1; border: 1px solid ${colors.primaryBorder}; background: ${colors.surfaceAlt}; border-radius: 8px; padding: 10px; }
  .card .label { color: ${colors.textMuted}; font-size: 11px; }
  .card .value { font-size: 16px; font-weight: bold; margin-top: 4px; }
  .in { color: ${colors.success}; }
  .out { color: ${colors.danger}; }
  .meta { margin-top: 10px; color: ${colors.textMuted}; }
  table { width: 100%; border-collapse: collapse; }
  th { background: ${colors.primary}; color: ${colors.onPrimary}; text-align: left; padding: 6px; font-size: 11px; }
  td { padding: 6px; border-bottom: 1px solid ${colors.border}; vertical-align: top; }
  tr { page-break-inside: avoid; }
  tr:nth-child(even) td { background: ${colors.background}; }
  .num { text-align: right; white-space: nowrap; }
  .empty { color: ${colors.textMuted}; padding: 8px 0; }
  .footer { margin-top: 24px; color: ${colors.textMuted}; font-size: 10px; }
</style>
</head>
<body>
  <h1>Doces da Gigi</h1>
  <div class="period">Relatório de ${period}</div>

  <div class="cards">
    <div class="card"><div class="label">Entradas</div><div class="value in">${formatBRL(income)}</div></div>
    <div class="card"><div class="label">Saídas</div><div class="value out">${formatBRL(expense)}</div></div>
    <div class="card"><div class="label">Saldo do período</div><div class="value ${net >= 0 ? "in" : "out"}">${formatBRL(net)}</div></div>
  </div>
  <div class="meta">Pedidos com entrega no período: ${orders.length} · Concluídos: ${count("completed")} · Pendentes: ${count("pending")} · Cancelados: ${count("canceled")}</div>

  <h2>Pedidos</h2>
  ${
    orders.length === 0
      ? '<div class="empty">Nenhum pedido neste período.</div>'
      : `<table><thead><tr><th>Entrega</th><th>Cliente</th><th>Itens</th><th>Pagamento</th><th>Status</th><th class="num">Total</th></tr></thead><tbody>${orderRows}</tbody></table>`
  }

  <h2>Movimentações do caixa</h2>
  ${
    transactions.length === 0
      ? '<div class="empty">Nenhuma movimentação neste período.</div>'
      : `<table><thead><tr><th>Data</th><th>Origem</th><th>Descrição</th><th class="num">Valor</th></tr></thead><tbody>${txRows}</tbody></table>`
  }

  <div class="footer">Gerado pelo app Doces da Gigi.</div>
</body>
</html>`;
}
