/**
 * Formata em reais com separador de milhar: 1000126 -> "R$ 1.000.126,00".
 * `decimals` permite mais casas para custos unitários pequenos (ex.: R$ 0,0127 por grama).
 */
export function formatBRL(value: number, decimals = 2): string {
  const sign = value < 0 ? "-" : "";
  const [integer, fraction] = Math.abs(value).toFixed(decimals).split(".");
  const withThousands = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}R$ ${withThousands}${fraction ? "," + fraction : ""}`;
}
