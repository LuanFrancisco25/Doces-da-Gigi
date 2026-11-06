import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Calendar, DateData } from "react-native-calendars";
import { Button, Text, TextInput } from "react-native-paper";

import "@/src/utils/calendarLocale";
import { AppModal } from "@/src/components/AppModal";
import { AppTextInput } from "@/src/components/AppTextInput";
import { colors } from "@/src/theme";
import { formatDateBR, getLocalDateString } from "@/src/utils/date";

interface DatePickerFieldProps {
  label: string;
  /** Data no formato YYYY-MM-DD */
  value: string;
  onChange: (value: string) => void;
  /** Título do cartão do calendário. Se omitido, usa o próprio rótulo do campo. */
  title?: string;
}

/**
 * Campo de data: mostra DD/MM/AAAA e, ao tocar, abre um calendário para escolher o dia.
 * O valor continua sendo YYYY-MM-DD, que é o formato salvo no banco.
 */
export function DatePickerField({
  label,
  value,
  onChange,
  title,
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (date: string) => {
    onChange(date);
    setOpen(false);
  };

  return (
    <>
      <Pressable onPress={() => setOpen(true)}>
        {/* pointerEvents none: o toque vai para o Pressable, e o teclado nunca abre */}
        <View pointerEvents="none">
          <AppTextInput
            label={label}
            value={formatDateBR(value)}
            editable={false}
            right={<TextInput.Icon icon="calendar" color={colors.primary} />}
            style={styles.input}
          />
        </View>
      </Pressable>

      <AppModal visible={open} onDismiss={() => setOpen(false)}>
        <Text variant="titleLarge" style={styles.title}>
          {title ?? label}
        </Text>

        <Calendar
          current={value}
          onDayPress={(day: DateData) => handleSelect(day.dateString)}
          markedDates={{
            [value]: { selected: true, selectedColor: colors.primary },
          }}
          theme={{
            calendarBackground: colors.surface,
            textSectionTitleColor: colors.textMuted,
            dayTextColor: colors.text,
            textDisabledColor: colors.border,
            todayTextColor: colors.primary,
            arrowColor: colors.primary,
            monthTextColor: colors.text,
            selectedDayBackgroundColor: colors.primary,
            selectedDayTextColor: colors.onPrimary,
            textMonthFontWeight: "bold",
          }}
        />

        <View style={styles.actions}>
          <Button textColor={colors.textMuted} onPress={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            textColor={colors.primary}
            onPress={() => handleSelect(getLocalDateString())}
          >
            Hoje
          </Button>
        </View>
      </AppModal>
    </>
  );
}

const styles = StyleSheet.create({
  input: { marginBottom: 12 },
  title: { fontWeight: "bold", marginBottom: 12, color: colors.text },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
  },
});
