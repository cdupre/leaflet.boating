(function (leaflet) {
  'use strict';

  function isNb(n) {
    return Number.isFinite(n)
  }

  function cosDeg(d) {
    return Math.cos(d * Math.PI / 180)
  }

  function sinDeg(d) {
    return Math.sin(d * Math.PI / 180)
  }

  function atan2Deg(y, x) {
    return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360
  }

  function latlngDMS(e) {
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
      return d + '° ' + m + '\' ' + s + '" '
    }
    return {
      lat: dms(e.latlng.lat) + ((e.latlng.lat < 0) ? 'S' : 'N'),
      lng: dms(e.latlng.lng) + ((e.latlng.lng < 0) ? 'W' : 'E'),
    }
  }

  function createMotionSmoother(cacheLength, cacheMaxAge) {
    const cache = [];

    function clear() {
      cache.length = 0;
    }

    function add(e) {
      if (isNb(e.speed) && isNb(e.heading)) {
        cache.push(e);
      }
      while (cache[0] && ((e.timestamp - cache[0].timestamp) > cacheMaxAge)) {
        cache.shift();
      }
      if (cache.length > cacheLength) {
        cache.shift();
      }
      if (cache.length === 0) {
        return { speed: null, heading: null }
      }
      const sumX = cache.reduce(
        (sum, e) => sum + e.speed * cosDeg(e.heading), 0
      );
      const sumY = cache.reduce(
        (sum, e) => sum + e.speed * sinDeg(e.heading), 0
      );
      return {
        heading: atan2Deg(sumY, sumX),
        speed: Math.sqrt(sumX ** 2 + sumY ** 2) / cache.length,
      }
    }

    return { clear, add }
  }

  class Legend extends leaflet.Control {

    constructor(options) {
      super({
        ...{
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
        },
        ...options,
      });
    }

    onAdd() {
      const container = leaflet.DomUtil.create('div', 'leaflet-control leaflet-bar leaflet-control-boating-legend');
      container.innerHTML = `
      <style>
        @scope (.leaflet-control-boating-legend) {
          ${this.options.css}
        }
      </style>`;
      this.body = leaflet.DomUtil.create('div', '', container);
      return container
    }

    update(e) {
      const nautic = 40000 / 360 / 60;
      const heading = e.heading;
      const speed = e.speed;

      this.body.innerHTML = leaflet.Util.template(
        this.options.html, {
          ...latlngDMS(e),
          heading: isNb(heading) ? Math.round(heading) : '--',
          speed: isNb(speed) ? Math.round(speed * 36 / nautic) / 10 : '--',
        }
      );
    }
  }

  class Boat extends leaflet.LayerGroup {

    constructor(options) {
      super([], {
        ...{
          color: '#3388ff',
          circleColor: '#3388ff',
          lineColor1: '#ffcc00',
          lineColor2: '#3388ff',
        },
        ...options,
      });

      this._boat = new leaflet.Marker([0, 0], {
        icon: new leaflet.DivIcon({
          iconAnchor: [12.5, 12.5],
          iconSize: [25, 25],
          className: 'boat',
          html: `
          <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" class="boat-svg">
            <path d="M 128 512 C 128 512 128 128 256 0 C 384 128 384 512 384 512 Z" fill="${this.options.color}"/>
          </svg>`,
        })
      });
      this._boat.on('add', function() {
        this._svg = this.getElement().querySelector('.boat-svg');
      });

      this._circle = new leaflet.Circle([0, 0], {
        color: this.options.circleColor,
        stroke: false,
      });

      this._line1 = new leaflet.Polyline([[0, 0], [0, 0]], {
        color: this.options.lineColor1,
      });

      this._line2 = new leaflet.Polyline([[0, 0], [0, 0]], {
        color: this.options.lineColor2,
        lineCap: 'square',
      });

      this._circle.addTo(this);
      this._line1.addTo(this);
      this._line2.addTo(this);
      this._boat.addTo(this);
    }

    onAdd(map) {
      super.onAdd(map);
      this._map.on('moveend', this._onMoveEnd, this);
      this._e = null;
    }

    onRemove(map) {
      super.onRemove(map);
      this._map.off('moveend', this._onMoveEnd, this);
    }

    _onMoveEnd = () => {
      if (this._e) {
        this._updateLines(this._e);
      }
    }

    _updateCircle(e) {
      this._circle.setLatLng(e.latlng);
      this._circle.setRadius(e.accuracy);
    }

    _updateBoat(e) {
      const heading = e.heading || 0;
      this._boat._svg.style.transform = 'rotate(' + heading + 'deg)';
      this._boat.setLatLng(e.latlng);
    }

    _updateLines(e) {
      const speed = e.speed || 0;
      const heading = e.heading || 0;

      const loc = this._map.project(e.latlng);
      const bounds = this._map.getPixelBounds();

      const len = Math.max(
        loc.distanceTo([bounds.max.x, bounds.max.y]),
        loc.distanceTo([bounds.max.x, bounds.min.y]),
        loc.distanceTo([bounds.min.x, bounds.max.y]),
        loc.distanceTo([bounds.min.x, bounds.min.y]),
      );
      const tip = this._map.unproject([
        loc.x + sinDeg(heading) * len,
        loc.y - cosDeg(heading) * len,
      ]);

      this._line1.setLatLngs([e.latlng, tip]);
      this._line2.setLatLngs([e.latlng, tip]);

      const lineMeters = e.latlng.distanceTo(tip);
      const pixelsPerHour = 3600 * speed * len / lineMeters;

      this._line2.setStyle({
        dashArray: pixelsPerHour + ',' + pixelsPerHour,
        dashOffset: pixelsPerHour,
      });
    }

    update(e) {
      this._e = e;
      this._updateBoat(e);
      this._updateLines(e);
      this._updateCircle(e);
    }
  }

  function Boating(map, options) {
    if (map.boating) {
      return map.boating
    }

    options = {
      ...{
        motionCacheLength: 4,
        motionCacheMaxAge: 10000,
        onLocationError(e) {
          console.error(e);
        },
      },
      ...options,
    };

    const boat = new Boat(options.boat);
    const legend = new Legend(options.legend);
    const motionSmoother = createMotionSmoother(
      options.motionCacheLength,
      options.motionCacheMaxAge,
    );

    let state;
    let lastPosition;
    let savedZoomOptions;

    function setState(newState) {
      state = newState;
      map.fire('boating:statechange', {state});
    }

    function start() {
      map.on('dragstart', onDragStart);
      map.on('locationfound', onLocationFound);
      map.on('locationerror', onLocationError);
      map.locate({ watch: true, enableHighAccuracy: true });
      motionSmoother.clear();
      lastPosition = null;
      saveZoomInteractions();
      setState('requesting');
    }

    function stop() {
      map.stopLocate();
      map.off('dragstart', onDragStart);
      map.off('locationfound', onLocationFound);
      map.off('locationerror', onLocationError);
      map.removeControl(legend);
      map.removeLayer(boat);
      restoreZoomInteractions();
      setState('idle');
    }

    function onDragStart() {
      if (state === 'following') {
        unfollow();
      }
    }

    function follow() {
      centerZoomInteractions();
      setState('following');
    }

    function unfollow() {
      restoreZoomInteractions();
      setState('locating');
    }

    function onLocationFound(e) {
      if (lastPosition) {
        if (lastPosition.timestamp === e.timestamp) {
          return
        }
      }

      const { heading, speed } = motionSmoother.add(e);
      const eSmoothed =  { ...e, heading, speed };

      if (state === 'requesting') {
        map.addControl(legend);
        map.addLayer(boat);
        follow();
      }
      if (state === 'following') {
        map.panTo(eSmoothed.latlng);
      }
      legend.update(eSmoothed);
      boat.update(eSmoothed);
      lastPosition = eSmoothed;
    }

    function onLocationError(e) {
      if (e.code === 1) stop();
      options.onLocationError(e);
    }

    function saveZoomInteractions() {
      savedZoomOptions = {
        touchZoom: map.options.touchZoom,
        scrollWheelZoom: map.options.scrollWheelZoom,
        doubleClickZoom: map.options.doubleClickZoom,
      };
    }

    function centerZoomInteractions() {
      map.options.touchZoom = 'center';
      map.options.scrollWheelZoom = 'center';
      map.options.doubleClickZoom = 'center';
    }

    function restoreZoomInteractions() {
      if (savedZoomOptions) {
        map.options.touchZoom = savedZoomOptions.touchZoom;
        map.options.scrollWheelZoom = savedZoomOptions.scrollWheelZoom;
        map.options.doubleClickZoom = savedZoomOptions.doubleClickZoom;
      }
    }

    function trigger() {
      if (state === 'idle') {
        start();
      }
      else if (state === 'requesting') {
        stop();
      }
      else if (state === 'following') {
        stop();
      }
      else if (state === 'locating') {
        map.panTo(lastPosition.latlng);
        follow();
      }
    }

    setState('idle');

    map.boating = {
      stop,
      trigger,
      get state() {
        return state
      },
    };

    return map.boating
  }

  class ControlBoating extends leaflet.Control {

    constructor(options) {
      super({
        ...{
          position: 'topleft',
        },
        ...options,
      });
    }

    onAdd(map) {
      this.boating = Boating(map, this.options);
      map.on('boating:statechange', this._onStateChange, this);

      const container = leaflet.DomUtil.create('div', 'leaflet-bar leaflet-control');
      const link = leaflet.DomUtil.create('a', 'leaflet-control-boating', container);
      this._icon = leaflet.DomUtil.create('span', 'icon ' + this.boating.state, link);
      link.setAttribute('aria-label', 'Boating Control');
      link.setAttribute('role', 'button');
      link.href = '#';

      leaflet.DomEvent.disableClickPropagation(container);

      leaflet.DomEvent.on(link, 'click', function (e) {
        leaflet.DomEvent.stopPropagation(e);
        leaflet.DomEvent.preventDefault(e);
        this._onClick();
      }, this);

      return container
    }

    onRemove(map) {
      map.off('boating:statechange', this._onStateChange, this);
    }

    _onClick() {
      this.boating.trigger();
    }

    _onStateChange(e) {
      if (this._icon) {
        this._icon.classList.remove('idle', 'requesting', 'following', 'locating');
        this._icon.classList.add(e.state);
      }
    }
  }

  if (window.L) {
    if (window.L.Control) {
      window.L.Control.Boating = ControlBoating;
    }
    if (window.L.control) {
      window.L.control.boating = function(opt) {
        return new ControlBoating(opt)
      };
    }
  }

})(L);
