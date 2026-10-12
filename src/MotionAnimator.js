import { LatLng } from 'leaflet'
import { lerp, lerpDeg } from './utils.js'

export function createMotionAnimator() {
  let animationFrame
  let frame

  function start(e, cb) {
    cancelAnimationFrame(animationFrame)

    if (!frame || e.timestamp <= frame.timestamp) {
      frame = e
      cb(frame)
      return
    }

    const from = frame
    const to = e
    const startTime = performance.now()
    const duration = to.timestamp - from.timestamp

    function step(now) {
      const t = Math.min((now - startTime) / duration, 1)
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
      if (t < 1) animationFrame = requestAnimationFrame(step)
    }
    step(startTime)
  }

  function reset() {
    cancelAnimationFrame(animationFrame)
    animationFrame = null
    frame = null
  }

  return { start, reset }
}
