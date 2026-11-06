import React, { useRef } from "react";
import { colors } from "@/src/theme";
import {
  InputAccessoryView,
  Keyboard,
  KeyboardTypeOptions,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { Button, TextInput, useTheme } from "react-native-paper";
import type { TextInputProps } from "react-native-paper";

const BRAND_COLOR = colors.primary;

// Teclados numéricos do iOS não têm tecla "OK"/"Return", então ganham uma barra própria.
const NUMERIC_KEYBOARDS: KeyboardTypeOptions[] = [
  "decimal-pad",
  "number-pad",
  "numeric",
  "phone-pad",
];

let accessoryCounter = 0;

/**
 * Campo de texto padrão do app.
 * - Fundo igual ao da superfície (evita o "retalho" atrás do rótulo no modo outlined).
 * - Teclado numérico no iOS ganha uma barra com o botão "OK" que fecha o teclado.
 * - Teclados de texto fecham ao tocar em "Concluir" (returnKeyType="done").
 */
export function AppTextInput(props: TextInputProps) {
  const theme = useTheme();
  const accessoryId = useRef(`keyboard-done-${++accessoryCounter}`).current;

  const hasNumericKeyboard =
    Platform.OS === "ios" &&
    !props.multiline &&
    props.keyboardType !== undefined &&
    NUMERIC_KEYBOARDS.includes(props.keyboardType);

  return (
    <>
      <TextInput
        mode="outlined"
        activeOutlineColor={BRAND_COLOR}
        outlineStyle={styles.outline}
        returnKeyType="done"
        {...props}
        style={[{ backgroundColor: theme.colors.surface }, props.style]}
        inputAccessoryViewID={hasNumericKeyboard ? accessoryId : undefined}
      />
      {hasNumericKeyboard && (
        <InputAccessoryView nativeID={accessoryId}>
          <View
            style={[
              styles.accessoryBar,
              {
                backgroundColor: theme.colors.surfaceVariant,
                borderTopColor: theme.colors.outlineVariant,
              },
            ]}
          >
            <Button textColor={BRAND_COLOR} onPress={Keyboard.dismiss}>
              OK
            </Button>
          </View>
        </InputAccessoryView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  outline: { borderRadius: 10 },
  accessoryBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
