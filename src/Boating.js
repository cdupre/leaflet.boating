import { createMotionSmoother } from './utils.js'
import { Legend } from './Legend.js'
import { Boat } from './Boat.js'

export function Boating(map, options) {
  if (map.boating) {
    return map.boating
  }

  options = {
    ...{
      motionCacheLength: 4,
      motionCacheMaxAge: 10000,
      onLocationError(e) {
        console.error(e)
      },
    },
    ...options,
  }

  const boat = new Boat(options.boat)
  const legend = new Legend(options.legend)
  const motionSmoother = createMotionSmoother(
    options.motionCacheLength,
    options.motionCacheMaxAge,
  )

  let state
  let lastPosition
  let savedZoomOptions

  function setState(newState) {
    state = newState
    map.fire('boating:statechange', {state})
  }

  function start() {
    map.on('dragstart', onDragStart)
    map.on('locationfound', onLocationFound)
    map.on('locationerror', onLocationError)
    map.locate({ watch: true, enableHighAccuracy: true })
    motionSmoother.clear()
    lastPosition = null
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
    restoreZoomInteractions()
    setState('idle')
  }

  function onDragStart() {
    if (state === 'following') {
      unfollow()
    }
  }

  function follow() {
    centerZoomInteractions()
    setState('following')
  }

  function unfollow() {
    restoreZoomInteractions()
    setState('locating')
  }

  function onLocationFound(e) {
    if (lastPosition) {
      if (lastPosition.timestamp === e.timestamp) {
        return
      }
    }

    const { heading, speed } = motionSmoother.add(e)
    const eSmoothed =  { ...e, heading, speed }

    if (state === 'requesting') {
      map.addControl(legend)
      map.addLayer(boat)
      follow()
    }
    if (state === 'following') {
      map.panTo(eSmoothed.latlng)
    }
    legend.update(eSmoothed)
    boat.update(eSmoothed)
    lastPosition = eSmoothed
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
      map.panTo(lastPosition.latlng)
      follow()
    }
  }

  setState('idle')

  map.boating = {
    stop,
    trigger,
    get state() {
      return state
    },
  }

  return map.boating
}
