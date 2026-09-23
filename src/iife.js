import { ControlBoating } from './Control.Boating.js'

if (window.L) {
  if (window.L.Control) {
    window.L.Control.Boating = ControlBoating
  }
  if (window.L.control) {
    window.L.control.boating = function(opt) {
      return new ControlBoating(opt)
    }
  }
}
