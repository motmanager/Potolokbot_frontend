export function orient(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}

function onSegment(a, b, p) {
  return Math.min(a.x, b.x) <= p.x && p.x <= Math.max(a.x, b.x)
    && Math.min(a.y, b.y) <= p.y && p.y <= Math.max(a.y, b.y)
}

export function segmentsIntersect(a, b, c, d) {
  const o1 = orient(a, b, c)
  const o2 = orient(a, b, d)
  const o3 = orient(c, d, a)
  const o4 = orient(c, d, b)
  if (o1 * o2 < 0 && o3 * o4 < 0) return true
  return (o1 === 0 && onSegment(a, b, c)) || (o2 === 0 && onSegment(a, b, d))
    || (o3 === 0 && onSegment(c, d, a)) || (o4 === 0 && onSegment(c, d, b))
}
