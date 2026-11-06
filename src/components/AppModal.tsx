import React from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useTheme } from "react-native-paper";

interface AppModalProps {
  visible: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
}

/**
 * Modal padrão do app: um cartão pequeno centralizado sobre a tela atual.
 *
 * Usa o <Modal> nativo do React Native (transparente) porque ele é apresentado
 * por cima de TUDO, inclusive das telas abertas como folha do iOS
 * (presentation: 'modal'). O <Portal> do Paper não serve aqui: ele desenha no
 * fundo da árvore e fica escondido atrás dessas folhas.
 *
 * - Sobe junto com o teclado e rola só se o conteúdo passar do limite de altura.
 * - Tocar fora do cartão fecha o modal; tocar numa área vazia dentro dele só fecha o teclado.
 */
export function AppModal({ visible, onDismiss, children }: AppModalProps) {
  const theme = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onDismiss}>
          <Pressable
            style={[styles.card, { backgroundColor: theme.colors.surface }]}
            onPress={Keyboard.dismiss}
          >
            <ScrollView
              style={styles.scroll}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.content}
            >
              {children}
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  card: {
    width: "100%",
    maxWidth: 380,
    maxHeight: "75%",
    borderRadius: 16,
    overflow: "hidden",
  },
  // flexGrow 0: o cartão tem a altura do conteúdo e só rola ao passar de maxHeight.
  scroll: { flexGrow: 0 },
  content: { padding: 20 },
});
