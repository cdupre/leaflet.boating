import { createMotionSmoother } from './motionSmoother.js'
import { createMotionAnimator } from './motionAnimator.js'
import { Legend } from './Legend.js'
import { Boat } from './Boat.js'

const defaultOptions = {
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
  const motionSmoother = createMotionSmoother(options.smoothing)
  const motionAnimator = createMotionAnimator(options.animation)

  let lastFrame
  let lastTimestamp
  let savedZoomOptions
  let state = 'idle'

  function setState(newState) {
    state = newState
    map.fire('boating:statechange', {state})
  }

  function start() {
    map.on('moveend', onMoveEnd)
    map.on('zoomend', onZoomEnd)
    map.on('dragstart', onDragStart)
    map.on('locationfound', onLocationFound)
    map.on('locationerror', onLocationError)
    map.locate({ watch: true, enableHighAccuracy: true })
    saveZoomInteractions()
    setState('requesting')
  }

  function stop() {
    map.stopLocate()
    map.off('moveend', onMoveEnd)
    map.off('zoomend', onZoomEnd)
    map.off('dragstart', onDragStart)
    map.off('locationfound', onLocationFound)
    map.off('locationerror', onLocationError)
    map.removeControl(legend)
    map.removeLayer(boat)
    motionAnimator.reset()
    motionSmoother.reset()
    restoreZoomInteractions()
    setState('idle')
    lastFrame = null
    lastTimestamp = null
  }

  function follow() {
    map.panTo(lastFrame.latlng)
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

  function onZoomEnd() {
    if (state === 'following') {
      boat.update(lastFrame)
    }
  }

  function onMoveEnd() {
    if (state !== 'following' && lastFrame) {
      boat.update(lastFrame)
    }
  }

  function onLocationFound(e) {
    if (lastTimestamp && e.timestamp <= lastTimestamp) {
      return
    }

    lastTimestamp = e.timestamp

    if (state === 'requesting') {
      map.addControl(legend)
      map.addLayer(boat)
    }

    const eSmoothed = motionSmoother.add(e)
    legend.update(eSmoothed)

    motionAnimator.start(eSmoothed, function(frame) {
      if (state === 'following') {
        map.panTo(frame.latlng, { animate: false })
      }
      boat.update(frame)
      lastFrame = frame
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
