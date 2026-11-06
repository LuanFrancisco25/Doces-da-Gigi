/**
 * Identidade visual "Rosa Doce": rosa framboesa + creme rosado + marrom-chocolate.
 * Arquivo puro (sem React Native) para também poder ser usado em relatórios PDF.
 */
export const colors = {
  // Marca
  primary: "#C2185B", // rosa framboesa (botões, FAB, ícones ativos)
  primarySoft: "#FCE4EC", // rosa bem claro (destaques, itens selecionados)
  primaryBorder: "#F4B6CB",

  // Superfícies
  background: "#FFF5F8", // creme rosado (fundo das telas)
  surface: "#FFFFFF", // cartões, modais, barra de abas
  surfaceAlt: "#FBEBF1", // caixas internas (resumos, custos)
  border: "#F1D3DE",

  // Texto
  text: "#3E2229", // marrom-chocolate
  textMuted: "#8A6572", // marrom-rosado suave
  onPrimary: "#FFFFFF",

  // Estados (semânticos)
  success: "#25704D",
  successSoft: "#E3F4EB",
  danger: "#C0392B",
  dangerSoft: "#FDE8E6",
  dangerBorder: "#F2B8B2",
  warning: "#9A5B00",
  warningSoft: "#FFF1D6",
} as const;
