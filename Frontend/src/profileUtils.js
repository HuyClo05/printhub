export function plateFromProfile(settings = {}) {
  const points = Array.isArray(settings.printable_area)
    ? settings.printable_area.map(parsePoint).filter(Boolean)
    : []
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const minX = xs.length ? Math.min(...xs) : 0
  const maxX = xs.length ? Math.max(...xs) : 250
  const minY = ys.length ? Math.min(...ys) : 0
  const maxY = ys.length ? Math.max(...ys) : 250
  return {
    width: Math.max(maxX - minX, 1),
    depth: Math.max(maxY - minY, 1),
    height: Number(settings.printable_height) || 250,
    originX: minX,
    originY: minY,
    exclusions: parseExclusions(settings.bed_exclude_area)
  }
}

function parsePoint(value) {
  if (typeof value !== 'string') return null
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)x(-?\d+(?:\.\d+)?)$/i)
  return match ? { x: Number(match[1]), y: Number(match[2]) } : null
}

function parseExclusions(values) {
  if (!Array.isArray(values)) return []
  const points = values.map(parsePoint).filter(Boolean)
  return points.length >= 2 ? [points] : []
}
