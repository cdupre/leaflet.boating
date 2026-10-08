import { Control, DomUtil, Util } from 'leaflet'
import { latlngDMS } from './utils.js'

const defaultOptions = {
  position: 'bottomright',
  html: `
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
  css: `
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
}

export class Legend extends Control {

  constructor(options) {
    super({
      ...defaultOptions,
      ...options,
    })
  }

  onAdd() {
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

  update(e) {
    const nautic = 1.852
    const speed = e.speed
    const latlng = e.latlng
    const heading = e.heading
    const { lat, lng } = latlngDMS(latlng)

    this.body.innerHTML = Util.template(
      this.options.html, {
        heading: heading ? Math.round(heading) : '--',
        speed: Math.round(speed * 36 / nautic) / 10,
        lat, lng,
      }
    )
  }
}
