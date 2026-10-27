import type { ExhaustFan, LightLine, Point, SwitchingContent } from "../types"

// Вытяжка плана «Группы включения» (change add-exhaust-fan, design D1–D3): правки списка вытяжек и метки вместе с вытяжкой.
// Центр — целые сантиметры. Чистые функции, входы не мутируются; при отсутствии изменений возвращается тот же массив.

export const newExhaust = (id: string, at: Point): ExhaustFan => ({ id, x: Math.round(at.x), y: Math.round(at.y) })

export const addExhaust = (exhausts: readonly ExhaustFan[], fan: ExhaustFan): ExhaustFan[] => [...exhausts, fan]

export function moveExhaust(exhausts: ExhaustFan[], id: string, at: Point): ExhaustFan[] {
  const target = exhausts.find((f) => f.id === id)
  const { x, y } = newExhaust(id, at)
  if (!target || (target.x === x && target.y === y)) return exhausts
  return exhausts.map((f) => (f.id === id ? { ...f, x, y } : f))
}

// удаляет вытяжку и её метку линии; нет такой вытяжки — те же списки
export function removeExhaust(exhausts: ExhaustFan[], lines: LightLine[], id: string): { exhausts: ExhaustFan[]; lines: LightLine[] } {
  if (!exhausts.some((f) => f.id === id)) return { exhausts, lines }
  const rest = lines.filter((l) => l.targetId !== id)
  return { exhausts: exhausts.filter((f) => f.id !== id), lines: rest.length === lines.length ? lines : rest }
}

// поле плана после правки вытяжек (и меток, если они менялись вместе): пустой список не пишется, остальные объекты плана
// сохраняются; поле, которое было бы пустым и не существовало, не появляется (undefined)
export function storedExhausts(prev: SwitchingContent | undefined, exhausts: ExhaustFan[], lines?: LightLine[]): SwitchingContent | undefined {
  const { exhausts: _old, ...rest } = prev ?? {}
  let next: SwitchingContent = rest
  if (lines !== undefined) {
    const { lines: _oldLines, ...others } = rest
    next = lines.length === 0 ? others : { lines, ...others }
  }
  if (exhausts.length === 0) return prev === undefined ? undefined : next
  return { ...next, exhausts }
}
