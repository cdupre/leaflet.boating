import { LatLng } from 'leaflet'
import { lerp, lerpDeg } from './utils.js'

const defaultOptions = {
  enabled: true,
  frameInterval: 33,
  maxDuration: 3000,
}

export function createMotionAnimator(options) {

  options = {
    ...defaultOptions,
    ...options,
  }

  let frame
  let raf

  function start(e, cb) {
    cancelAnimationFrame(raf)

    if (
      !frame ||
      !options.enabled ||
      e.timestamp - frame.timestamp <= 0 ||
      e.timestamp - frame.timestamp > options.maxDuration
    ) {
      frame = e
      cb(frame)
      return
    }

    const from = frame
    const to = e
    const startTime = performance.now()
    const duration = to.timestamp - from.timestamp
    let last = -Infinity

    function step(now) {
      const t = Math.min((now - startTime) / duration, 1)

      if (t === 1 || now - last >= options.frameInterval) {
        last = now
        frame = {
          ...to,
          latlng: new LatLng(
            lerp(from.latlng.lat, to.latlng.lat, t),
            lerp(from.latlng.lng, to.latlng.lng, t),
          ),
          speed: lerp(from.speed, to.speed, t),
          accuracy: lerp(from.accuracy, to.accuracy, t),
          heading: lerpDeg(from.heading, to.heading, t),
        }
        cb(frame)
      }

      if (t < 1) raf = requestAnimationFrame(step)
    }

    step(startTime)
  }

  function reset() {
    cancelAnimationFrame(raf)
    frame = null
    raf = null
  }

  return { start, reset }
}
