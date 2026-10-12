import test from 'node:test'
import assert from 'node:assert/strict'

import {
  isNb,
  cosDeg,
  sinDeg,
  atan2Deg,
  latlngDMS,
  lerp,
  lerpDeg,
} from '../src/utils.js'

const EPS = 1e-9

function near(actual, expected, eps = EPS) {
  assert.ok(
    Math.abs(actual - expected) <= eps,
    `expected ${actual} to be within ${eps} of ${expected}`,
  )
}

test('isNb', async (t) => {
  await t.test('true for finite numbers', () => {
    assert.equal(isNb(0), true)
    assert.equal(isNb(-3.5), true)
    assert.equal(isNb(1e10), true)
  })

  await t.test('false for non-finite / non-number values', () => {
    assert.equal(isNb(NaN), false)
    assert.equal(isNb(Infinity), false)
    assert.equal(isNb(-Infinity), false)
    assert.equal(isNb('5'), false)
    assert.equal(isNb(null), false)
    assert.equal(isNb(undefined), false)
    assert.equal(isNb({}), false)
  })
})

test('cosDeg', async (t) => {
  await t.test('known angles', () => {
    near(cosDeg(0), 1)
    near(cosDeg(90), 0)
    near(cosDeg(180), -1)
    near(cosDeg(270), 0)
    near(cosDeg(360), 1)
  })

  await t.test('matches Math.cos in radians', () => {
    near(cosDeg(37), Math.cos(37 * Math.PI / 180))
  })

  await t.test('is even (cos(-d) === cos(d))', () => {
    near(cosDeg(-60), cosDeg(60))
  })
})

test('sinDeg', async (t) => {
  await t.test('known angles', () => {
    near(sinDeg(0), 0)
    near(sinDeg(90), 1)
    near(sinDeg(180), 0)
    near(sinDeg(270), -1)
  })

  await t.test('matches Math.sin in radians', () => {
    near(sinDeg(37), Math.sin(37 * Math.PI / 180))
  })

  await t.test('is odd (sin(-d) === -sin(d))', () => {
    near(sinDeg(-60), -sinDeg(60))
  })
})

test('atan2Deg', async (t) => {
  await t.test('returns a bearing in [0, 360)', () => {
    near(atan2Deg(0, 1), 0)
    near(atan2Deg(1, 0), 90)
    near(atan2Deg(0, -1), 180)
    near(atan2Deg(-1, 0), 270)
  })

  await t.test('normalises negative angles', () => {
    // atan2(-1, 1) = -45deg -> 315
    near(atan2Deg(-1, 1), 315)
  })

  await t.test('diagonal', () => {
    near(atan2Deg(1, 1), 45)
  })

  await t.test('origin gives 0 (no direction)', () => {
    assert.equal(atan2Deg(0, 0), 0)
  })

  await t.test('inverse of (cosDeg, sinDeg)', () => {
    for (const d of [0, 12, 90, 175, 200, 359]) {
      near(atan2Deg(sinDeg(d), cosDeg(d)), d, 1e-7)
    }
  })
})

test('latlngDMS', async (t) => {
  const dms = (lat, lng) => latlngDMS({ lat, lng })

  await t.test('zero coordinates', () => {
    assert.deepEqual(dms(0, 0), {
      lat: '0° 00\' 00" N',
      lng: '0° 00\' 00" E',
    })
  })

  await t.test('hemisphere suffixes', () => {
    assert.match(dms(10, 10).lat, /N$/)
    assert.match(dms(-10, 10).lat, /S$/)
    assert.match(dms(10, 10).lng, /E$/)
    assert.match(dms(10, -10).lng, /W$/)
  })

  await t.test('negative values use absolute magnitude', () => {
    assert.equal(dms(-1.5, 0).lat, '1° 30\' 00" S')
  })

  await t.test('minutes and seconds are zero-padded', () => {
    // 1 + 2/60 + 3/3600 degrees
    const coord = 1 + 2 / 60 + 3 / 3600
    assert.equal(dms(coord, 0).lat, '1° 02\' 03" N')
  })

  await t.test('formats longitude like latitude', () => {
    assert.equal(dms(0, -1.5).lng, '1° 30\' 00" W')
    assert.equal(dms(0, 1 + 2 / 60 + 3 / 3600).lng, '1° 02\' 03" E')
  })

  await t.test('carries 60 seconds into minutes without touching degrees', () => {
    // 1° 29' 59.9" -> 1° 30' 00"
    assert.equal(dms(1 + 29 / 60 + 59.9 / 3600, 0).lat, '1° 30\' 00" N')
  })

  await t.test('carries 60 seconds into minutes', () => {
    // 0.99986 deg -> 0° 59' 59.5" -> rounds to 60" -> 1° 00' 00"
    assert.equal(dms(0.9999, 0).lat, '1° 00\' 00" N')
  })

  await t.test('typical position', () => {
    // Paris ~ 48.8566, 2.3522
    assert.equal(dms(48.8566, 2.3522).lat, '48° 51\' 24" N')
    assert.equal(dms(48.8566, 2.3522).lng, '2° 21\' 08" E')
  })
})

test('lerp', async (t) => {
  await t.test('returns a at t = 0 and b at t = 1', () => {
    assert.equal(lerp(10, 20, 0), 10)
    assert.equal(lerp(10, 20, 1), 20)
  })

  await t.test('interpolates linearly in between', () => {
    assert.equal(lerp(10, 20, 0.25), 12.5)
    assert.equal(lerp(20, 10, 0.5), 15)
  })
})

test('lerpDeg', async (t) => {
  await t.test('returns a at t = 0 and b at t = 1', () => {
    near(lerpDeg(90, 180, 0), 90)
    near(lerpDeg(90, 180, 1), 180)
  })

  await t.test('interpolates linearly in between', () => {
    near(lerpDeg(90, 180, 0.5), 135)
    near(lerpDeg(180, 90, 0.5), 135)
  })

  await t.test('turns the short way through north', () => {
    near(lerpDeg(350, 10, 0.5), 0)
    near(lerpDeg(350, 10, 0.25), 355)
    near(lerpDeg(10, 350, 0.25), 5)
  })

  await t.test('stays in [0, 360)', () => {
    near(lerpDeg(0, 300, 0.5), 330)
    near(lerpDeg(350, 10, 1), 10)
  })
})
