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
  await t.test('first sample is returned as is', () => {
    const s = createMotionSmoother(3000)
    const out = s.add({ speed: 10, heading: 90, timestamp: 0 })
    near(out.speed, 10, 1e-9)
    near(out.heading, 90, 1e-9)
  })

  await t.test('returns null speed/heading for an invalid sample', () => {
    const s = createMotionSmoother(3000)
    const none = { speed: null, heading: null }
    assert.deepEqual(s.add({ speed: NaN, heading: NaN, timestamp: 0 }), none)
    assert.deepEqual(s.add({ speed: 10, heading: undefined, timestamp: 1 }), none)
    assert.deepEqual(s.add({ speed: 'x', heading: 90, timestamp: 2 }), none)
  })

  await t.test('moves toward the new sample by 1 - exp(-dt/tau)', () => {
    const s = createMotionSmoother(1000)
    s.add({ speed: 10, heading: 0, timestamp: 0 })
    const out = s.add({ speed: 20, heading: 0, timestamp: 1000 })
    near(out.heading, 0, 1e-9)
    near(out.speed, 10 + 10 * (1 - Math.exp(-1)), 1e-9)
  })

  await t.test('a longer gap weighs the new sample more', () => {
    const a = createMotionSmoother(1000)
    const b = createMotionSmoother(1000)
    a.add({ speed: 10, heading: 0, timestamp: 0 })
    b.add({ speed: 10, heading: 0, timestamp: 0 })
    const short = a.add({ speed: 20, heading: 0, timestamp: 500 })
    const long = b.add({ speed: 20, heading: 0, timestamp: 5000 })
    assert.ok(long.speed > short.speed)
  })

  await t.test('identical timestamps do not change the state', () => {
    const s = createMotionSmoother(1000)
    s.add({ speed: 10, heading: 0, timestamp: 0 })
    near(s.add({ speed: 99, heading: 0, timestamp: 0 }).speed, 10, 1e-9)
  })

  await t.test('opposite vectors cancel to zero speed', () => {
    // tau = 1000 / ln 2 gives alpha = 0.5 after 1s, i.e. equal weights
    const s = createMotionSmoother(1000 / Math.LN2)
    s.add({ speed: 10, heading: 0, timestamp: 0 })
    near(s.add({ speed: 10, heading: 180, timestamp: 1000 }).speed, 0, 1e-9)
  })

  await t.test('an invalid sample keeps the state, dt counts from the last valid one', () => {
    // tau = 1000 / ln 2 gives alpha = 0.5 after 1s, i.e. equal weights
    const s = createMotionSmoother(1000 / Math.LN2)
    s.add({ speed: 10, heading: 0, timestamp: 0 })
    s.add({ speed: NaN, heading: NaN, timestamp: 500 })
    // 1s since the last valid sample, not 0.5s since the invalid one
    near(s.add({ speed: 10, heading: 180, timestamp: 1000 }).speed, 0, 1e-9)
  })

  await t.test('forgets the past after a long gap', () => {
    const s = createMotionSmoother(3000)
    s.add({ speed: 100, heading: 0, timestamp: 0 })
    const out = s.add({ speed: 30, heading: 90, timestamp: 60000 })
    near(out.speed, 30, 1e-3)
    near(out.heading, 90, 1e-3)
  })

  await t.test('tau = 0 disables smoothing', () => {
    const s = createMotionSmoother(0)
    s.add({ speed: 10, heading: 0, timestamp: 0 })
    // same timestamp (dt = 0) must not produce NaN
    const same = s.add({ speed: 20, heading: 90, timestamp: 0 })
    near(same.speed, 20, 1e-9)
    near(same.heading, 90, 1e-9)
    const later = s.add({ speed: 30, heading: 180, timestamp: 1000 })
    near(later.speed, 30, 1e-9)
    near(later.heading, 180, 1e-9)
  })

  await t.test('reset() forgets the previous state', () => {
    const s = createMotionSmoother(3000)
    s.add({ speed: 10, heading: 90, timestamp: 0 })
    s.reset()
    const out = s.add({ speed: 20, heading: 0, timestamp: 1 })
    near(out.speed, 20, 1e-9)
    near(out.heading, 0, 1e-9)
  })

  await t.test('averages heading around the compass correctly', () => {
    const s = createMotionSmoother(1000 / Math.LN2)
    s.add({ speed: 10, heading: 350, timestamp: 0 })
    const out = s.add({ speed: 10, heading: 10, timestamp: 1000 })
    // mean bearing of 350 and 10 is 0/360, not 180
    near(Math.min(out.heading, 360 - out.heading), 0, 1e-6)
  })
})
