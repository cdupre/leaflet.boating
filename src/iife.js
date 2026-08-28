import createPlugin from './core.js'

const Boating = createPlugin(window.L)

window.L.Control.Boating = Boating

if (window.L.control) {
  window.L.control.boating = (opt) => new Boating(opt)
}
