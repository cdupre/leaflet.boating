import test from 'node:test'
import assert from 'node:assert/strict'

import {
  isNb,
  cosDeg,
  sinDeg,
  atan2Deg,
  latlngDMS,
  createMotionSmoother,
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

  await t.test('inverse of (cosDeg, sinDeg)', () => {
    for (const d of [0, 12, 90, 175, 200, 359]) {
      near(atan2Deg(sinDeg(d), cosDeg(d)), d, 1e-7)
    }
  })
})

test('latlngDMS', async (t) => {
  const dms = (lat, lng) => latlngDMS({ latlng: { lat, lng } })

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

test('createMotionSmoother', async (t) => {
  await t.test('returns null speed/heading while cache is empty', () => {
    const s = createMotionSmoother(4, 10000)
    assert.deepEqual(s.add({ speed: NaN, heading: NaN, timestamp: 0 }), {
      speed: null,
      heading: null,
    })
  })

  await t.test('ignores samples with non-numeric speed or heading', () => {
    const s = createMotionSmoother(4, 10000)
    assert.deepEqual(s.add({ speed: 10, heading: undefined, timestamp: 0 }), {
      speed: null,
      heading: null,
    })
    assert.deepEqual(s.add({ speed: 'x', heading: 90, timestamp: 1 }), {
      speed: null,
      heading: null,
    })
  })

  await t.test('single sample returns that sample', () => {
    const s = createMotionSmoother(4, 10000)
    const out = s.add({ speed: 10, heading: 90, timestamp: 0 })
    near(out.speed, 10, 1e-9)
    near(out.heading, 90, 1e-9)
  })

  await t.test('averages the vector of same-heading samples', () => {
    const s = createMotionSmoother(4, 10000)
    s.add({ speed: 10, heading: 0, timestamp: 0 })
    const out = s.add({ speed: 20, heading: 0, timestamp: 1000 })
    near(out.heading, 0, 1e-9)
    near(out.speed, 15, 1e-9)
  })

  await t.test('opposite vectors cancel to zero speed', () => {
    const s = createMotionSmoother(4, 10000)
    s.add({ speed: 10, heading: 0, timestamp: 0 })
    const out = s.add({ speed: 10, heading: 180, timestamp: 1000 })
    near(out.speed, 0, 1e-9)
  })

  await t.test('drops the oldest sample past cacheLength', () => {
    const s = createMotionSmoother(2, 100000)
    s.add({ speed: 100, heading: 0, timestamp: 0 })
    s.add({ speed: 10, heading: 0, timestamp: 1000 })
    // third sample pushes the first (speed 100) out
    const out = s.add({ speed: 20, heading: 0, timestamp: 2000 })
    near(out.speed, 15, 1e-9) // mean of 10 and 20
  })

  await t.test('drops samples older than cacheMaxAge seconds', () => {
    const s = createMotionSmoother(10, 10000)
    s.add({ speed: 100, heading: 0, timestamp: 0 })
    // 20s later: the first sample is older than 10s and is evicted
    const out = s.add({ speed: 30, heading: 0, timestamp: 20000 })
    near(out.speed, 30, 1e-9)
  })

  await t.test('keeps samples within cacheMaxAge', () => {
    const s = createMotionSmoother(10, 10000)
    s.add({ speed: 10, heading: 0, timestamp: 0 })
    const out = s.add({ speed: 20, heading: 0, timestamp: 10000 })
    near(out.speed, 15, 1e-9)
  })

  await t.test('clear() empties the cache', () => {
    const s = createMotionSmoother(4, 10000)
    s.add({ speed: 10, heading: 90, timestamp: 0 })
    s.clear()
    assert.deepEqual(s.add({ speed: NaN, heading: NaN, timestamp: 1 }), {
      speed: null,
      heading: null,
    })
  })

  await t.test('averages heading around the compass correctly', () => {
    const s = createMotionSmoother(4, 10000)
    s.add({ speed: 10, heading: 350, timestamp: 0 })
    const out = s.add({ speed: 10, heading: 10, timestamp: 1000 })
    // mean bearing of 350 and 10 is 0/360, not 180
    near(out.heading, 0, 1e-6)
  })
})
