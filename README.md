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
```
The MIT License (MIT)

Copyright 2024 Clément Dupré

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```