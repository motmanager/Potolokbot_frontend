export function formatNumber(value) {
  return value.toLocaleString('ru-RU', { maximumFractionDigits: 2, useGrouping: false })
}
