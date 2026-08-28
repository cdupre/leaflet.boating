import { copyFileSync, mkdirSync } from 'node:fs'

function copyCss() {
  return {
    buildEnd() {
      mkdirSync('dist', { recursive: true })
      copyFileSync('src/style.css', 'dist/L.Control.Boating.css')
    },
  }
}

export default [
  {
    input: 'src/esm.js',
    external: ['leaflet'],
    output: {
      file: 'dist/L.Control.Boating.esm.js',
      format: 'es',
    },
    plugins: [copyCss()],
  },
  {
    input: 'src/iife.js',
    output: {
      file: 'dist/L.Control.Boating.js',
      format: 'iife',
      name: 'LeafletBoatingIIFE',
    },
    plugins: [copyCss()],
  },
]
