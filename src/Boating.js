import { createMotionSmoother } from './motionSmoother.js'
import { createMotionAnimator } from './motionAnimator.js'
import { Legend } from './Legend.js'
import { Boat } from './Boat.js'

const defaultOptions = {
  smoothingTimeConstant: 2000,
  animationFrameInterval: 100,
  onLocationError(e) {
    console.error(e)
  },
}

export function Boating(map, options) {
  if (map.boating) {
    return map.boating
  }

  options = {
    ...defaultOptions,
    ...options,
  }

  const boat = new Boat(options.boat)
  const legend = new Legend(options.legend)
  const motionSmoother = createMotionSmoother(options.smoothingTimeConstant)
  const motionAnimator = createMotionAnimator(options.animationFrameInterval)

  let eLast
  let savedZoomOptions
  let state = 'idle'

  function setState(newState) {
    state = newState
    map.fire('boating:statechange', {state})
  }

  function start() {
    map.on('dragstart', onDragStart)
    map.on('locationfound', onLocationFound)
    map.on('locationerror', onLocationError)
    map.locate({ watch: true, enableHighAccuracy: true })
    saveZoomInteractions()
    setState('requesting')
  }

  function stop() {
    map.stopLocate()
    map.off('dragstart', onDragStart)
    map.off('locationfound', onLocationFound)
    map.off('locationerror', onLocationError)
    map.removeControl(legend)
    map.removeLayer(boat)
    motionAnimator.reset()
    motionSmoother.reset()
    restoreZoomInteractions()
    setState('idle')
  }

  function follow() {
    map.panTo(eLast.latlng)
    centerZoomInteractions()
    setState('following')
  }

  function unfollow() {
    restoreZoomInteractions()
    setState('locating')
  }

  function trigger() {
    if (state === 'idle') {
      start()
    }
    else if (state === 'requesting') {
      stop()
    }
    else if (state === 'following') {
      stop()
    }
    else if (state === 'locating') {
      follow()
    }
  }

  function onDragStart() {
    if (state === 'following') {
      unfollow()
    }
  }

  function onLocationFound(e) {
    if (eLast) {
      if (e.timestamp <= eLast.timestamp) {
        return
      }
    }

    eLast = e

    if (state === 'requesting') {
      map.addControl(legend)
      map.addLayer(boat)
    }

    const eSmoothed = motionSmoother.add(e)
    legend.update(eSmoothed)

    motionAnimator.start(eSmoothed, function(frame) {
      boat.update(frame)

      if (state === 'following') {
        map.panTo(frame.latlng, { animate: false })
      }
    })

    if (state === 'requesting') {
      follow()
    }
  }

  function onLocationError(e) {
    if (e.code === 1) stop()
    options.onLocationError(e)
  }

  function saveZoomInteractions() {
    savedZoomOptions = {
      touchZoom: map.options.touchZoom,
      scrollWheelZoom: map.options.scrollWheelZoom,
      doubleClickZoom: map.options.doubleClickZoom,
    }
  }

  function centerZoomInteractions() {
    map.options.touchZoom = 'center'
    map.options.scrollWheelZoom = 'center'
    map.options.doubleClickZoom = 'center'
  }

  function restoreZoomInteractions() {
    if (savedZoomOptions) {
      map.options.touchZoom = savedZoomOptions.touchZoom
      map.options.scrollWheelZoom = savedZoomOptions.scrollWheelZoom
      map.options.doubleClickZoom = savedZoomOptions.doubleClickZoom
    }
  }

  map.boating = {
    stop,
    trigger,
    get state() {
      return state
    },
  }

  return map.boating
}
