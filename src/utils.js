export function isNb(n) {
  return Number.isFinite(n)
}

export function cosDeg(d) {
  return Math.cos(d * Math.PI / 180)
}

export function sinDeg(d) {
  return Math.sin(d * Math.PI / 180)
}

export function atan2Deg(y, x) {
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360
}

export function latlngDMS(e) {
  function dms(coord) {
    let float = Math.abs(coord)
    let d = Math.floor(float)
    float = (float - d) * 60
    let m = Math.floor(float)
    float = (float - m) * 60
    let s = Math.round(float)
    if (s === 60) {
      m = m + 1
      s = 0
    }
    if (m === 60) {
      d = d + 1
      m = 0
    }
    if (s < 10) {
      s = '0' + s
    }
    if (m < 10) {
      m = '0' + m
    }
    return d + '° ' + m + '\' ' + s + '" '
  }
  return {
    lat: dms(e.latlng.lat) + ((e.latlng.lat < 0) ? 'S' : 'N'),
    lng: dms(e.latlng.lng) + ((e.latlng.lng < 0) ? 'W' : 'E'),
  }
}

export function createMotionSmoother(cacheLength, cacheMaxAge) {
  const cache = []

  function clear() {
    cache.length = 0
  }

  function add(e) {
    if (isNb(e.speed) && isNb(e.heading)) {
      cache.push(e)
    }
    while (cache[0] && ((e.timestamp - cache[0].timestamp) > cacheMaxAge)) {
      cache.shift()
    }
    if (cache.length > cacheLength) {
      cache.shift()
    }
    if (cache.length === 0) {
      return { speed: null, heading: null }
    }
    const sumX = cache.reduce(
      (sum, e) => sum + e.speed * cosDeg(e.heading), 0
    )
    const sumY = cache.reduce(
      (sum, e) => sum + e.speed * sinDeg(e.heading), 0
    )
    return {
      heading: atan2Deg(sumY, sumX),
      speed: Math.sqrt(sumX ** 2 + sumY ** 2) / cache.length,
    }
  }

  return { clear, add }
}
