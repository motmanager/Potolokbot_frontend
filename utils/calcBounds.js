export function calcBounds(corners) {
  const xs = corners.map((corner) => corner.x)
  const ys = corners.map((corner) => corner.y)
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
}
