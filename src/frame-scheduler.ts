// Отрисовка не чаще раза за кадр (change render-pan-perf, design D2): серия запросов между кадрами
// даёт одну отрисовку последнего состояния.

export interface FrameTimer {
  request(fn: () => void): number
  cancel(handle: number): void
}

export interface FrameScheduler {
  request(): void
  flush(): void
}

export function createFrameScheduler(draw: () => void, frames: FrameTimer): FrameScheduler {
  let handle: number | null = null

  return {
    request() {
      if (handle !== null) return
      handle = frames.request(() => {
        handle = null
        draw()
      })
    },
    flush() {
      if (handle === null) return
      frames.cancel(handle)
      handle = null
      draw()
    },
  }
}
