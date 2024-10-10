const baseMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
})

const seaMarks = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png')

const map = L.map('map', {
  center: [47.2, -2.30],
  layers: [baseMap, seaMarks],
  zoom: 10,
})

L.control.boating().addTo(map)