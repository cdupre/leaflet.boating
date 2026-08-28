export default function createPlugin(L) {

  const { Control, DomUtil, DomEvent, Marker, DivIcon, Circle, Polyline, LatLng } = L

  return Control.extend({

    options: {
      position: 'topleft',
      legendPosition: 'bottomright',
      boatColor: '#3388ff',
      lineColor1: '#ffcc00',
      lineColor2: '#3388ff',
      circleColor: '#3388ff',
      cacheLength: 4,
    },

    onAdd: function (map) {
      const container = DomUtil.create('div', 'leaflet-bar leaflet-control')
      const link = DomUtil.create('a', 'leaflet-bar-part leaflet-bar-part-single', container)
      this.icon = DomUtil.create('span', 'leaflet-control-boating-arrow', link)
      link.href = '#'

      DomEvent.on(link, 'click', function (e) {
        DomEvent.stopPropagation(e)
        DomEvent.preventDefault(e)
        this.onClick()
      }, this)

      this.legend = new Control({
        position: this.options.legendPosition,
        lineColor1: this.options.lineColor1,
        lineColor2: this.options.lineColor2
      })
      this.legend.onAdd = function (map) {
        const container = DomUtil.create('div', 'leaflet-control leaflet-bar leaflet-control-boating-legend')
        container.innerHTML = `
          <table>
            <tbody>
              <tr><td colspan="2" class="double" id="heading"></td></tr>
              <tr><td colspan="2" class="double" id="knots"></td></tr>
              <tr><th>lat</th><td id="lat"></td></tr>
              <tr><th>lon</th><td id="lng"></td></tr>
              <tr>
                <td colspan="2">
                  <div class="line" style="background-color: ${this.options.lineColor1}"></div>
                  <div class="line" style="background-color: ${this.options.lineColor2}"></div>
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

      this.boat = new Marker([0, 0], {
        icon: new DivIcon({
          iconAnchor: [12.5, 12.5],
          iconSize: [25, 25],
          className: 'boat',
          html: `
            <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" id="boat-svg">
              <path d="M 128 512 C 128 512 128 128 256 0 C 384 128 384 512 384 512 Z" fill="${this.options.boatColor}"/>
            </svg>`,
        })
      })
      this.boat.on('add', function() {
        this.svg = this.getElement().querySelector('#boat-svg')
      })

      this.circle = new Circle([0, 0], {
        color: this.options.circleColor,
        stroke: false,
      })

      this.line = new Polyline([[0, 0], [0, 0]], {
        color: this.options.lineColor2,
        lineCap: 'square',
      })

      this.linebg = new Polyline([[0, 0], [0, 0]], {
        color: this.options.lineColor1,
      })

      return container
    },

    cosD: function (deg) {
      return Math.cos(deg * Math.PI / 180)
    },

    sinD: function (deg) {
      return Math.sin(deg * Math.PI / 180)
    },

    atan2D: function (x, y) {
      return ((Math.atan2(x, y) * 180 / Math.PI) + 360) % 360
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
      e.smooth = this.smoothMotion(e)

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
      const heading = e.smooth.heading
      this.boat.svg.style.transform = 'rotate(' + heading + 'deg)'
      this.boat.setLatLng(e.latlng)
    },

    updateLine: function (e) {
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
        e.latlng.lat + (lengthDeg * this.cosD(heading)),
        e.latlng.lng + (lengthDeg * this.sinD(heading) / this.cosD(e.latlng.lat)),
      )
      this.line.setLatLngs([e.latlng, dirPoint])
      this.linebg.setLatLngs([e.latlng, dirPoint])

      const metersPerPixel = 40000000 * this.cosD(e.latlng.lat) / (256 * Math.pow(2, zoom))
      const pixelsPerHour = speed / metersPerPixel * 3600
      this.line.setStyle({
        dashArray: pixelsPerHour + ',' + pixelsPerHour,
        dashOffset: pixelsPerHour,
      })
    },

    updateLegend: function (e) {
      const nautic = 40000 / 360 / 60
      const heading = Math.round(e.smooth.heading)
      const speed = Math.round(e.smooth.speed * 36 / nautic) / 10
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

    smoothMotion: (function () {
      const cache = []
      return function(e) {
        cache.push(e)
        if (cache.length > this.options.cacheLength) {
          cache.shift()
        }
        const sumX = cache.reduce(
          (sum, e) => sum + (e.speed || 0) * this.cosD(e.heading || 0), 0
        )
        const sumY = cache.reduce(
          (sum, e) => sum + (e.speed || 0) * this.sinD(e.heading || 0), 0
        )
        return {
          speed: Math.sqrt(sumX ** 2 + sumY ** 2) / cache.length,
          heading: this.atan2D(sumY, sumX),
        }
      }
    })(),
  })
}
