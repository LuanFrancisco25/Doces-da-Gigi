/**
 * Converte o texto digitado ("12,5" ou "12.5") em número.
 * Devolve null se estiver vazio, for inválido (letras, "1.2.3") ou não for maior que zero.
 */
export function parsePositiveNumber(text: string): number | null {
  const normalized = text.trim().replace(",", ".");
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}
