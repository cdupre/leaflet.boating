function cosDeg(deg) {
  return Math.cos(deg * Math.PI / 180)
}

function sinDeg(deg) {
  return Math.sin(deg * Math.PI / 180)
}

function atan2Deg(x, y) {
  return ((Math.atan2(x, y) * 180 / Math.PI) + 360) % 360
}

L.Control.Boating = L.Control.extend({

  options: {
    position: 'topleft',
    legendPosition: 'bottomright',
  },

  onAdd: function (map) {
    const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control')
    const link = L.DomUtil.create('a', 'leaflet-bar-part leaflet-bar-part-single', container)
    this.icon = L.DomUtil.create('span', 'leaflet-control-boating-arrow', link)
    link.href = '#'

    L.DomEvent.on(link, 'click', function (e) {
      L.DomEvent.stopPropagation(e)
      L.DomEvent.preventDefault(e)
      this.onClick()
    }, this)

    this.legend = L.control({ position: this.options.legendPosition })
    this.legend.onAdd = function (map) {
      const container = L.DomUtil.create('div', 'leaflet-control leaflet-bar leaflet-control-boating-legend')
      container.innerHTML = `
        <table>
          <tbody>
            <tr><td colspan="2" class="double" id="heading"></td></tr>
            <tr><td colspan="2" class="double" id="knots"></td></tr>
            <tr><th>lat</th><td id="lat"></td></tr>
            <tr><th>lon</th><td id="lng"></td></tr>
            <tr>
              <td colspan="2">
                <div class="gold"></div><div class="blue"></div>
                <div class="hours"><div>0</div><div>1h</div><div>2h</div></div>
              </td>
            </tr>
          </tbody>
        </table>`
      this.heading = container.querySelector('#heading')
      this.knots = container.querySelector('#knots')
      this.lat = container.querySelector('#lat')
      this.lng = container.querySelector('#lng')
      return container
    }

    this.boat = L.marker([0, 0], {
      icon: L.divIcon({
        iconAnchor: [12.5, 12.5],
        iconSize: [25, 25],
        className: 'boat',
        html: `
          <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" id="boat-svg">
            <path d="M 128 512 C 128 512 128 128 256 0 C 384 128 384 512 384 512 Z" fill="#3388ff"/>
          </svg>`,
      })
    })
    this.boat.on('add', function() {
      this.svg = this.getElement().querySelector('#boat-svg')
    })

    this.circle = L.circle([0, 0], {
      stroke: false,
    })

    this.line = L.polyline([[0, 0], [0, 0]], {
      lineCap: 'square',
    })

    this.linebg = L.polyline([[0, 0], [0, 0]], {
      color: 'gold',
    })

    return container
  },

  isRequesting: function () {
    return this.icon.classList.contains('requesting')
  },

  isLocating: function () {
    return this.icon.classList.contains('locating')
  },

  isFollowing: function () {
    return this.icon.classList.contains('following')
  },

  onClick: function () {
    if (this.isFollowing()) {
      this.stop()
    }
    else if (this.isLocating()) {
      this._map.panTo(this.lastPosition.latlng)
      this.follow()
    }
    else if (!this.isRequesting()) {
      this.request()
    }
  },

  onDragStart: function () {
    if (this.isFollowing()) {
      this.unfollow()
    }
  },

  onMoveEnd: function () {
    if ((this.isLocating() || this.isFollowing()) && this.lastPosition) {
      this.updateLine(this.lastPosition)
    }
  },

  request: function () {
    this._map.on('moveend', this.onMoveEnd, this)
    this._map.on('dragstart', this.onDragStart, this)
    this._map.on('locationfound', this.onLocationFound, this)
    this._map.on('locationerror', this.onLocationError, this)
    this._map.locate({ watch: true, enableHighAccuracy: true })
    this.icon.classList.remove('following')
    this.icon.classList.remove('locating')
    this.icon.classList.add('requesting')
  },

  follow: function () {
    this._map.options.scrollWheelZoom = 'center'
    this._map.options.doubleClickZoom = 'center'
    this.icon.classList.remove('requesting')
    this.icon.classList.remove('locating')
    this.icon.classList.add('following')
  },

  unfollow: function () {
    this._map.options.scrollWheelZoom = true
    this._map.options.doubleClickZoom = true
    this.icon.classList.remove('requesting')
    this.icon.classList.remove('following')
    this.icon.classList.add('locating')
  },

  stop: function () {
    this._map.stopLocate()
    this._map.off('moveend', this.onMoveEnd, this)
    this._map.off('dragstart', this.onDragStart, this)
    this._map.off('locationfound', this.onLocationFound, this)
    this._map.off('locationerror', this.onLocationError, this)
    this._map.options.scrollWheelZoom = true
    this._map.options.doubleClickZoom = true
    this.icon.classList.remove('requesting')
    this.icon.classList.remove('following')
    this.icon.classList.remove('locating')
    this._map.removeControl(this.legend)
    this._map.removeLayer(this.circle)
    this._map.removeLayer(this.linebg)
    this._map.removeLayer(this.line)
    this._map.removeLayer(this.boat)
  },

  onLocationFound: function (e) {
    e.latlngDMS = this.latlngDMS(e)
    e.averageMotion = this.averageMotion(e)

    if (this.isRequesting()) {
      this._map.addControl(this.legend)
      this._map.addLayer(this.circle)
      this._map.addLayer(this.linebg)
      this._map.addLayer(this.line)
      this._map.addLayer(this.boat)
      this.follow()
    }
    if (this.isFollowing()) {
      this._map.panTo(e.latlng)
    }
    this.updateLegend(e)
    this.updateCircle(e)
    this.updateLine(e)
    this.updateBoat(e)
    this.lastPosition = e
  },

  onLocationError: function (e) {
    console.error(e)
    if (e.code === 1) {
      alert('unlock geolocation please')
      this.stop()
    }
  },

  updateCircle: function (e) {
    this.circle.setLatLng(e.latlng)
    this.circle.setRadius(e.accuracy)
  },

  updateBoat: function (e) {
    const heading = e.averageMotion.heading
    this.boat.svg.style.transform = 'rotate(' + heading + 'deg)'
    this.boat.setLatLng(e.latlng)
  },

  updateLine: function (e) {
    const zoom = this._map.getZoom()
    const mapBounds = this._map.getBounds()
    const heading = e.averageMotion.heading
    const speed = e.averageMotion.speed

    const length = Math.max(
      mapBounds.getNorthWest().distanceTo(e.latlng),
      mapBounds.getNorthEast().distanceTo(e.latlng),
      mapBounds.getSouthEast().distanceTo(e.latlng),
      mapBounds.getSouthWest().distanceTo(e.latlng),
    )
    const lengthDeg = length * 360 / 40000000
    const dirPoint = L.latLng(
      e.latlng.lat + (lengthDeg * cosDeg(heading)),
      e.latlng.lng + (lengthDeg * sinDeg(heading) / cosDeg(e.latlng.lat)),
    )
    this.line.setLatLngs([e.latlng, dirPoint])
    this.linebg.setLatLngs([e.latlng, dirPoint])

    const metersPerPixel = 40000000 * cosDeg(e.latlng.lat) / (256 * Math.pow(2, zoom))
    const pixelsPerHour = speed / metersPerPixel * 3600
    this.line.setStyle({
      dashArray: pixelsPerHour + ',' + pixelsPerHour,
      dashOffset: pixelsPerHour,
    })
  },

  updateLegend: function (e) {
    const nautic = 40000 / 360 / 60
    const heading = Math.round(e.averageMotion.heading)
    const speed = Math.round(e.averageMotion.speed * 36 / nautic) / 10
    this.legend.heading.innerHTML = heading + ' °'
    this.legend.knots.innerHTML = speed + ' kts'
    this.legend.lat.innerHTML = e.latlngDMS.lat
    this.legend.lng.innerHTML = e.latlngDMS.lng
  },

  latlngDMS: function (e) {
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
      return d + '&deg; ' + m + '&apos; ' + s + '&quot; '
    }
    return {
      lat: dms(e.latlng.lat) + ((e.latlng.lat > 0) ? 'N' : 'S'),
      lng: dms(e.latlng.lng) + ((e.latlng.lng > 0) ? 'E' : 'W'),
    }
  },

  averageMotion: (function () {
    const nb = 3
    const cache = []
    return function(e) {
      cache.push(e)
      if (cache.length > nb) {
        cache.shift()
      }
      const sumX = cache.reduce(
        (sum, e) => sum + (e.speed || 0) * cosDeg(e.heading || 0), 0
      )
      const sumY = cache.reduce(
        (sum, e) => sum + (e.speed || 0) * sinDeg(e.heading || 0), 0
      )
      return {
        speed: Math.sqrt(sumX ** 2 + sumY ** 2) / cache.length,
        heading: atan2Deg(sumY, sumX),
      }
    }
  })(),
})

L.control.boating = function (options) {
  return new L.Control.Boating(options)
}
