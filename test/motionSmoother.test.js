import test from 'node:test'
import assert from 'node:assert/strict'

import { createMotionSmoother } from '../src/motionSmoother.js'

const EPS = 1e-9
const TAU = 1000
// dt giving alpha = 0.5 (equal weight between old and new)
const HALF = TAU * Math.LN2

function near(actual, expected, eps = EPS) {
  assert.ok(
    Math.abs(actual - expected) <= eps,
    `expected ${actual} to be within ${eps} of ${expected}`,
  )
}

// angular distance, so 359.999… is near 0
function nearDeg(actual, expected, eps = EPS) {
  const d = Math.abs(((actual - expected + 540) % 360) - 180)
  assert.ok(d <= eps, `expected ${actual}° to be within ${eps}° of ${expected}°`)
}

function point(timestamp, speed, heading, extra = {}) {
  return { timestamp, speed, heading, ...extra }
}

test('first point', async (t) => {
  await t.test('returns its speed and heading unchanged', () => {
    const s = createMotionSmoother(TAU)
    const r = s.add(point(0, 5, 42))
    near(r.speed, 5)
    nearDeg(r.heading, 42)
  })

  await t.test('keeps other fields', () => {
    const s = createMotionSmoother(TAU)
    const latlng = { lat: 43, lng: 5 }
    const r = s.add(point(123, 5, 42, { latlng, accuracy: 8 }))
    assert.equal(r.timestamp, 123)
    assert.equal(r.latlng, latlng)
    assert.equal(r.accuracy, 8)
  })

  await t.test('does not mutate the input', () => {
    const s = createMotionSmoother(TAU)
    const e = point(0, 5, 42)
    const r = s.add(e)
    assert.notEqual(r, e)
    assert.deepEqual(e, point(0, 5, 42))
  })

  await t.test('heading is normalized to [0, 360)', () => {
    const s = createMotionSmoother(TAU)
    nearDeg(s.add(point(0, 5, -90)).heading, 270)
    const r = createMotionSmoother(TAU).add(point(0, 5, 450))
    nearDeg(r.heading, 90)
    assert.ok(r.heading >= 0 && r.heading < 360)
  })
})

test('no smoothing when tau is not > 0', async (t) => {
  for (const tau of [0, -1000, NaN, null, undefined]) {
    await t.test(`tau = ${tau}`, () => {
      const s = createMotionSmoother(tau)
      s.add(point(0, 5, 0))
      const r = s.add(point(1000, 10, 90))
      near(r.speed, 10)
      nearDeg(r.heading, 90)
    })
  }
})

test('exponential smoothing', async (t) => {
  await t.test('constant input stays constant', () => {
    const s = createMotionSmoother(TAU)
    for (let i = 0; i < 10; i++) {
      const r = s.add(point(i * 1000, 6, 120))
      near(r.speed, 6)
      nearDeg(r.heading, 120)
    }
  })

  await t.test('alpha = 1 - exp(-dt / tau)', () => {
    const s = createMotionSmoother(TAU)
    s.add(point(0, 0, 0))
    const r = s.add(point(TAU, 10, 90))
    near(r.speed, 10 * (1 - Math.exp(-1)))
    nearDeg(r.heading, 90)
  })

  await t.test('larger dt moves closer to the new value', () => {
    const a = createMotionSmoother(TAU)
    a.add(point(0, 0, 0))
    const short = a.add(point(100, 10, 90)).speed

    const b = createMotionSmoother(TAU)
    b.add(point(0, 0, 0))
    const long = b.add(point(3000, 10, 90)).speed

    assert.ok(short < long)
    assert.ok(long < 10)
  })

  await t.test('dt >> tau converges to the new value', () => {
    const s = createMotionSmoother(TAU)
    s.add(point(0, 2, 10))
    const r = s.add(point(100 * TAU, 8, 200))
    near(r.speed, 8, 1e-6)
    nearDeg(r.heading, 200, 1e-6)
  })

  await t.test('converges after repeated updates', () => {
    const s = createMotionSmoother(TAU)
    s.add(point(0, 0, 0))
    let r
    for (let i = 1; i <= 50; i++) {
      r = s.add(point(i * 500, 7, 300))
    }
    near(r.speed, 7, 1e-6)
    nearDeg(r.heading, 300, 1e-6)
  })

  await t.test('larger tau smooths more', () => {
    const a = createMotionSmoother(1000)
    a.add(point(0, 0, 0))
    const fast = a.add(point(1000, 10, 90)).speed

    const b = createMotionSmoother(5000)
    b.add(point(0, 0, 0))
    const slow = b.add(point(1000, 10, 90)).speed

    assert.ok(slow < fast)
  })
})

test('vector averaging of heading', async (t) => {
  await t.test('wraps around north (350° + 10° → 0°, not 180°)', () => {
    const s = createMotionSmoother(TAU)
    s.add(point(0, 5, 350))
    const r = s.add(point(HALF, 5, 10))
    nearDeg(r.heading, 0)
    near(r.speed, 5 * Math.cos(10 * Math.PI / 180))
  })

  await t.test('90° turn gives 45° and a reduced speed', () => {
    const s = createMotionSmoother(TAU)
    s.add(point(0, 10, 0))
    const r = s.add(point(HALF, 10, 90))
    nearDeg(r.heading, 45)
    near(r.speed, 10 * Math.SQRT1_2)
  })

  await t.test('opposite headings cancel out', () => {
    const s = createMotionSmoother(TAU)
    s.add(point(0, 10, 90))
    const r = s.add(point(HALF, 10, 270))
    near(r.speed, 0)
  })

  await t.test('heading is weighted by speed', () => {
    const s = createMotionSmoother(TAU)
    s.add(point(0, 1, 0))
    const r = s.add(point(HALF, 9, 90))
    nearDeg(r.heading, Math.atan2(9, 1) * 180 / Math.PI)
  })
})

test('missing speed or heading', async (t) => {
  for (const [label, speed, heading] of [
    ['speed null', null, 90],
    ['heading null', 5, null],
    ['speed NaN', NaN, 90],
    ['heading undefined', 5, undefined],
  ]) {
    await t.test(`${label} on first point gives zero speed`, () => {
      const s = createMotionSmoother(TAU)
      const r = s.add(point(0, speed, heading))
      near(r.speed, 0)
      assert.ok(Number.isFinite(r.heading))
    })
  }

  await t.test('is treated as a zero vector and pulls speed down', () => {
    const s = createMotionSmoother(TAU)
    s.add(point(0, 10, 90))
    const r = s.add(point(HALF, null, null))
    near(r.speed, 5)
    nearDeg(r.heading, 90)
  })
})

test('stationary', async (t) => {
  // Geolocation spec: heading is NaN when speed is 0
  await t.test('speed 0 with heading NaN gives speed 0 and heading 0', () => {
    const s = createMotionSmoother(TAU)
    const r = s.add(point(0, 0, NaN))
    assert.equal(r.speed, 0)
    assert.equal(r.heading, 0)
  })
})

test('non-increasing timestamps', async (t) => {
  for (const [label, dt] of [['equal', 0], ['earlier', -500]]) {
    await t.test(`${label} timestamp leaves the state unchanged`, () => {
      const s = createMotionSmoother(TAU)
      s.add(point(1000, 5, 30))
      const r = s.add(point(1000 + dt, 10, 200, { accuracy: 3 }))
      near(r.speed, 5)
      nearDeg(r.heading, 30)
      assert.equal(r.timestamp, 1000 + dt)
      assert.equal(r.accuracy, 3)

      const next = s.add(point(1000 + HALF, 5, 30))
      near(next.speed, 5)
      nearDeg(next.heading, 30)
    })
  }
})

test('reset', async (t) => {
  await t.test('next point is treated as the first one', () => {
    const s = createMotionSmoother(TAU)
    s.add(point(0, 10, 0))
    s.add(point(1000, 10, 0))
    s.reset()
    const r = s.add(point(2000, 3, 250))
    near(r.speed, 3)
    nearDeg(r.heading, 250)
  })

  await t.test('accepts an earlier timestamp after reset', () => {
    const s = createMotionSmoother(TAU)
    s.add(point(5000, 10, 0))
    s.reset()
    s.add(point(0, 0, 0))
    const r = s.add(point(TAU, 10, 90))
    near(r.speed, 10 * (1 - Math.exp(-1)))
  })
})

test('instances are independent', () => {
  const a = createMotionSmoother(TAU)
  const b = createMotionSmoother(TAU)
  a.add(point(0, 10, 0))
  const r = b.add(point(0, 2, 180))
  near(r.speed, 2)
  nearDeg(r.heading, 180)
})
