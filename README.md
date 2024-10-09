# Leaflet.Boating

A useful control to geolocate the user showing his direction, speed and location as a simple boating app

Tested with [Leaflet](http://leafletjs.com/) 1.9.2 in Firefox and Chrome

## Demo

[see demo](https://cdupre.github.io/leaflet.boating/demo/)

## Usage

Include the CSS and JavaScript files
```html
<link rel="stylesheet" href="/path/to/L.Control.Boating.css" />
<script src="/path/to/L.Control.Boating.js"></script>
```
Add the following snippet to your map initialization
```js
L.control.boating().addTo(map)
```
Leaflet.Boating is extended from leaflet Control. See [documentation](https://leafletjs.com/reference.html#control) for options and methods

## License

[MIT](./LICENSE.md)