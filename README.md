# Leaflet.Boating

A [Leaflet](http://leafletjs.com/) plugin to geolocate the user and display heading, speed and location like a simple navigation app  
Built and tested for Leaflet 1.9.x. 

## Usage

### Set up

#### With `<script>` tag

Clone the repository
```
git clone https://github.com/cdupre/leaflet.boating
```
Add the following in html headers
```html
<link rel="stylesheet" href="path/to/L.Control.Boating.css" />
<script src="path/to/L.Control.Boating.js"></script>
```
Add the following snippet to your map initialization
```js
L.control.boating().addTo(map)
```

#### With npm

Add package to your project
```
npm install leaflet.boating
```
Add the following snippet to your map initialization
```js
import Boating from 'leaflet.boating'
import "leaflet.boating/dist/L.Control.Boating.css"

...

new Boating().addTo(map)
```

### Options

The boating control inherits options from [Leaflet Controls](https://leafletjs.com/reference.html#control).  
To customize the control, pass an object with your custom options to the boating control.

```js
L.control.boating(OPTIONS).addTo(map)

or

new Boating(OPTIONS).addTo(map)
```
Possible options are listed in the following table

| Option | Type | Description | Default |
| --- | --- | --- | --- |
| `position` | `String`  | Position of the control | `topleft` |
| `legendPosition` | `String`  | Position of the legend | `bottomright` |
| `boatColor` | `String`  | Boat color | `#3388ff` |
| `lineColor1` | `String`  | First color for the line | `#ffcc00` |
| `lineColor2` | `String`  | Second color for the line | `#3388ff` |
| `circleColor` | `String`  | Circle color | `#3388ff` |
| `cacheLength` | `Number`  | Speed and heading cache for smoothest line movements | `4` |

## Development

Feel free to suggest or develop new features or modifications :)

`src/core.js` got the plugin's logic. The single factory function, `createPlugin()`
returns the `Boating` control

`src/iife.js` wrapper to build `dist/L.Control.Boating.js`, for the classic `<script>` tag

`src/esm.js` wrapper to build `dist/L.Control.Boating.esm.js`, for `import`

`dist` files are bundled with [Rollup](https://rollupjs.org) (see `rollup.config.js`)

```
npm install
npm run dev     # builds dist/ on every change, and serves this folder on :8080
```
During dev, test files are served [here](http://localhost:8080/test/). Remember to reload pages manually, no hot reload configured !

## Demo

For an example case, see the file `index.html`  
For more, see the [online demo](https://cdupre.github.io/leaflet.boating)

## Screenshot

<div align="center">
  <img src="./screenshot.png">
</div>

## License

[MIT](./LICENSE)
