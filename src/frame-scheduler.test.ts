import { describe, expect, it } from "vitest"
import { createFrameScheduler } from "./frame-scheduler"
import type { FrameTimer } from "./frame-scheduler"

// кадры наступают только по nextFrame
function fakeFrames(): FrameTimer & { nextFrame(): void; queued(): number } {
  let nextId = 1
  const queue = new Map<number, () => void>()
  return {
    request(fn) {
      const id = nextId++
      queue.set(id, fn)
      return id
    },
    cancel(id) {
      queue.delete(id)
    },
    nextFrame() {
      const batch = [...queue.values()]
      queue.clear()
      for (const fn of batch) fn()
    },
    queued: () => queue.size,
  }
}

const setup = () => {
  const frames = fakeFrames()
  const drawn: number[] = []
  let state = 0
  const scheduler = createFrameScheduler(() => drawn.push(state), frames)
  return { frames, scheduler, drawn, set: (v: number) => (state = v) }
}

describe("отрисовка по кадрам (canvas-viewport «Итоговый вид после серии событий»)", () => {
  it("серия запросов между кадрами даёт одну отрисовку итогового состояния", () => {
    const { frames, scheduler, drawn, set } = setup()
    for (let i = 1; i <= 100; i++) {
      set(i)
      scheduler.request()
    }
    expect(drawn).toEqual([])
    frames.nextFrame()
    expect(drawn).toEqual([100])
  })

  it("запрос после кадра планирует следующий кадр", () => {
    const { frames, scheduler, drawn, set } = setup()
    set(1)
    scheduler.request()
    frames.nextFrame()
    set(2)
    scheduler.request()
    frames.nextFrame()
    expect(drawn).toEqual([1, 2])
  })

  it("flush рисует сразу и снимает ожидающий кадр", () => {
    const { frames, scheduler, drawn, set } = setup()
    set(7)
    scheduler.request()
    scheduler.flush()
    expect(drawn).toEqual([7])
    expect(frames.queued()).toBe(0)
    frames.nextFrame()
    expect(drawn).toEqual([7])
  })

  it("flush без ожидающего запроса ничего не рисует", () => {
    const { scheduler, drawn } = setup()
    scheduler.flush()
    expect(drawn).toEqual([])
  })

  it("запрос во время отрисовки попадает в следующий кадр", () => {
    const frames = fakeFrames()
    let draws = 0
    const scheduler = createFrameScheduler(() => {
      draws++
      if (draws === 1) scheduler.request()
    }, frames)
    scheduler.request()
    frames.nextFrame()
    expect(draws).toBe(1)
    frames.nextFrame()
    expect(draws).toBe(2)
  })
})
