/**
 * Retorna a data local no formato YYYY-MM-DD.
 * Não usa toISOString(), que converte para UTC e, no Brasil (UTC-3),
 * devolve o dia seguinte depois das 21h.
 */
export function getLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Valida se a string é uma data real no formato YYYY-MM-DD
 * (rejeita, por exemplo, 2026-02-31 ou 30/10/2026).
 */
export function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/** Converte YYYY-MM-DD para DD/MM/AAAA (exibição). */
export function formatDateBR(value: string): string {
  const [y, m, d] = value.split("-");
  return y && m && d ? `${d}/${m}/${y}` : value;
}

function parseLocalDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Soma (ou subtrai) dias de uma data YYYY-MM-DD, sempre no fuso local. */
export function addDays(value: string, days: number): string {
  const date = parseLocalDate(value);
  date.setDate(date.getDate() + days);
  return getLocalDateString(date);
}

/** Semana de domingo a sábado que contém a data informada. */
export function getWeekRange(value: string): { start: string; end: string } {
  const start = addDays(value, -parseLocalDate(value).getDay());
  return { start, end: addDays(start, 6) };
}

/** Primeiro e último dia de um mês no formato YYYY-MM. */
export function getMonthRange(yearMonth: string): {
  start: string;
  end: string;
} {
  const [y, m] = yearMonth.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return {
    start: `${yearMonth}-01`,
    end: `${yearMonth}-${String(lastDay).padStart(2, "0")}`,
  };
}

/** Lista todos os dias entre start e end (inclusive). O limite evita laços enormes. */
export function eachDay(start: string, end: string, max = 400): string[] {
  const days: string[] = [];
  let current = start;
  while (current <= end && days.length < max) {
    days.push(current);
    current = addDays(current, 1);
  }
  return days;
}

/** Converte "YYYY-MM-DD HH:MM:SS" (formato do SQLite) para "DD/MM às HH:MM". */
export function formatDateTimeBR(value: string): string {
  const [date, time = ""] = value.split(" ");
  const [, month, day] = date.split("-");
  if (!month || !day) return value;
  return time ? `${day}/${month} às ${time.slice(0, 5)}` : `${day}/${month}`;
}
