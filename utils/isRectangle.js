// четыре угла и все прямые
export function isRectangle(corners) {
  if (corners.length !== 4) return false
  return corners.every((corner, i) => {
    const prev = corners[(i + 3) % 4]
    const next = corners[(i + 1) % 4]
    const ax = prev.x - corner.x
    const ay = prev.y - corner.y
    const bx = next.x - corner.x
    const by = next.y - corner.y
    // косинус угла почти ноль
    return Math.abs(ax * bx + ay * by) < Math.hypot(ax, ay) * Math.hypot(bx, by) * 0.0001
  })
}
