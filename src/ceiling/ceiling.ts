import type { ExplicatedRoom } from "../room-explication"
import { canAnchor } from "../room-anchor"
import type { Point, StretchCeiling } from "../types"

// Натяжной потолок помещения (change add-ceiling-plan, design D2, D3, D5): опускание полотна от плиты — целое число миллиметров
// больше нуля без верхней границы; привязка к помещению — общая со стяжкой. Чистые функции, входы не мутируются.

export const CEILING_DROP_DEFAULT = 50

export const isDropMm = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0

// опускание из поля ввода (панель, поле на месте): только цифры, целое больше нуля, иначе null (ввод не применяется)
export function parseDropMm(text: string): number | null {
  const t = text.trim()
  if (!/^\d+$/.test(t)) return null
  const n = Number(t)
  return isDropMm(n) ? n : null
}

// подпись потолка на холсте и в PDF
export const ceilingLabel = (dropMm: number): string => `-${dropMm}мм`

// Постановка кликом: потолок с опорной точкой в точке клика. Тот же массив, если клик вне помещений экспликации или в
// помещении уже есть действующий потолок.
export function addCeiling(
  ceilings: StretchCeiling[],
  items: readonly ExplicatedRoom[],
  at: Point,
  dropMm: number,
  newId: () => string = () => crypto.randomUUID(),
): StretchCeiling[] {
  if (!canAnchor(items, ceilings, at)) return ceilings
  return [...ceilings, { id: newId(), at: { x: at.x, y: at.y }, dropMm }]
}

export function removeCeiling(ceilings: StretchCeiling[], id: string): StretchCeiling[] {
  return ceilings.some((c) => c.id === id) ? ceilings.filter((c) => c.id !== id) : ceilings
}

export function setCeilingDrop(ceilings: StretchCeiling[], id: string, dropMm: number): StretchCeiling[] {
  const target = ceilings.find((c) => c.id === id)
  if (!target || target.dropMm === dropMm) return ceilings
  return ceilings.map((c) => (c.id === id ? { ...c, dropMm } : c))
}
