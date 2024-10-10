L.toDMS = function (latlng) {
  for (const i of ['lat', 'lng']) {
    let float = Math.abs(latlng[i])
    let d = Math.floor(float)
    float = (float - d) * 60
    let m = Math.floor(float)
    float = (float - m) * 60
    let s = Math.round(float)
    let pol
    if (s === 60) {
      m++
      s = 0
    }
    if (m === 60) {
      d++
      m = 0
    }
    if (s < 10) {
      s = '0' + s
    }
    if (m < 10) {
      m = '0' + m
    }
    if (i === 'lat') {
      pol = (latlng[i] > 0) ? 'N' : 'S'
    }
    if (i === 'lng') {
      pol = (latlng[i] > 0) ? 'W' : 'E'
    }
    latlng[i + 'DMS'] = d + '&deg; ' + m + '\' ' + s + '" ' + pol
  }
  return latlng
}

L.Control.Boating = L.Control.extend({
  options: {
    position: "topleft",
  },
  onAdd(map) {
    const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control')
    const link = L.DomUtil.create('a', 'leaflet-bar-part leaflet-bar-part-single', container)
    link.href = '#'
    link.setAttribute('role', 'button')
    this.icon = L.DomUtil.create('span', 'leaflet-control-boating-arrow', link)

    L.DomEvent.on(
      link,
      'click',
      function (ev) {
        L.DomEvent.stopPropagation(ev)
        L.DomEvent.preventDefault(ev)
        this.onClick()
      },
      this
    ).on(link, 'dblclick', L.DomEvent.stopPropagation)

    this.circle = L.circle([0, 0], {
      stroke: false,
    })

    this.line = L.polyline([[0, 0], [0, 0]], {
      opacity: .4,
    })

    this.boat = L.marker([0, 0])

    this.legend = L.control({position: 'bottomright'})
    this.legend.onAdd = function (map) {
      this.legendContent = L.DomUtil.create('div',
        'leaflet-control leaflet-bar leaflet-control-boating-legend')
      return this.legendContent
    }

    return container
  },

  isRequesting() {
    return this.icon.classList.contains('requesting')
  },

  isLocating() {
    return this.icon.classList.contains('locating')
  },

  isFollowing() {
    return this.icon.classList.contains('following')
  },

  onClick() {
    if (this.isFollowing()) {
      this.stop()
    } else {
      this.follow()
    }
  },

  onDragStart() {
    if (this.isFollowing()) {
      this.unfollow()
    }
  },


  onMoveEnd() {
    if (this.isLocating() || this.isFollowing()) {
      this.lineUpdate()
    }
  },

  follow() {
    if (this.isLocating()) {
      this._map.options.scrollWheelZoom = 'center'
      this._map.options.doubleClickZoom = 'center'
      this._map.panTo(this.lastPosition.latlng)
      this.icon.classList.remove('locating')
      this.icon.classList.add('following')
    } else {
      this._map.on('moveend', this.onMoveEnd, this)
      this._map.on('dragstart', this.onDragStart, this)
      this._map.on('locationfound', this.onLocationFound, this)
      this._map.on('locationerror', this.onLocationError, this)
      this._map.locate({watch: true, enableHighAccuracy: true})
      this.icon.classList.add('requesting')
    }
  },

  unfollow() {
    this._map.options.scrollWheelZoom = true
    this._map.options.doubleClickZoom = true
    this.icon.classList.remove('following')
    this.icon.classList.add('locating')
  },

  stop() {
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
    this._map.removeLayer(this.line)
    this._map.removeLayer(this.boat)
  },

  onLocationFound(e) {
    if (this.isRequesting()) {
      this._map.options.scrollWheelZoom = 'center'
      this._map.options.doubleClickZoom = 'center'
      this.icon.classList.remove('requesting')
      this.icon.classList.add('following')
      this._map.addControl(this.legend)
      this._map.addLayer(this.circle)
      this._map.addLayer(this.line)
      this._map.addLayer(this.boat)
    }
    if (this.isFollowing()) {
      this._map.panTo(e.latlng)
    }
    this.boatUpdate(e)
    this.lineUpdate(e)
    this.legendUpdate(e)
    this.circleUpdate(e)
    this.lastPosition = e
    if (e.heading) {
      this.lastHeading = e.heading
    }
  },

  onLocationError(e) {
    console.error(e)
    if (e.code === 1) {
      alert('unlock geolocation please')
      this.stop()
    }
  },

  circleUpdate(e) {
    this.circle.setRadius(e.accuracy)
    this.circle.setLatLng(e.latlng)
  },

  boatUpdate(e) {
    const heading = e.heading || this.lastHeading || 0
    let html = '<svg transform="rotate(' + heading + ')" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">'
    html += '<path d="M 384 512 128 512 C 128 512 128 128 256 0 C 384 128 384 512 384 512" fill="#3388ff"/>'
    html += '</svg>'
    const icon = L.divIcon({
      html: html,
      className: 'boat',
      iconSize: [25, 25],
      iconAnchor: [12.5, 12.5],
    })
    this.boat.setLatLng(e.latlng)
    this.boat.setIcon(icon)
  },

  lineUpdate(e = this.lastPosition) {
    if (e) {
      const heading = e.heading || this.lastHeading || 0
      const mapBounds = this._map.getBounds()
      const length = Math.max(
        mapBounds.getNorthWest().distanceTo(e.latlng),
        mapBounds.getNorthEast().distanceTo(e.latlng),
        mapBounds.getSouthEast().distanceTo(e.latlng),
        mapBounds.getSouthWest().distanceTo(e.latlng),
      )
      const lengthDeg = length * 360 / 40000000
      const cosDeg = (deg) => Math.cos(deg * Math.PI / 180)
      const sinDeg = (deg) => Math.sin(deg * Math.PI / 180)
      const targetPoint = L.latLng(
        e.latlng.lat + (lengthDeg * cosDeg(heading)),
        e.latlng.lng + (lengthDeg * sinDeg(heading) / cosDeg(e.latlng.lat)),
      )
      this.line.setLatLngs([e.latlng, targetPoint])
    }
  },

  legendUpdate(e) {
    const latlng = L.toDMS(e.latlng)
    const latitude = latlng.latDMS
    const longitude = latlng.lngDMS
    const nautic = 40000 / 360 / 60
    const speed = Math.round(e.speed * 36 / nautic) / 10 || 0
    const heading = Math.round(e.heading) || Math.round(this.lastHeading) || '--'
    let html = '<table><tbody>'
    html += '<tr><td colspan="2" class="double">' + heading + ' °</td></tr>'
    html += '<tr><td colspan="2" class="double">' + speed + ' kts</td></tr>'
    html += '<tr><th>lat</th><td>' + latitude + '</td></tr>'
    html += '<tr><th>lon</th><td>' + longitude + '</td></tr>'
    html += '</tbody></table>'
    this.legend.legendContent.innerHTML = html
  },
})

L.control.boating = function (options) {
  return new L.Control.Boating(options)
}