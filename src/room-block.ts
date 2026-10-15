import { CHAR_WIDTH } from "./doorway/element-label"
import type { ExplicatedRoom } from "./room-explication"
import { PX_PER_CM } from "./types"
import type { Point, View } from "./types"

// Блок помещения (change add-room-explication, design D4): рамка из двух ячеек — номер и «H=…». Размеры задаются кеглем
// подписи: на холсте экранные пиксели (постоянные при любом масштабе просмотра), в PDF — миллиметры бумаги.

// помещение для показа блоком: точка привязки в координатах чертежа, номер и высота
export interface RoomBlock {
  at: Point
  number: number
  heightMm: number
}

export interface RoomBlockLayout {
  x: number
  y: number
  w: number
  h: number
  dividerX: number
  numberAt: Point
  heightAt: Point
}

const BLOCK_HEIGHT_EM = 2.4
const BLOCK_PAD_EM = 1.2
const textWidth = (text: string, fontPx: number): number => text.length * fontPx * CHAR_WIDTH

// раскладка блока с центром в center (единицы fontPx): ячейка номера не уже высоты блока, ячейка высоты по тексту
export function roomBlockLayout(center: Point, numberText: string, heightText: string, fontPx: number): RoomBlockLayout {
  const h = BLOCK_HEIGHT_EM * fontPx
  const numberW = Math.max(h, textWidth(numberText, fontPx) + BLOCK_PAD_EM * fontPx)
  const heightW = textWidth(heightText, fontPx) + BLOCK_PAD_EM * fontPx
  const x = center.x - (numberW + heightW) / 2
  const y = center.y - h / 2
  return {
    x,
    y,
    w: numberW + heightW,
    h,
    dividerX: x + numberW,
    numberAt: { x: x + numberW / 2, y: center.y },
    heightAt: { x: x + numberW + heightW / 2, y: center.y },
  }
}

// блоки по помещениям экспликации: в точке подписи помещения
export const roomBlocksOf = (items: readonly ExplicatedRoom[]): RoomBlock[] =>
  items.map((i) => ({ at: i.room.labelAt, number: i.record.number, heightMm: i.record.heightMm }))

export const blockTexts = (b: RoomBlock): { number: string; height: string } => ({ number: String(b.number), height: `H=${b.heightMm}` })

// номер блока под точкой чертежа или null; блоки лежат на экране фиксированного размера, поэтому сравнение — в экранных пикселях
export function roomBlockAt(p: Point, blocks: readonly RoomBlock[], view: View, fontPx: number): number | null {
  const k = PX_PER_CM * view.zoom
  const screen = { x: (p.x - view.pan.x) * k, y: (p.y - view.pan.y) * k }
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i]
    const t = blockTexts(b)
    const c = { x: (b.at.x - view.pan.x) * k, y: (b.at.y - view.pan.y) * k }
    const l = roomBlockLayout(c, t.number, t.height, fontPx)
    if (screen.x >= l.x && screen.x <= l.x + l.w && screen.y >= l.y && screen.y <= l.y + l.h) return b.number
  }
  return null
}
