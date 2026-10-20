import { describe, expect, it } from "vitest"
import { createDeferredSave } from "./deferred-save"
import type { Timers } from "./deferred-save"

// управляемые часы: таймеры срабатывают только по advance
function fakeTimers(): Timers & { advance(ms: number): void } {
  let now = 0
  let nextId = 1
  const pending = new Map<number, { at: number; fn: () => void }>()
  return {
    set(fn, ms) {
      const id = nextId++
      pending.set(id, { at: now + ms, fn })
      return id
    },
    clear(id) {
      pending.delete(id)
    },
    advance(ms) {
      now += ms
      for (const [id, t] of [...pending]) {
        if (t.at > now) continue
        pending.delete(id)
        t.fn()
      }
    },
  }
}

const setup = (delayMs = 300) => {
  const timers = fakeTimers()
  let saves = 0
  const deferred = createDeferredSave(() => saves++, delayMs, timers)
  return { timers, deferred, saves: () => saves }
}

describe("отложенное сохранение вида (drawing-storage «Автосохранение изменений чертежа»)", () => {
  it("пан не пишет хранилище на каждом движении, итог пишется по отпусканию кнопки", () => {
    const { deferred, saves, timers } = setup()
    for (let i = 0; i < 200; i++) {
      deferred.schedule()
      timers.advance(5) // движения чаще паузы
    }
    expect(saves()).toBe(0)
    deferred.flush()
    expect(saves()).toBe(1)
  })

  it("пауза в панорамировании пишет вид одной записью, дальше движения снова не пишут на каждом шаге", () => {
    const { deferred, saves, timers } = setup(300)
    for (let i = 0; i < 20; i++) {
      deferred.schedule()
      timers.advance(5)
    }
    expect(saves()).toBe(0)
    timers.advance(300) // остановился, не отпуская кнопку
    expect(saves()).toBe(1)
    for (let i = 0; i < 20; i++) {
      deferred.schedule()
      timers.advance(5)
    }
    expect(saves()).toBe(1)
    deferred.flush() // отпустил кнопку
    expect(saves()).toBe(2)
  })

  it("зум колесом пишется после паузы одной записью, а не по записи на прокрутку", () => {
    const { deferred, saves, timers } = setup(300)
    for (let i = 0; i < 20; i++) {
      deferred.schedule()
      timers.advance(50)
    }
    expect(saves()).toBe(0)
    timers.advance(300)
    expect(saves()).toBe(1)
    timers.advance(10_000)
    expect(saves()).toBe(1)
  })

  it("закрытие страницы во время зума: запись по flush, не дожидаясь паузы", () => {
    const { deferred, saves, timers } = setup()
    deferred.schedule()
    timers.advance(100)
    expect(saves()).toBe(0)
    deferred.flush()
    expect(saves()).toBe(1)
    timers.advance(10_000)
    expect(saves()).toBe(1) // таймер после flush ничего не дописывает
  })

  it("flush без изменений ничего не пишет", () => {
    const { deferred, saves } = setup()
    deferred.flush()
    expect(saves()).toBe(0)
  })

  it("после записи следующее изменение снова планирует запись", () => {
    const { deferred, saves, timers } = setup()
    deferred.schedule()
    timers.advance(300)
    deferred.schedule()
    timers.advance(300)
    expect(saves()).toBe(2)
  })

  it("pending показывает, есть ли незаписанное", () => {
    const { deferred, timers } = setup()
    expect(deferred.pending()).toBe(false)
    deferred.schedule()
    expect(deferred.pending()).toBe(true)
    timers.advance(300)
    expect(deferred.pending()).toBe(false)
  })
})
