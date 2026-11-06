import { File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { type SQLiteDatabase } from "expo-sqlite";

import { OrderRepository } from "../database/repositories/orderRepo";
import { TransactionRepository } from "../database/repositories/transactionRepo";
import { getLocalDateString } from "../utils/date";
import {
  buildLedgerCsv,
  buildOrdersCsv,
  buildReportHtml,
  exportData,
} from "./backupData";

/** Arquivo pronto para ser enviado pela folha de compartilhamento do iOS. */
export interface ShareableFile {
  uri: string;
  mimeType: string;
  uti: string; // identificador de tipo do iOS
  dialogTitle: string;
}

export type ReportKind = "pdf" | "orders_csv" | "ledger_csv";

const FILE_PREFIX = "doces-da-gigi";

function timeStamp(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${getLocalDateString(now)}-${hh}${mm}`;
}

async function writeCacheFile(name: string, content: string): Promise<string> {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  await file.write(content);
  return file.uri;
}

/** Gera o backup completo (todas as tabelas) em um arquivo .json. */
export async function createBackupFile(
  db: SQLiteDatabase,
): Promise<ShareableFile> {
  const backup = await exportData(db);
  const uri = await writeCacheFile(
    `${FILE_PREFIX}-backup-${timeStamp()}.json`,
    JSON.stringify(backup, null, 2),
  );
  return {
    uri,
    mimeType: "application/json",
    uti: "public.json",
    dialogTitle: "Backup Doces da Gigi",
  };
}

/** Gera um relatório (PDF ou CSV) dos pedidos e do caixa entre duas datas (YYYY-MM-DD). */
export async function createReportFile(
  db: SQLiteDatabase,
  kind: ReportKind,
  start: string,
  end: string,
): Promise<ShareableFile> {
  const [orders, transactions] = await Promise.all([
    new OrderRepository(db).getOrdersByDeliveryRange(start, end),
    new TransactionRepository(db).getTransactionsByRange(start, end),
  ]);

  const range = start === end ? start : `${start}-a-${end}`;

  if (kind === "orders_csv") {
    const uri = await writeCacheFile(
      `${FILE_PREFIX}-pedidos-${range}.csv`,
      buildOrdersCsv(orders),
    );
    return {
      uri,
      mimeType: "text/csv",
      uti: "public.comma-separated-values-text",
      dialogTitle: "Pedidos (CSV)",
    };
  }

  if (kind === "ledger_csv") {
    const uri = await writeCacheFile(
      `${FILE_PREFIX}-caixa-${range}.csv`,
      buildLedgerCsv(transactions),
    );
    return {
      uri,
      mimeType: "text/csv",
      uti: "public.comma-separated-values-text",
      dialogTitle: "Livro-caixa (CSV)",
    };
  }

  // PDF (A4). O arquivo sai com nome aleatório; renomeamos para ficar legível no WhatsApp.
  const printed = await Print.printToFileAsync({
    html: buildReportHtml({ start, end, orders, transactions }),
    width: 595,
    height: 842,
  });
  let uri = printed.uri;
  try {
    const target = new File(
      Paths.cache,
      `${FILE_PREFIX}-relatorio-${range}.pdf`,
    );
    if (target.exists) target.delete();
    new File(printed.uri).move(target);
    uri = target.uri;
  } catch {
    // se o renome falhar, compartilha com o nome original mesmo
  }
  return {
    uri,
    mimeType: "application/pdf",
    uti: "com.adobe.pdf",
    dialogTitle: "Relatório (PDF)",
  };
}

/** Abre a folha de compartilhamento (WhatsApp, Arquivos/iCloud Drive, AirDrop, e-mail...). */
export async function shareFile(file: ShareableFile): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error(
      "O compartilhamento de arquivos não está disponível neste aparelho.",
    );
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: file.mimeType,
    UTI: file.uti,
    dialogTitle: file.dialogTitle,
  });
}

/** Lê o texto de um arquivo escolhido pelo seletor de documentos. */
export async function readTextFile(uri: string): Promise<string> {
  return await new File(uri).text();
}
