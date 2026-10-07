import { describe, expect, it } from "vitest"
import { PDF_METRICS, drawScene } from "../render"
import type { RenderOptions } from "../render"
import { LIGHT_PALETTE } from "../theme"
import type { Point, Wall } from "../types"
import { D0, VIEW, door, onSegment, sceneF, sceneR, texts, toScreen } from "./doorway.test-utils"
import type { TextOp } from "./doorway.test-utils"
import { DR, arcPointAt, expectedLeaf } from "./door.test-utils"
import type { Hinge, Swing } from "./door.test-utils"
import { win } from "./window.test-utils"
import { CHAR_PX, dashRecorder, dashedNear, underlineOf } from "./selection-editing.test-utils"
import type { DashedStroke } from "./selection-editing.test-utils"

// change popups-buttons-only: штриховое подчёркивание правимых чисел выделенного элемента и штриховые
// альтернативные направления выделенной двери (spec doorway «Ввод чисел размеров проёма», window «Правка
// подписи окна», door «Направление выделенной двери»; design D2, D6). Горизонтальная стена: направление
// текста (1, 0), «вниз» текста — +y экрана.

const RIGHT: Point = { x: 1, y: 0 }

function draw(walls: Wall[], opts: RenderOptions): { textOps: TextOp[]; dashed: DashedStroke[] } {
  const { ctx, ops, dashed } = dashRecorder()
  drawScene(ctx, 1600, 1200, walls, null, "cm", VIEW, [], { grid: false, ...opts })
  return { textOps: texts(ops), dashed }
}

const isNumber = (t: TextOp): boolean => /^\d+$/.test(t.text)
// центр числа в подписи «H=…» (текст по центру): правее центра подписи на число символов префикса и цифр
const heightCenter = (t: TextOp): Point => ({ x: t.at.x + ((2 + (t.text.length - 2) / 2) - t.text.length / 2) * CHAR_PX, y: t.at.y })

describe("подчёркивание правимых чисел", () => {
  it("PB-RN-01: выделенный проём — подчёркнуты шесть чисел цепочек и число подписи", () => {
    const { walls } = sceneR()
    const d = D0()
    const { textOps, dashed } = draw(walls, { doorways: [d], selectedDoorways: [d] })
    const chain = textOps.filter(isNumber)
    expect(chain.map((t) => t.text).sort()).toEqual(["110", "300", "320", "90", "90", "90"])
    for (const t of chain) expect(underlineOf(dashed, t.at, t.text.length, RIGHT), `${t.text} @${t.at.x},${t.at.y}`).toBe(true)
    const h = textOps.find((t) => t.text === "H=210")
    expect(h).toBeDefined()
    if (h) expect(underlineOf(dashed, heightCenter(h), 3, RIGHT)).toBe(true)
  })

  it("PB-RN-01b: нулевое расстояние — «0» подчёркнут", () => {
    const { walls } = sceneR()
    const d = door("W", "a", 10)
    const { textOps, dashed } = draw(walls, { doorways: [d], selectedDoorways: [d] })
    const zero = textOps.find((t) => t.text === "0")
    expect(zero).toBeDefined()
    if (zero) expect(dashedNear(dashed, { x: zero.at.x, y: zero.at.y + 8 }, 10)).toBe(true)
  })

  it("PB-RN-02: призрак с цепочкой без выделения — подчёркиваний нет", () => {
    const { walls } = sceneF()
    const placed = door("W", "a", 300, 90, 210, "p")
    const { textOps, dashed } = draw(walls, { doorways: [placed], doorwayGhost: D0() })
    expect(textOps.filter(isNumber).length).toBeGreaterThan(0)
    for (const t of textOps) expect(dashedNear(dashed, t.at, 14), t.text).toBe(false)
  })

  it("PB-RN-03: мультивыделение двух проёмов — подписи не подчёркнуты", () => {
    const { walls } = sceneF()
    const p = door("W", "a", 50, 90, 210, "p")
    const q = door("W", "a", 300, 90, 210, "q")
    const { textOps, dashed } = draw(walls, { doorways: [p, q], selectedDoorways: [p, q] })
    const labels = textOps.filter((t) => t.text === "H=210")
    expect(labels).toHaveLength(2)
    for (const t of labels) expect(dashedNear(dashed, t.at, 20)).toBe(false)
  })

  it("PB-RN-03b: выделение проёма вместе со стеной — подчёркиваний нет", () => {
    const { walls, W } = sceneF()
    const d = D0()
    const { ctx, ops, dashed } = dashRecorder()
    drawScene(ctx, 1600, 1200, walls, null, "cm", VIEW, [W], { grid: false, doorways: [d], selectedDoorways: [d] })
    const h = texts(ops).find((t) => t.text === "H=210")
    expect(h).toBeDefined()
    if (h) expect(dashedNear(dashed, h.at, 20)).toBe(false)
  })

  it("PB-RN-04: метрики PDF — подпись есть, подчёркивания нет даже при выделении", () => {
    const { walls } = sceneF()
    const d = D0()
    const { textOps, dashed } = draw(walls, { doorways: [d], selectedDoorways: [d], metrics: PDF_METRICS })
    const h = textOps.find((t) => t.text === "H=210")
    expect(h).toBeDefined()
    if (h) expect(dashedNear(dashed, h.at, 10)).toBe(false)
  })

  it("PB-RN-06: выделенное окно — подчёркнуты «150» и «85» по отдельности", () => {
    const { walls } = sceneF()
    const x = win("W", "a", 100)
    const { textOps, dashed } = draw(walls, { doorways: [x], selectedDoorways: [x] })
    const h = textOps.find((t) => t.text === "H=150")
    const s = textOps.find((t) => t.text === "H под.=85")
    expect(h && s).toBeTruthy()
    if (!h || !s) return
    // части подписи окна начинаются в точке текста (выравнивание влево)
    expect(underlineOf(dashed, { x: h.at.x + 3.5 * CHAR_PX, y: h.at.y }, 3, RIGHT)).toBe(true)
    expect(underlineOf(dashed, { x: s.at.x + 8 * CHAR_PX, y: s.at.y }, 2, RIGHT)).toBe(true)
    // цвет подчёркивания — цвет числа: «150» — чернила, «85» — синий цвет подоконника
    const byColor = (color: string): DashedStroke[] => dashed.filter((d) => d.op.strokeStyle === color)
    expect(underlineOf(byColor(LIGHT_PALETTE.ink), { x: h.at.x + 3.5 * CHAR_PX, y: h.at.y }, 3, RIGHT)).toBe(true)
    expect(underlineOf(byColor(LIGHT_PALETTE.sill), { x: s.at.x + 8 * CHAR_PX, y: s.at.y }, 2, RIGHT)).toBe(true)
    expect(underlineOf(byColor(LIGHT_PALETTE.ink), { x: s.at.x + 8 * CHAR_PX, y: s.at.y }, 2, RIGHT)).toBe(false)
    // префиксы не подчёркнуты: под «H=» и «H под.=» штриха нет
    expect(underlineOf(dashed, { x: h.at.x + 1 * CHAR_PX, y: h.at.y }, 2, RIGHT)).toBe(false)
    expect(underlineOf(dashed, { x: s.at.x + 3.5 * CHAR_PX, y: s.at.y }, 7, RIGHT)).toBe(false)
  })
})

describe("альтернативные направления двери", () => {
  const S = (p: Point): Point => toScreen(p, VIEW)
  const lerp = (p: Point, q: Point, t: number): Point => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t })
  const ref = (h: Hinge, s: Swing) => expectedLeaf({ x: 0, y: 0 }, { x: 500, y: 0 }, 100, 190, 20, h, s, 90)
  // открытая сторона полотна (петля → открытый конец) нарисована штриховой линией
  const dashedLeaf = (dashed: DashedStroke[], h: Hinge, s: Swing): boolean => {
    const e = ref(h, s)
    const p = S(lerp(e.hinge, e.arcTo, 0.2))
    const q = S(lerp(e.hinge, e.arcTo, 0.8))
    return dashed.some(({ op }) =>
      op.subpaths.some((sp) => {
        for (let i = 1; i < sp.length; i++) if (onSegment(p, [sp[i - 1], sp[i]], 0.6) && onSegment(q, [sp[i - 1], sp[i]], 0.6)) return true
        return false
      }),
    )
  }
  // дуга открывания нарисована штриховой линией: точки на 20°, 47.5° и 80° от закрытого положения лежат на
  // штриховых отрезках (дуга контекста записывается ломаной из 16 хорд — dashRecorder)
  const dashedArc = (dashed: DashedStroke[], h: Hinge, s: Swing): boolean => {
    const e = ref(h, s)
    return [20, 47.5, 80].every((deg) => {
      const p = S(arcPointAt(e, 90, deg))
      return dashed.some(({ op }) =>
        op.subpaths.some((sp) => {
          for (let i = 1; i < sp.length; i++) if (onSegment(p, [sp[i - 1], sp[i]], 1)) return true
          return false
        }),
      )
    })
  }
  const ALL: [Hinge, Swing][] = [
    ["a", "left"],
    ["b", "left"],
    ["a", "right"],
    ["b", "right"],
  ]

  it("PB-RN-05: у выделенной двери a/left штриховые полотна трёх других направлений, текущего — нет", () => {
    const { walls } = sceneF()
    const d = DR("a", "left")
    const { dashed } = draw(walls, { doorways: [d], selectedDoorways: [d] })
    for (const [h, s] of ALL) {
      const alt = !(h === "a" && s === "left")
      expect(dashedLeaf(dashed, h, s), `полотно ${h}/${s}`).toBe(alt)
      expect(dashedArc(dashed, h, s), `дуга ${h}/${s}`).toBe(alt)
    }
  })

  it("PB-RN-05b: альтернативы следуют за текущим направлением (b/right)", () => {
    const { walls } = sceneF()
    const d = DR("b", "right")
    const { dashed } = draw(walls, { doorways: [d], selectedDoorways: [d] })
    for (const [h, s] of ALL) {
      const alt = !(h === "b" && s === "right")
      expect(dashedLeaf(dashed, h, s), `полотно ${h}/${s}`).toBe(alt)
      expect(dashedArc(dashed, h, s), `дуга ${h}/${s}`).toBe(alt)
    }
  })

  it("PB-RN-05c: у невыделенной двери, при мультивыделении и в PDF альтернатив нет", () => {
    const { walls } = sceneF()
    const d = DR("a", "left")
    const other = DR("a", "left")
    const q = { ...other, id: "q", offsetCm: 300 }
    const cases: RenderOptions[] = [
      { doorways: [d] },
      { doorways: [d, q], selectedDoorways: [d, q] },
      { doorways: [d], selectedDoorways: [d], metrics: PDF_METRICS },
    ]
    for (const opts of cases) {
      const { dashed } = draw(walls, opts)
      for (const [h, s] of ALL) {
        expect(dashedLeaf(dashed, h, s), `полотно ${h}/${s}`).toBe(false)
        expect(dashedArc(dashed, h, s), `дуга ${h}/${s}`).toBe(false)
      }
    }
  })
})
