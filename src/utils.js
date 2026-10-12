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

export function lerp(a, b, t) {
  return a + (b - a) * t
}

export function lerpDeg(a, b, t) {
  const d = ((b - a + 540) % 360) - 180
  return (a + d * t + 360) % 360
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
