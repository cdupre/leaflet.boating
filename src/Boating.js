import { createMotionAnimator } from './MotionAnimator.js'
import { createMotionSmoother } from './utils.js'
import { Legend } from './Legend.js'
import { Boat } from './Boat.js'

const defaultOptions = {
  smoothingTimeConstant: 2000,
  animation: true,
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
  const motionAnimator = createMotionAnimator()
  const motionSmoother = createMotionSmoother(options.smoothingTimeConstant)

  let eSmoothed
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
    eSmoothed = null
    motionSmoother.reset()
    motionAnimator.reset()
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
    restoreZoomInteractions()
    setState('idle')
  }

  function follow() {
    map.panTo(eSmoothed.latlng)
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
    if (eSmoothed) {
      if (e.timestamp <= eSmoothed.timestamp) {
        return
      }
    }

    eSmoothed = motionSmoother.add(e)

    if (state === 'requesting') {
      map.addControl(legend)
      map.addLayer(boat)
    }

    if (options.animation) {
      legend.update(eSmoothed)
      motionAnimator.start(eSmoothed, function(frame) {
        boat.update(frame)
        if (state === 'following') {
          map.panTo(frame.latlng, { animate: false })
        }
      })
    }
    else {
      boat.update(eSmoothed)
      legend.update(eSmoothed)
      if (state === 'following') {
        map.panTo(eSmoothed.latlng, { animate: false })
      }
    }

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
