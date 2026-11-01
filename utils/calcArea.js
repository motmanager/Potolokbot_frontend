export function calcArea(corners) {
  let sum = 0
  corners.forEach((corner, i) => {
    const next = corners[(i + 1) % corners.length]
    sum += corner.x * next.y - next.x * corner.y
  })
  return Math.abs(sum) / 2
}
