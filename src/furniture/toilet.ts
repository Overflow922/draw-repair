import type { FurnitureItem, ToiletSizes } from "../types"

// Унитаз (change add-toilet, design D1, D2): чаша и блок инсталляции у стены — один предмет. Ширина предмета равна ширине блока,
// длина — длине чаши плюс глубине блока; чаша стоит по центру ширины блока, блок лежит у верхней стороны при угле 0.
// Чистые функции, входы не мутируются.

export const TOILET_DEFAULTS: ToiletSizes = { bowlWidthCm: 38, bowlLengthCm: 52, blockWidthCm: 70, blockDepthCm: 20 }

export interface ToiletBounds {
  widthCm: number
  lengthCm: number
}

export const toiletBounds = (t: ToiletSizes): ToiletBounds => ({ widthCm: t.blockWidthCm, lengthCm: t.bowlLengthCm + t.blockDepthCm })

const positive = (v: number): boolean => Number.isFinite(v) && v > 0

// размеры допустимы: все положительные, чаша не шире блока, длина чаши не меньше половины её ширины (скруглённый нос)
export const isValidToilet = (t: ToiletSizes): boolean =>
  positive(t.bowlWidthCm) &&
  positive(t.bowlLengthCm) &&
  positive(t.blockWidthCm) &&
  positive(t.blockDepthCm) &&
  t.bowlWidthCm <= t.blockWidthCm &&
  t.bowlLengthCm >= t.bowlWidthCm / 2

// размеры унитаза после правки или null, если результат недопустим
export function editToilet(current: ToiletSizes, patch: Partial<ToiletSizes>): ToiletSizes | null {
  const next: ToiletSizes = {
    bowlWidthCm: patch.bowlWidthCm ?? current.bowlWidthCm,
    bowlLengthCm: patch.bowlLengthCm ?? current.bowlLengthCm,
    blockWidthCm: patch.blockWidthCm ?? current.blockWidthCm,
    blockDepthCm: patch.blockDepthCm ?? current.blockDepthCm,
  }
  return isValidToilet(next) ? next : null
}

// все четыре размера в одном отношении: образец легенды PDF подгоняет габариты под образец
export const scaleToilet = (t: ToiletSizes, factor: number): ToiletSizes => ({
  bowlWidthCm: t.bowlWidthCm * factor,
  bowlLengthCm: t.bowlLengthCm * factor,
  blockWidthCm: t.blockWidthCm * factor,
  blockDepthCm: t.blockDepthCm * factor,
})

export const sameToilet = (a: ToiletSizes, b: ToiletSizes): boolean =>
  a.bowlWidthCm === b.bowlWidthCm && a.bowlLengthCm === b.bowlLengthCm && a.blockWidthCm === b.blockWidthCm && a.blockDepthCm === b.blockDepthCm

export type ToiletZone = "block" | "bowl"

export interface ToiletPart {
  zone: ToiletZone
  // прямоугольник части в тех же терминах, что предмет: центр, ширина, длина, угол
  rect: FurnitureItem
}

// форма унитаза для пересечений: блок и чаша — два прямоугольника с тем же углом и общей осью длины предмета
export function toiletParts(item: FurnitureItem, sizes: ToiletSizes): readonly ToiletPart[] {
  const { lengthCm } = toiletBounds(sizes)
  const r = (item.angleDeg * Math.PI) / 180
  // единичная ось длины предмета в чертеже
  const v = { x: -Math.sin(r), y: Math.cos(r) }
  const part = (zone: ToiletZone, widthCm: number, partLengthCm: number, offsetCm: number): ToiletPart => ({
    zone,
    rect: { ...item, x: item.x + v.x * offsetCm, y: item.y + v.y * offsetCm, widthCm, lengthCm: partLengthCm },
  })
  return [
    part("block", sizes.blockWidthCm, sizes.blockDepthCm, sizes.blockDepthCm / 2 - lengthCm / 2),
    part("bowl", sizes.bowlWidthCm, sizes.bowlLengthCm, sizes.blockDepthCm / 2),
  ]
}
