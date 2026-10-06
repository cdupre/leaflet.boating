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

export function latlngDMS(latlng) {
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
    lat: dms(latlng.lat) + ((latlng.lat < 0) ? 'S' : 'N'),
    lng: dms(latlng.lng) + ((latlng.lng < 0) ? 'W' : 'E'),
  }
}

export function createMotionSmoother(tau) {
  let timestamp = null
  let vx = null
  let vy = null

  function reset() {
    timestamp = vx = vy = null
  }

  function add(e) {
    if (!isNb(e.speed) || !isNb(e.heading)) {
      return { heading: null, speed: null }
    }

    const newVx = e.speed * sinDeg(e.heading)
    const newVy = e.speed * cosDeg(e.heading)

    if (!isNb(timestamp) || !(tau > 0)) {
      vx = newVx
      vy = newVy
    }
    else {
      const dt = Math.max(e.timestamp - timestamp, 0)
      const alpha = 1 - Math.exp(-dt / tau)
      vx = alpha * newVx + (1 - alpha) * vx
      vy = alpha * newVy + (1 - alpha) * vy
    }

    timestamp = e.timestamp

    return {
      heading: atan2Deg(vx, vy),
      speed: Math.hypot(vx, vy),
    }
  }

  return { reset, add }
}
