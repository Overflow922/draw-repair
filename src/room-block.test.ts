import { describe, expect, it } from "vitest"
import { PDF_METRICS, SCREEN_METRICS, drawScene } from "./render"
import type { RenderOptions } from "./render"
import { blockTexts, roomBlockAt, roomBlockLayout } from "./room-block"
import type { RoomBlock } from "./room-block"
import { recordingContext, sceneR, sceneRP } from "./room-area.test-utils"
import type { DrawOp, StrokeOp, TextOp } from "./room-area.test-utils"
import type { Point, RoomRecord, View } from "./types"
import { PX_PER_CM } from "./types"

// Тесты change add-room-explication: блок помещения на холсте (spec room-explication «Блок помещения на холсте»,
// «Выделение и редактирование блока»). sceneR — одно помещение, центр (210, 160).

const VIEW: View = { zoom: 1, pan: { x: -50, y: -50 } }
const CENTER: Point = { x: 210, y: 160 }
const SELECTION = "rgba(8, 145, 178, 0.5)"

const toScreen = (p: Point, view: View = VIEW): Point => {
  const k = PX_PER_CM * view.zoom
  return { x: (p.x - view.pan.x) * k, y: (p.y - view.pan.y) * k }
}

const record = (number: number, anchor: Point, heightMm = 3000, name = ""): RoomRecord => ({ number, name, heightMm, anchor })

function draw(walls = sceneR(), opts: RenderOptions = {}, view: View = VIEW): DrawOp[] {
  const { ctx, ops } = recordingContext()
  drawScene(ctx, 1200, 900, walls, null, "mm", view, [], opts)
  return ops
}

const texts = (ops: DrawOp[]): TextOp[] => ops.filter((o): o is TextOp => o.kind === "fillText")

// рамка блока: последняя обводка цветом чернил четырёхугольником (контуры стен — не четырёхугольники из одного подпути)
const blockFill = (ops: DrawOp[]): StrokeOp | undefined =>
  ops.filter((o): o is StrokeOp => o.kind === "stroke" && o.strokeStyle === "#333" && o.subpaths.length === 1 && o.subpaths[0].length === 4).pop()

// блок ничего не закрашивает: после стен нет заливки бумажным цветом, меньшей помещения
const paperFillsAfterWalls = (ops: DrawOp[]): number =>
  ops.filter((o) => o.kind === "fill" && o.fillStyle.trim().toLowerCase() === "#fff" && o.subpaths.length === 1 && o.subpaths[0].length === 4).length

const bounds = (pts: Point[]): { min: Point; max: Point } => ({
  min: { x: Math.min(...pts.map((p) => p.x)), y: Math.min(...pts.map((p) => p.y)) },
  max: { x: Math.max(...pts.map((p) => p.x)), y: Math.max(...pts.map((p) => p.y)) },
})

describe("блок помещения — раскладка", () => {
  it("блок центрирован в точке, ячейка номера не уже высоты блока", () => {
    const l = roomBlockLayout({ x: 100, y: 50 }, "2", "H=2923", 14)
    expect(l.x + l.w / 2).toBeCloseTo(100, 6)
    expect(l.y + l.h / 2).toBeCloseTo(50, 6)
    expect(l.dividerX - l.x).toBeGreaterThanOrEqual(l.h - 1e-9)
    expect(l.numberAt.x).toBeCloseTo((l.x + l.dividerX) / 2, 6)
    expect(l.heightAt.x).toBeCloseTo((l.dividerX + l.x + l.w) / 2, 6)
  })

  it("длинная высота и многозначный номер расширяют ячейки", () => {
    const small = roomBlockLayout({ x: 0, y: 0 }, "1", "H=3000", 14)
    const big = roomBlockLayout({ x: 0, y: 0 }, "123456", "H=99999", 14)
    expect(big.w).toBeGreaterThan(small.w)
    expect(big.h).toBe(small.h)
  })

  it("размер блока пропорционален кеглю", () => {
    const a = roomBlockLayout({ x: 0, y: 0 }, "1", "H=3000", 14)
    const b = roomBlockLayout({ x: 0, y: 0 }, "1", "H=3000", 28)
    expect(b.w).toBeCloseTo(a.w * 2, 6)
    expect(b.h).toBeCloseTo(a.h * 2, 6)
  })

  it("тексты блока: номер и «H=» с целыми миллиметрами", () => {
    expect(blockTexts({ at: CENTER, number: 2, heightMm: 2923 })).toEqual({ number: "2", height: "H=2923" })
  })
})

describe("блок помещения — отрисовка на холсте", () => {
  it("помещение с данными рисуется блоком: номер слева, высота справа, подписи площади нет", () => {
    const ops = draw(sceneR(), { roomRecords: [record(2, CENTER, 2923)] })
    const t = texts(ops)
    const number = t.find((o) => o.text === "2")
    const height = t.find((o) => o.text === "H=2923")
    expect(number).toBeDefined()
    expect(height).toBeDefined()
    expect(number!.at.x).toBeLessThan(height!.at.x)
    expect(t.some((o) => o.text.endsWith("м²"))).toBe(false)
  })

  it("без данных помещений на плане остаётся подпись площади и нет блоков", () => {
    const t = texts(draw(sceneR()))
    expect(t.some((o) => o.text === "12,00 м²")).toBe(true)
    expect(t.some((o) => o.text.startsWith("H="))).toBe(false)
  })

  it("блок стоит в центре помещения", () => {
    const fill = blockFill(draw(sceneR(), { roomRecords: [] }))
    expect(fill).toBeDefined()
    const b = bounds(fill!.subpaths[0])
    const c = toScreen(CENTER)
    expect((b.min.x + b.max.x) / 2).toBeCloseTo(c.x, 3)
    expect((b.min.y + b.max.y) / 2).toBeCloseTo(c.y, 3)
  })

  it("блок не закрывает стены: заливок бумажным цветом, кроме заливки помещения, нет", () => {
    expect(paperFillsAfterWalls(draw(sceneR(), { roomRecords: [] }))).toBe(paperFillsAfterWalls(draw(sceneR())))
  })

  it("новое помещение без записи получает номер 1 и высоту 3000", () => {
    const t = texts(draw(sceneR(), { roomRecords: [] }))
    expect(t.some((o) => o.text === "1")).toBe(true)
    expect(t.some((o) => o.text === "H=3000")).toBe(true)
  })

  it("два помещения — два блока со своими номерами", () => {
    const records = [record(1, { x: 100, y: 160 }), record(2, { x: 300, y: 160 }, 2700)]
    const t = texts(draw(sceneRP(), { roomRecords: records }))
    expect(t.filter((o) => o.text.startsWith("H=")).map((o) => o.text).sort()).toEqual(["H=2700", "H=3000"])
    expect(t.some((o) => o.text === "1")).toBe(true)
    expect(t.some((o) => o.text === "2")).toBe(true)
  })

  it("размер блока на экране не зависит от масштаба просмотра", () => {
    const sizeAt = (zoom: number): { w: number; h: number } => {
      const view: View = { zoom, pan: { x: -50, y: -50 } }
      const fill = blockFill(draw(sceneR(), { roomRecords: [] }, view))
      const b = bounds(fill!.subpaths[0])
      return { w: b.max.x - b.min.x, h: b.max.y - b.min.y }
    }
    expect(sizeAt(2).w).toBeCloseTo(sizeAt(1).w, 6)
    expect(sizeAt(0.5).h).toBeCloseTo(sizeAt(1).h, 6)
  })

  it("центр блока следует за точкой помещения при масштабе просмотра", () => {
    const view: View = { zoom: 2, pan: { x: -50, y: -50 } }
    const b = bounds(blockFill(draw(sceneR(), { roomRecords: [] }, view))!.subpaths[0])
    const c = toScreen(CENTER, view)
    expect((b.min.x + b.max.x) / 2).toBeCloseTo(c.x, 3)
  })

  it("кегль блока в PDF — по метрикам PDF", () => {
    const t = texts(draw(sceneR(), { roomRecords: [], metrics: PDF_METRICS }))
    const h = t.find((o) => o.text === "H=3000")
    expect(h?.font).toContain(`${PDF_METRICS.labelPx}px`)
  })

  it("кегль блока на холсте — по экранным метрикам", () => {
    const t = texts(draw(sceneR(), { roomRecords: [] }))
    expect(t.find((o) => o.text === "H=3000")?.font).toContain(`${SCREEN_METRICS.labelPx}px`)
  })

  it("выделенный блок обведён цветом выделения, невыделенный — нет", () => {
    const strokes = (ops: DrawOp[]): number => ops.filter((o) => o.kind === "stroke" && o.strokeStyle === SELECTION).length
    const plain = strokes(draw(sceneR(), { roomRecords: [record(1, CENTER)] }))
    const selected = strokes(draw(sceneR(), { roomRecords: [record(1, CENTER)], selectedRoom: 1 }))
    expect(selected).toBe(plain + 1)
  })

  it("выделение другого номера блок не обводит", () => {
    const strokes = (ops: DrawOp[]): number => ops.filter((o) => o.kind === "stroke" && o.strokeStyle === SELECTION).length
    expect(strokes(draw(sceneR(), { roomRecords: [record(1, CENTER)], selectedRoom: 9 }))).toBe(strokes(draw(sceneR(), { roomRecords: [record(1, CENTER)] })))
  })

  it("помещения меньше 1 м² блока не получают", () => {
    const tiny = [
      { id: "t1", a: { x: 0, y: 0 }, b: { x: 110, y: 0 }, thicknessCm: 20, type: "brick" as const },
      { id: "t2", a: { x: 110, y: 0 }, b: { x: 110, y: 110 }, thicknessCm: 20, type: "brick" as const },
      { id: "t3", a: { x: 110, y: 110 }, b: { x: 0, y: 110 }, thicknessCm: 20, type: "brick" as const },
      { id: "t4", a: { x: 0, y: 110 }, b: { x: 0, y: 0 }, thicknessCm: 20, type: "brick" as const },
    ]
    const t = texts(draw(tiny, { roomRecords: [] }))
    expect(t.some((o) => o.text.startsWith("H="))).toBe(false)
  })
})

describe("блок помещения — попадание курсора", () => {
  const blocks: RoomBlock[] = [{ at: CENTER, number: 3, heightMm: 3000 }]

  it("точка внутри блока — номер помещения", () => {
    expect(roomBlockAt(CENTER, blocks, VIEW, 14)).toBe(3)
  })

  it("точка вне блока — null", () => {
    expect(roomBlockAt({ x: CENTER.x + 400, y: CENTER.y }, blocks, VIEW, 14)).toBeNull()
  })

  it("граница блока по высоте: выше верхней кромки — мимо, чуть ниже — попадание", () => {
    const l = roomBlockLayout(toScreen(CENTER), "3", "H=3000", 14)
    const k = PX_PER_CM
    const worldY = (screenY: number): number => screenY / k + VIEW.pan.y
    const x = CENTER.x
    expect(roomBlockAt({ x, y: worldY(l.y - 1) }, blocks, VIEW, 14)).toBeNull()
    expect(roomBlockAt({ x, y: worldY(l.y + 1) }, blocks, VIEW, 14)).toBe(3)
    expect(roomBlockAt({ x, y: worldY(l.y + l.h + 1) }, blocks, VIEW, 14)).toBeNull()
  })

  it("размер области попадания не зависит от масштаба просмотра", () => {
    const view: View = { zoom: 4, pan: { x: 100, y: 100 } }
    const l = roomBlockLayout(toScreen(CENTER, view), "3", "H=3000", 14)
    const k = PX_PER_CM * view.zoom
    const worldX = (screenX: number): number => screenX / k + view.pan.x
    const y = CENTER.y
    expect(roomBlockAt({ x: worldX(l.x + l.w + 1), y }, blocks, view, 14)).toBeNull()
    expect(roomBlockAt({ x: worldX(l.x + l.w - 1), y }, blocks, view, 14)).toBe(3)
  })

  it("при наложении блоков выбирается верхний (нарисованный последним)", () => {
    const two: RoomBlock[] = [
      { at: CENTER, number: 1, heightMm: 3000 },
      { at: CENTER, number: 2, heightMm: 3000 },
    ]
    expect(roomBlockAt(CENTER, two, VIEW, 14)).toBe(2)
  })
})
