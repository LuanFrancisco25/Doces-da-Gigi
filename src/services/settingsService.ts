import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_ALWAYS_DEDUCT = "@doces:always_deduct_production";
const KEY_LAST_BACKUP = "@doces:last_backup";

export const SettingsService = {
  async getAlwaysDeduct(): Promise<boolean> {
    const val = await AsyncStorage.getItem(KEY_ALWAYS_DEDUCT);
    return val === "true"; // false por padrão
  },

  async setAlwaysDeduct(value: boolean): Promise<void> {
    await AsyncStorage.setItem(KEY_ALWAYS_DEDUCT, String(value));
  },

  // Data e hora do último backup gerado, no formato "YYYY-MM-DD HH:MM" (horário local)
  async getLastBackup(): Promise<string | null> {
    return await AsyncStorage.getItem(KEY_LAST_BACKUP);
  },

  async setLastBackup(value: string): Promise<void> {
    await AsyncStorage.setItem(KEY_LAST_BACKUP, value);
  },
};
