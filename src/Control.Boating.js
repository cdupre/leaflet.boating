import { Control, DomUtil, DomEvent } from 'leaflet'
import { Boating } from './Boating.js'

export class ControlBoating extends Control {

  constructor(options) {
    super({
      ...{
        position: 'topleft',
      },
      ...options,
    })
  }

  onAdd(map) {
    this.boating = Boating(map, this.options)
    map.on('boating:statechange', this._onStateChange, this)

    const container = DomUtil.create('div', 'leaflet-bar leaflet-control')
    const link = DomUtil.create('a', 'leaflet-control-boating', container)
    this._icon = DomUtil.create('span', 'icon ' + this.boating.state, link)
    link.setAttribute('aria-label', 'Boating Control')
    link.setAttribute('role', 'button')
    link.href = '#'

    DomEvent.disableClickPropagation(container)

    DomEvent.on(link, 'click', function (e) {
      DomEvent.stopPropagation(e)
      DomEvent.preventDefault(e)
      this._onClick()
    }, this)

    return container
  }

  onRemove(map) {
    map.off('boating:statechange', this._onStateChange, this)
  }

  _onClick() {
    this.boating.trigger()
  }

  _onStateChange(e) {
    if (this._icon) {
      this._icon.classList.remove('idle', 'requesting', 'following', 'locating')
      this._icon.classList.add(e.state)
    }
  }
}
