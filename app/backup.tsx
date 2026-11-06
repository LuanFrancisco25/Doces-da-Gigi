import React, { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import * as DocumentPicker from "expo-document-picker";
import { Button, Card, Text } from "react-native-paper";

import { colors } from "@/src/theme";
import { DatePickerField } from "@/src/components/DatePickerField";
import { SettingsService } from "@/src/services/settingsService";
import {
  parseBackup,
  restoreBackup,
  summarizeBackup,
} from "@/src/services/backupData";
import {
  ReportKind,
  createBackupFile,
  createReportFile,
  readTextFile,
  shareFile,
} from "@/src/services/backupFiles";
import {
  formatDateBR,
  formatDateTimeBR,
  getLocalDateString,
} from "@/src/utils/date";

function nowLocal(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${getLocalDateString(now)} ${hh}:${mm}`;
}

export default function BackupScreen() {
  const db = useSQLiteContext();
  const today = getLocalDateString();

  // Período dos relatórios: do dia 1 do mês atual até hoje
  const [start, setStart] = useState(`${today.slice(0, 8)}01`);
  const [end, setEnd] = useState(today);
  const [busy, setBusy] = useState<string | null>(null);
  const [lastBackup, setLastBackup] = useState<string | null>(null);

  useEffect(() => {
    SettingsService.getLastBackup().then(setLastBackup);
  }, []);

  const run = async (key: string, task: () => Promise<void>) => {
    try {
      setBusy(key);
      await task();
    } catch (error) {
      Alert.alert(
        "Não foi possível concluir",
        error instanceof Error ? error.message : "Ocorreu um erro inesperado.",
      );
    } finally {
      setBusy(null);
    }
  };

  const handleStartChange = (value: string) => {
    setStart(value);
    if (value > end) setEnd(value); // mantém início <= fim
  };

  const handleEndChange = (value: string) => {
    setEnd(value);
    if (value < start) setStart(value);
  };

  const handleExportBackup = () =>
    run("backup", async () => {
      const file = await createBackupFile(db);
      const stamp = nowLocal();
      await SettingsService.setLastBackup(stamp);
      setLastBackup(stamp);
      await shareFile(file);
    });

  const handleReport = (kind: ReportKind) =>
    run(kind, async () => {
      const file = await createReportFile(db, kind, start, end);
      await shareFile(file);
    });

  const handleRestore = () =>
    run("restore", async () => {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      // valida o arquivo ANTES de perguntar, para mostrar o que ele contém
      const backup = parseBackup(await readTextFile(result.assets[0].uri));
      const info = summarizeBackup(backup);
      const generatedAt = info.exportedAt
        ? `Gerado em ${formatDateBR(info.exportedAt.slice(0, 10))}.\n\n`
        : "";

      Alert.alert(
        "Restaurar este backup?",
        `${generatedAt}Contém ${info.ingredients} insumos, ${info.products} doces, ${info.orders} pedidos e ${info.transactions} movimentações de caixa.\n\nTODOS os dados atuais do app serão substituídos. Isso não pode ser desfeito.`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Substituir tudo",
            style: "destructive",
            onPress: () =>
              run("restore", async () => {
                await restoreBackup(db, backup);
                Alert.alert(
                  "Backup restaurado",
                  "Os dados foram restaurados. Navegue pelas abas para conferir.",
                );
              }),
          },
        ],
      );
    });

  const disabled = busy !== null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      {/* Backup completo */}
      <Text variant="titleMedium" style={styles.sectionTitle}>
        Backup completo
      </Text>
      <Card mode="outlined" style={styles.card}>
        <Card.Content>
          <Text variant="bodyMedium" style={styles.body}>
            Salva todos os dados (insumos, doces, estoque, pedidos e caixa) em
            um arquivo. Guarde em &quot;Arquivos&quot; (iCloud Drive) ou envie
            para você mesma pelo WhatsApp.
          </Text>
          <Text
            variant="bodySmall"
            style={[styles.lastBackup, !lastBackup && styles.lastBackupNone]}
          >
            {lastBackup
              ? `Último backup gerado: ${formatDateTimeBR(lastBackup)}`
              : "Nenhum backup gerado ainda."}
          </Text>

          <Button
            mode="contained"
            icon="cloud-upload-outline"
            onPress={handleExportBackup}
            loading={busy === "backup"}
            disabled={disabled}
            style={styles.button}
          >
            Exportar backup
          </Button>
          <Button
            mode="outlined"
            icon="backup-restore"
            onPress={handleRestore}
            loading={busy === "restore"}
            disabled={disabled}
            style={styles.button}
          >
            Restaurar de um backup
          </Button>
        </Card.Content>
      </Card>

      {/* Relatórios */}
      <Text variant="titleMedium" style={styles.sectionTitle}>
        Relatórios por período
      </Text>
      <Card mode="outlined" style={styles.card}>
        <Card.Content>
          <Text variant="bodyMedium" style={styles.body}>
            Escolha o período e envie o relatório em PDF ou planilha (CSV). Os
            pedidos entram pela data de entrega e o caixa pela data do
            lançamento.
          </Text>

          <DatePickerField
            label="De"
            title="Data inicial"
            value={start}
            onChange={handleStartChange}
          />
          <DatePickerField
            label="Até"
            title="Data final"
            value={end}
            onChange={handleEndChange}
          />

          <Button
            mode="contained"
            icon="file-pdf-box"
            onPress={() => handleReport("pdf")}
            loading={busy === "pdf"}
            disabled={disabled}
            style={styles.button}
          >
            Relatório em PDF
          </Button>
          <View style={styles.row}>
            <Button
              mode="outlined"
              icon="file-delimited-outline"
              onPress={() => handleReport("orders_csv")}
              loading={busy === "orders_csv"}
              disabled={disabled}
              style={styles.rowButton}
            >
              Pedidos CSV
            </Button>
            <Button
              mode="outlined"
              icon="cash-multiple"
              onPress={() => handleReport("ledger_csv")}
              loading={busy === "ledger_csv"}
              disabled={disabled}
              style={styles.rowButton}
            >
              Caixa CSV
            </Button>
          </View>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontWeight: "bold", color: colors.text, marginBottom: 8 },
  card: { marginBottom: 20, borderRadius: 8 },
  body: { color: colors.textMuted, marginBottom: 12 },
  lastBackup: { color: colors.success, fontWeight: "600", marginBottom: 14 },
  lastBackupNone: { color: colors.warning },
  button: { marginTop: 4, marginBottom: 8 },
  row: { flexDirection: "row", gap: 8 },
  rowButton: { flex: 1 },
});
