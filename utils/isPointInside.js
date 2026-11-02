export function isPointInside(point, corners) {
  let inside = false
  corners.forEach((a, i) => {
    const b = corners[(i + 1) % corners.length]
    const crosses = (a.y > point.y) !== (b.y > point.y)
    if (crosses && point.x < a.x + (point.y - a.y) / (b.y - a.y) * (b.x - a.x)) inside = !inside
  })
  return inside
}
