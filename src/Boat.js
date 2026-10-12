import { LayerGroup, Marker, DivIcon, Circle, Polyline } from 'leaflet'
import { sinDeg, cosDeg } from './utils.js'

const defaultOptions = {
  color: '#3388ff',
  circleColor: '#3388ff',
  lineColor1: '#ffcc00',
  lineColor2: '#3388ff',
}

export class Boat extends LayerGroup {

  constructor(options) {
    super([], {
      ...defaultOptions,
      ...options,
    })

    this._boat = new Marker([0, 0], {
      icon: new DivIcon({
        iconAnchor: [12, 12],
        iconSize: [24, 24],
        className: 'boat',
        html: `
          <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" class="boat-svg">
            <path d="M 128 512 C 128 512 128 128 256 0 C 384 128 384 512 384 512 Z" fill="${this.options.color}"/>
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

    this._line1 = new Polyline([[0, 0], [0, 0]], {
      color: this.options.lineColor1,
    })

    this._line2 = new Polyline([[0, 0], [0, 0]], {
      color: this.options.lineColor2,
      lineCap: 'square',
    })

    this._circle.addTo(this)
    this._line1.addTo(this)
    this._line2.addTo(this)
    this._boat.addTo(this)
  }

  _updateCircle(e) {
    this._circle.setLatLng(e.latlng)
    this._circle.setRadius(e.accuracy)
  }

  _updateBoat(e) {
    const heading = e.heading || 0
    this._boat._svg.style.transform = 'rotate(' + heading + 'deg)'
    this._boat.setLatLng(e.latlng)
  }

  _updateLines(e) {
    const speed = e.speed || 0
    const heading = e.heading || 0

    const loc = this._map.project(e.latlng)
    const bounds = this._map.getPixelBounds()

    const len = Math.max(
      loc.distanceTo([bounds.max.x, bounds.max.y]),
      loc.distanceTo([bounds.max.x, bounds.min.y]),
      loc.distanceTo([bounds.min.x, bounds.max.y]),
      loc.distanceTo([bounds.min.x, bounds.min.y]),
    )
    const tip = this._map.unproject([
      loc.x + sinDeg(heading) * len,
      loc.y - cosDeg(heading) * len,
    ])

    this._line1.setLatLngs([e.latlng, tip])
    this._line2.setLatLngs([e.latlng, tip])

    const lineMeters = e.latlng.distanceTo(tip)
    const pixelsPerHour = 3600 * speed * len / lineMeters

    this._line2.setStyle({
      dashArray: pixelsPerHour + ',' + pixelsPerHour,
      dashOffset: pixelsPerHour,
    })
  }

  update(e) {
    this._updateBoat(e)
    this._updateLines(e)
    this._updateCircle(e)
  }
}
