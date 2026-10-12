import { isNb, sinDeg, cosDeg, atan2Deg } from './utils.js'

export function createMotionSmoother(tau) {
  let ts = null
  let vx = null
  let vy = null

  function reset() {
    ts = vx = vy = null
  }

  function add(e) {
    let newVx = 0
    let newVy = 0

    if (isNb(e.speed) && isNb(e.heading)) {
      newVx = e.speed * sinDeg(e.heading)
      newVy = e.speed * cosDeg(e.heading)
    }

    if (!isNb(ts) || !(tau > 0)) {
      vx = newVx
      vy = newVy
      ts = e.timestamp
    }
    else if (e.timestamp > ts) {
      const dt = e.timestamp - ts
      const alpha = 1 - Math.exp(-dt / tau)
      vx = alpha * newVx + (1 - alpha) * vx
      vy = alpha * newVy + (1 - alpha) * vy
      ts = e.timestamp
    }

    return {
      ...e,
      heading: atan2Deg(vx, vy),
      speed: Math.hypot(vx, vy),
    }
  }

  return { reset, add }
}
