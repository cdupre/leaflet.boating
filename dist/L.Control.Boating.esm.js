import * as leaflet from 'leaflet';

function createPlugin(L) {

  const { Control, DomUtil, DomEvent, Marker, DivIcon, Circle, Polyline, LatLng, Util } = L;

  function cosD(deg) {
    return Math.cos(deg * Math.PI / 180)
  }

  function sinD(deg) {
    return Math.sin(deg * Math.PI / 180)
  }

  function atan2D(x, y) {
    return ((Math.atan2(x, y) * 180 / Math.PI) + 360) % 360
  }

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
            <tr><td colspan="2" class="double">{heading}</td></tr>
            <tr><td colspan="2" class="double">{speed}</td></tr>
            <tr><th>lat</th><td>{lat}</td></tr>
            <tr><th>lng</th><td>{lng}</td></tr>
            <tr>
              <td colspan="2">
                <div class="line" style="background: {lineColor1}"></div>
                <div class="line" style="background: {lineColor2}"></div>
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
        td div.hours {
          width: 100%;
          float: left;
          display: flex;
          justify-content: space-between;
        }
      `,
    },

    onAdd: function (map) {
      const container = DomUtil.create('div', 'leaflet-bar leaflet-control');
      const link = DomUtil.create('a', 'leaflet-bar-part leaflet-bar-part-single', container);
      this._icon = DomUtil.create('span', 'leaflet-control-boating-arrow', link);
      link.href = '#';

      DomEvent.disableClickPropagation(container);
      DomEvent.on(link, 'click', function (e) {
        DomEvent.stopPropagation(e);
        DomEvent.preventDefault(e);
        this._onClick();
      }, this);

      this._legend = new Control({
        position: this.options.legendPosition,
        css: this.options.legendCSS,
      });
      this._legend.onAdd = function (map) {
        const container = DomUtil.create('div', 'leaflet-control leaflet-bar leaflet-control-boating-legend');
        container.innerHTML = `
          <style>
            @scope (.leaflet-control-boating-legend) {
              ${this.options.css}
            }
          </style>`;
        this.body = DomUtil.create('div', '', container);
        return container
      };

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
      });
      this._boat.on('add', function() {
        this._svg = this.getElement().querySelector('.boat-svg');
      });

      this._circle = new Circle([0, 0], {
        color: this.options.circleColor,
        stroke: false,
      });

      this._line = new Polyline([[0, 0], [0, 0]], {
        color: this.options.lineColor2,
        lineCap: 'square',
      });

      this._linebg = new Polyline([[0, 0], [0, 0]], {
        color: this.options.lineColor1,
      });

      return container
    },

    onRemove: function() {
      this.stop();
    },

    start: function () {
      this._map.on('moveend', this._onMoveEnd, this);
      this._map.on('dragstart', this._onDragStart, this);
      this._map.on('locationerror', this.onLocationError, this);
      this._map.on('locationfound', this._onLocationFound, this);
      this._map.locate({ watch: true, enableHighAccuracy: true });
      this._icon.classList.remove('following');
      this._icon.classList.remove('locating');
      this._icon.classList.add('requesting');
      this._lastPosition = null;
      this._motionCache = [];
    },

    stop: function () {
      this._map.stopLocate();
      this._map.off('moveend', this._onMoveEnd, this);
      this._map.off('dragstart', this._onDragStart, this);
      this._map.off('locationerror', this.onLocationError, this);
      this._map.off('locationfound', this._onLocationFound, this);
      this._map.options.scrollWheelZoom = true;
      this._map.options.doubleClickZoom = true;
      this._icon.classList.remove('requesting');
      this._icon.classList.remove('following');
      this._icon.classList.remove('locating');
      this._map.removeControl(this._legend);
      this._map.removeLayer(this._circle);
      this._map.removeLayer(this._linebg);
      this._map.removeLayer(this._line);
      this._map.removeLayer(this._boat);
    },

    _isRequesting: function () {
      return this._icon.classList.contains('requesting')
    },

    _isLocating: function () {
      return this._icon.classList.contains('locating')
    },

    _isFollowing: function () {
      return this._icon.classList.contains('following')
    },

    _onClick: function () {
      if (this._isFollowing()) {
        this.stop();
      }
      else if (this._isLocating()) {
        this._map.panTo(this._lastPosition.latlng);
        this._follow();
      }
      else if (!this._isRequesting()) {
        this.start();
      }
    },

    _onDragStart: function () {
      if (this._isFollowing()) {
        this._unfollow();
      }
    },

    _onMoveEnd: function () {
      if ((this._isLocating() || this._isFollowing()) && this._lastPosition) {
        this._updateLine(this._lastPosition);
      }
    },

    _follow: function () {
      this._map.options.scrollWheelZoom = 'center';
      this._map.options.doubleClickZoom = 'center';
      this._icon.classList.remove('requesting');
      this._icon.classList.remove('locating');
      this._icon.classList.add('following');
    },

    _unfollow: function () {
      this._map.options.scrollWheelZoom = true;
      this._map.options.doubleClickZoom = true;
      this._icon.classList.remove('requesting');
      this._icon.classList.remove('following');
      this._icon.classList.add('locating');
    },

    _onLocationFound: function (e) {
      e.latlngDMS = this._latlngDMS(e);
      e.smooth = this._smoothMotion(e);

      if (this._isRequesting()) {
        this._map.addControl(this._legend);
        this._map.addLayer(this._circle);
        this._map.addLayer(this._linebg);
        this._map.addLayer(this._line);
        this._map.addLayer(this._boat);
        this._follow();
      }
      if (this._isFollowing()) {
        this._map.panTo(e.latlng);
      }
      this._updateLegend(e);
      this._updateCircle(e);
      this._updateLine(e);
      this._updateBoat(e);
      this._lastPosition = e;
    },

    onLocationError: function (e) {
      console.error(e);
      if (e.code === 1) {
        alert('unlock geolocation please');
        this.stop();
      }
    },

    _updateCircle: function (e) {
      this._circle.setLatLng(e.latlng);
      this._circle.setRadius(e.accuracy);
    },

    _updateBoat: function (e) {
      const heading = e.smooth.heading;
      this._boat._svg.style.transform = 'rotate(' + heading + 'deg)';
      this._boat.setLatLng(e.latlng);
    },

    _updateLine: function (e) {
      const zoom = this._map.getZoom();
      const mapBounds = this._map.getBounds();
      const heading = e.smooth.heading;
      const speed = e.smooth.speed;

      const length = Math.max(
        mapBounds.getNorthWest().distanceTo(e.latlng),
        mapBounds.getNorthEast().distanceTo(e.latlng),
        mapBounds.getSouthEast().distanceTo(e.latlng),
        mapBounds.getSouthWest().distanceTo(e.latlng),
      );
      const lengthDeg = length * 360 / 40000000;
      const dirPoint = new LatLng(
        e.latlng.lat + (lengthDeg * cosD(heading)),
        e.latlng.lng + (lengthDeg * sinD(heading) / cosD(e.latlng.lat)),
      );
      this._line.setLatLngs([e.latlng, dirPoint]);
      this._linebg.setLatLngs([e.latlng, dirPoint]);

      const metersPerPixel = 40000000 * cosD(e.latlng.lat) / (256 * Math.pow(2, zoom));
      const pixelsPerHour = speed / metersPerPixel * 3600;
      this._line.setStyle({
        dashArray: pixelsPerHour + ',' + pixelsPerHour,
        dashOffset: pixelsPerHour,
      });
    },

    _updateLegend: function (e) {
      const nautic = 40000 / 360 / 60;
      const heading = Math.round(e.smooth.heading);
      const speed = Math.round(e.smooth.speed * 36 / nautic) / 10;

      this._legend.body.innerHTML = Util.template(
        this.options.legendHTML, {
          lineColor1: this.options.lineColor1,
          lineColor2: this.options.lineColor2,
          heading: heading + ' °',
          speed: speed + ' kts',
          lat: e.latlngDMS.lat,
          lng: e.latlngDMS.lng,
        }
      );
    },

    _latlngDMS: function (e) {
      function dms(coord) {
        let float = Math.abs(coord);
        let d = Math.floor(float);
        float = (float - d) * 60;
        let m = Math.floor(float);
        float = (float - m) * 60;
        let s = Math.round(float);
        if (s === 60) {
          m = m + 1;
          s = 0;
        }
        if (m === 60) {
          d = d + 1;
          m = 0;
        }
        if (s < 10) {
          s = '0' + s;
        }
        if (m < 10) {
          m = '0' + m;
        }
        return d + '&deg; ' + m + '&apos; ' + s + '&quot; '
      }
      return {
        lat: dms(e.latlng.lat) + ((e.latlng.lat > 0) ? 'N' : 'S'),
        lng: dms(e.latlng.lng) + ((e.latlng.lng > 0) ? 'E' : 'W'),
      }
    },

    _smoothMotion: function (e) {
      this._motionCache.push(e);
      if (this._motionCache.length > this.options.motionCacheLength) {
        this._motionCache.shift();
      }
      const sumX = this._motionCache.reduce(
        (sum, e) => sum + (e.speed || 0) * cosD(e.heading || 0), 0
      );
      const sumY = this._motionCache.reduce(
        (sum, e) => sum + (e.speed || 0) * sinD(e.heading || 0), 0
      );
      return {
        speed: Math.sqrt(sumX ** 2 + sumY ** 2) / this._motionCache.length,
        heading: atan2D(sumY, sumX),
      }
    },
  })
}

const Boating = createPlugin(leaflet);

export { Boating as default };
