// Отложенная запись изменений вида (change render-pan-perf, design D3): серия изменений даёт одну запись
// после паузы, а flush пишет немедленно — по завершении жеста и при закрытии или скрытии страницы.

export interface Timers {
  set(fn: () => void, ms: number): number
  clear(handle: number): void
}

export interface DeferredSave {
  schedule(): void
  flush(): void
  pending(): boolean
}

export function createDeferredSave(save: () => void, delayMs: number, timers: Timers): DeferredSave {
  let timer: number | null = null
  let dirty = false

  const flush = (): void => {
    if (timer !== null) timers.clear(timer)
    timer = null
    if (!dirty) return
    dirty = false
    save()
  }

  return {
    schedule() {
      dirty = true
      if (timer !== null) timers.clear(timer)
      timer = timers.set(flush, delayMs)
    },
    flush,
    pending: () => dirty,
  }
}
