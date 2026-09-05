export default function createPlugin(L) {

  function isNb(n) {
    return Number.isFinite(n)
  }

  function cosD(deg) {
    return Math.cos(deg * Math.PI / 180)
  }

  function sinD(deg) {
    return Math.sin(deg * Math.PI / 180)
  }

  function atan2D(y, x) {
    return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360
  }

  function latlngDMS(e) {
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
      lat: dms(e.latlng.lat) + ((e.latlng.lat < 0) ? 'S' : 'N'),
      lng: dms(e.latlng.lng) + ((e.latlng.lng < 0) ? 'W' : 'E'),
    }
  }

  function createMotionSmoother(cacheLength) {
    const cache = []

    function init() {
      cache.length = 0
    }

    function add(e) {
      if (isNb(e.speed) && isNb(e.heading)) {
        cache.push(e)
      }
      if (cache.length > cacheLength) {
        cache.shift()
      }
      if (cache.length === 0) {
        return { speed: null, heading: null }
      }
      const sumX = cache.reduce(
        (sum, e) => sum + e.speed * cosD(e.heading), 0
      )
      const sumY = cache.reduce(
        (sum, e) => sum + e.speed * sinD(e.heading), 0
      )
      return {
        speed: Math.sqrt(sumX ** 2 + sumY ** 2) / cache.length,
        heading: atan2D(sumY, sumX),
      }
    }

    return { init, add }
  }

  const { Control, DomUtil, DomEvent, Marker, DivIcon, Circle, Polyline, LatLng, Util } = L

  return Control.extend({

    options: {
      position: 'topleft',
      boatColor: '#3388ff',
      circleColor: '#3388ff',
      lineColor1: '#ffcc00',
      lineColor2: '#3388ff',
      motionCacheLength: 4,
      legendPosition: 'bottomright',
      legendHTML: `
        <table>
          <tbody>
            <tr><td colspan="2" class="double">{heading} &deg;</td></tr>
            <tr><td colspan="2" class="double">{speed} kts</td></tr>
            <tr><th>lat</th><td>{lat}</td></tr>
            <tr><th>lng</th><td>{lng}</td></tr>
            <tr>
              <td colspan="2">
                <div class="line one"></div><div class="line two"></div>
                <div class="hours"><div>0</div><div>1h</div><div>2h</div></div>
              </td>
            </tr>
          </tbody>
        </table>
      `,
      legendCSS: `
        :scope {
          padding: 5px 8px;
          background: white;
        }
        th {
          font-weight: normal;
          color: rgb(0, 0, 0, .7);
        }
        td {
          text-align: center;
        }
        td.double {
          font-size: large;
        }
        td div.line {
          width: 50%;
          float: left;
          height: 3px;
          margin-top: 4px;
        }
        td div.line.one {
          background: #ffcc00;
        }
        td div.line.two {
          background: #3388ff;
        }
        td div.hours {
          width: 100%;
          float: left;
          display: flex;
          justify-content: space-between;
        }
      `,
    },

    initialize: function (options) {
      Util.setOptions(this, options)

      this._legend = new Control({
        position: this.options.legendPosition,
        css: this.options.legendCSS,
      })
      this._legend.onAdd = function (map) {
        const container = DomUtil.create('div', 'leaflet-control leaflet-bar leaflet-control-boating-legend')
        container.innerHTML = `
          <style>
            @scope (.leaflet-control-boating-legend) {
              ${this.options.css}
            }
          </style>`
        this.body = DomUtil.create('div', '', container)
        return container
      }

      this._boat = new Marker([0, 0], {
        icon: new DivIcon({
          iconAnchor: [12.5, 12.5],
          iconSize: [25, 25],
          className: 'boat',
          html: `
            <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" class="boat-svg">
              <path d="M 128 512 C 128 512 128 128 256 0 C 384 128 384 512 384 512 Z" fill="${this.options.boatColor}"/>
            </svg>`,
        })
      })
      this._boat.on('add', function() {
        this._svg = this.getElement().querySelector('.boat-svg')
      })

      this._circle = new Circle([0, 0], {
        color: this.options.circleColor,
        stroke: false,
      })

      this._line = new Polyline([[0, 0], [0, 0]], {
        color: this.options.lineColor2,
        lineCap: 'square',
      })

      this._linebg = new Polyline([[0, 0], [0, 0]], {
        color: this.options.lineColor1,
      })

      this._motionSmoother = createMotionSmoother(this.options.motionCacheLength)
    },

    onAdd: function (map) {
      const container = DomUtil.create('div', 'leaflet-bar leaflet-control')
      const link = DomUtil.create('a', 'leaflet-bar-part leaflet-bar-part-single', container)
      this._icon = DomUtil.create('span', 'leaflet-control-boating', link)
      link.setAttribute('aria-label', 'Boating Control')
      link.setAttribute('role', 'button')
      link.href = '#'

      DomEvent.disableClickPropagation(container)

      DomEvent.on(link, 'click', function (e) {
        DomEvent.stopPropagation(e)
        DomEvent.preventDefault(e)
        this._onClick()
      }, this)

      this._setState('idle')

      return container
    },

    onRemove: function() {
      this.stop()
    },

    _start: function () {
      this._map.on('moveend', this._onMoveEnd, this)
      this._map.on('dragstart', this._onDragStart, this)
      this._map.on('locationfound', this._onLocationFound, this)
      this._map.on('locationerror', this._onLocationError, this)
      this._map.locate({ watch: true, enableHighAccuracy: true })
      this._motionSmoother.init()
      this._lastPosition = null
      this._saveZoomOptions()
      this._setState('requesting')
    },

    stop: function () {
      if (!this._map) return
      this._map.stopLocate()
      this._map.off('moveend', this._onMoveEnd, this)
      this._map.off('dragstart', this._onDragStart, this)
      this._map.off('locationfound', this._onLocationFound, this)
      this._map.off('locationerror', this._onLocationError, this)
      this._map.removeControl(this._legend)
      this._map.removeLayer(this._circle)
      this._map.removeLayer(this._linebg)
      this._map.removeLayer(this._line)
      this._map.removeLayer(this._boat)
      this._restoreZoomOptions()
      this._setState('idle')
    },

    _setState: function (state) {
      this._state = state
      if (this._icon) {
        this._icon.classList.remove('idle', 'requesting', 'following', 'locating')
        this._icon.classList.add(state)
      }
    },

    _onClick: function () {
      if (this._state === 'idle') {
        this._start()
      }
      else if (this._state === 'requesting') {
        this.stop()
      }
      else if (this._state === 'following') {
        this.stop()
      }
      else if (this._state === 'locating') {
        this._map.panTo(this._lastPosition.latlng)
        this._follow()
      }
    },

    _onDragStart: function () {
      if (this._state === 'following') {
        this._unfollow()
      }
    },

    _onMoveEnd: function () {
      if ((this._state === 'locating' || this._state === 'following') && this._lastPosition) {
        this._updateLine(this._lastPosition)
      }
    },

    _follow: function () {
      this._map.options.touchZoom = 'center'
      this._map.options.scrollWheelZoom = 'center'
      this._map.options.doubleClickZoom = 'center'
      this._setState('following')
    },

    _unfollow: function () {
      this._restoreZoomOptions()
      this._setState('locating')
    },

    _onLocationFound: function (e) {
      if (this._lastPosition) {
        if (this._lastPosition.latlng.equals(e.latlng)) {
          if (this._lastPosition.accuracy === e.accuracy) {
            return
          }
        }
      }

      e.latlngDMS = latlngDMS(e)
      e.smooth = this._motionSmoother.add(e)

      if (this._state === 'requesting') {
        this._map.addControl(this._legend)
        this._map.addLayer(this._circle)
        this._map.addLayer(this._linebg)
        this._map.addLayer(this._line)
        this._map.addLayer(this._boat)
        this._follow()
      }
      if (this._state === 'following') {
        this._map.panTo(e.latlng)
      }
      this._updateLegend(e)
      this._updateCircle(e)
      this._updateLine(e)
      this._updateBoat(e)
      this._lastPosition = e
    },

    _onLocationError: function (e) {
      this.onLocationError(e)
    },

    // public method with default behaviour
    onLocationError: function (e) {
      console.error(e)
      if (e.code === 1) {
        alert('unlock geolocation please')
        this.stop()
      }
    },

    _updateCircle: function (e) {
      this._circle.setLatLng(e.latlng)
      this._circle.setRadius(e.accuracy)
    },

    _updateBoat: function (e) {
      const heading = e.smooth.heading
      this._boat._svg.style.transform = 'rotate(' + heading + 'deg)'
      this._boat.setLatLng(e.latlng)
    },

    _updateLine: function (e) {
      const zoom = this._map.getZoom()
      const mapBounds = this._map.getBounds()
      const heading = e.smooth.heading
      const speed = e.smooth.speed

      const length = Math.max(
        mapBounds.getNorthWest().distanceTo(e.latlng),
        mapBounds.getNorthEast().distanceTo(e.latlng),
        mapBounds.getSouthEast().distanceTo(e.latlng),
        mapBounds.getSouthWest().distanceTo(e.latlng),
      )
      const lengthDeg = length * 360 / 40000000
      const dirPoint = new LatLng(
        e.latlng.lat + (lengthDeg * cosD(heading)),
        e.latlng.lng + (lengthDeg * sinD(heading) / cosD(e.latlng.lat)),
      )

      this._line.setLatLngs([e.latlng, dirPoint])
      this._linebg.setLatLngs([e.latlng, dirPoint])

      const metersPerPixel = 40000000 * cosD(e.latlng.lat) / (256 * Math.pow(2, zoom))
      const pixelsPerHour = speed / metersPerPixel * 3600

      this._line.setStyle({
        dashArray: pixelsPerHour + ',' + pixelsPerHour,
        dashOffset: pixelsPerHour,
      })
    },

    _updateLegend: function (e) {
      const nautic = 40000 / 360 / 60
      const heading = e.smooth.heading
      const speed = e.smooth.speed

      this._legend.body.innerHTML = Util.template(
        this.options.legendHTML, {
          lat: e.latlngDMS.lat,
          lng: e.latlngDMS.lng,
          heading: isNb(heading) ? Math.round(heading) : '--',
          speed: isNb(speed) ? Math.round(speed * 36 / nautic) / 10 : '--',
        }
      )
    },

    _saveZoomOptions: function () {
      this._savedZoomOptions = {
        touchZoom: this._map.options.touchZoom,
        scrollWheelZoom: this._map.options.scrollWheelZoom,
        doubleClickZoom: this._map.options.doubleClickZoom,
      }
    },

    _restoreZoomOptions: function () {
      if (this._savedZoomOptions) {
        this._map.options.touchZoom = this._savedZoomOptions.touchZoom
        this._map.options.scrollWheelZoom = this._savedZoomOptions.scrollWheelZoom
        this._map.options.doubleClickZoom = this._savedZoomOptions.doubleClickZoom
      }
    },
  })
}
