import { LatLng } from 'leaflet'
import { lerp, lerpDeg } from './utils.js'

export function createMotionAnimator(interval) {
  let timer
  let frame

  function start(e, cb) {
    clearInterval(timer)

    if (!frame || e.timestamp <= frame.timestamp || !(interval > 0)) {
      frame = e
      cb(frame)
      return
    }

    const from = frame
    const to = e
    const startTime = performance.now()
    const duration = to.timestamp - from.timestamp

    function step() {
      const t = Math.min((performance.now() - startTime) / duration, 1)
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
      if (t >= 1) clearInterval(timer)
    }

    step()
    timer = setInterval(step, interval)
  }

  function reset() {
    clearInterval(timer)
    timer = null
    frame = null
  }

  return { start, reset }
}
