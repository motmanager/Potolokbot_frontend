export function parseNumber(value) {
  return Number(String(value).replace(',', '.'))
}
