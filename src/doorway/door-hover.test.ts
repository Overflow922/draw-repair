import { describe, expect, it } from "vitest"
import { PDF_METRICS, drawScene } from "../render"
import type { RenderOptions } from "../render"
import type { Point, Wall } from "../types"
import { editableNumbers } from "./editable-numbers"
import { createSelectionEditing } from "./doorway-tool"
import { doorZoneAt } from "./doorway-layout"
import { VIEW, onSegment, sceneF, toScreen } from "./doorway.test-utils"
import type { Op, StrokeOp } from "./doorway.test-utils"
import { DR, arcPointAt, expectedLeaf } from "./door.test-utils"
import type { Hinge, Swing } from "./door.test-utils"
import { win } from "./window.test-utils"
import { dashRecorder, fakeHost } from "./selection-editing.test-utils"

// change deselect-tool-on-element-select: наведение на тень направления выделенной двери делает её штриховой
// контур сплошным (spec door «Направление выделенной двери»; design D7). Дверь a/left на стене W (0,0)→(500,0),
// толщина 20, привязка a, 100 см, ширина 90.

describe("hoverDirection: направление под курсором", () => {
  const setup = (selected: ReturnType<typeof DR>[] = [DR("a", "left")], o: { othersSelected?: boolean } = {}) => {
    const { walls } = sceneF()
    const host = fakeHost(walls, [DR("a", "left")], selected, o)
    return { host, walls, editing: createSelectionEditing(host) }
  }

  it("HV-1: в зоне альтернативного направления — это направление (прямоугольник, сектор, полотно)", () => {
    const { editing } = setup()
    expect(editing.hoverDirection({ x: 170, y: 40 })).toEqual({ hinge: "b", swing: "right" })
    expect(editing.hoverDirection({ x: 97, y: 70 })).toEqual({ hinge: "a", swing: "right" })
    expect(editing.hoverDirection({ x: 197, y: 50 })).toEqual({ hinge: "b", swing: "right" })
    expect(editing.hoverDirection({ x: 170, y: -40 })).toEqual({ hinge: "b", swing: "left" })
  })

  it("HV-2: вне зон, в зоне текущего направления и в теле стены — нет подсветки", () => {
    const { editing } = setup()
    expect(editing.hoverDirection({ x: 170, y: 120 })).toBeNull()
    expect(editing.hoverDirection({ x: 120, y: -60 })).toBeNull()
    expect(editing.hoverDirection({ x: 97, y: -70 })).toBeNull() // сектор текущего направления
    expect(editing.hoverDirection({ x: 145, y: 0 })).toBeNull()
  })

  it("HV-3: правимое число главнее зоны — нет подсветки", () => {
    const { host, walls, editing } = setup()
    const d = DR("a", "left")
    const width = editableNumbers(d, walls, host.elements(), [], "cm", 2, 14).find((n) => n.target.kind === "width")
    expect(width).toBeDefined()
    const c = width?.center as Point
    expect(doorZoneAt(c, d, walls), "число лежит в зоне").not.toBeNull()
    expect(editing.hoverDirection(c)).toBeNull()
  })

  it("HV-4: ничего не выделено, окно, выделено не одно или выделены другие объекты — нет подсветки", () => {
    const p = { x: 170, y: 40 }
    expect(setup([]).editing.hoverDirection(p)).toBeNull()
    expect(setup([DR("a", "left"), { ...DR("a", "left"), id: "q", offsetCm: 300 }]).editing.hoverDirection(p)).toBeNull()
    expect(setup([DR("a", "left")], { othersSelected: true }).editing.hoverDirection(p)).toBeNull()
    const { walls } = sceneF()
    const w = win("W", "a", 100)
    const host = fakeHost(walls, [w], [w])
    expect(createSelectionEditing(host).hoverDirection(p)).toBeNull()
  })

  it("HV-5: запрос ничего не меняет — ни элементы, ни выделение, ни историю", () => {
    const { host, editing } = setup()
    const elements = [...host.state.elements]
    const selected = [...host.state.selected]
    editing.hoverDirection({ x: 170, y: 40 })
    expect(host.state.elements).toEqual(elements)
    expect(host.state.selected).toEqual(selected)
    expect(host.state.records).toBe(0)
    expect(host.state.inherited).toEqual([])
  })
})

describe("отрисовка подсветки направления", () => {
  const S = (p: Point): Point => toScreen(p, VIEW)
  const lerp = (p: Point, q: Point, t: number): Point => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t })
  const ref = (h: Hinge, s: Swing) => expectedLeaf({ x: 0, y: 0 }, { x: 500, y: 0 }, 100, 190, 20, h, s, 90)
  const ALL: [Hinge, Swing][] = [
    ["a", "left"],
    ["b", "left"],
    ["a", "right"],
    ["b", "right"],
  ]

  function draw(walls: Wall[], opts: RenderOptions): { strokes: StrokeOp[]; dashed: StrokeOp[] } {
    const { ctx, ops, dashed } = dashRecorder()
    drawScene(ctx, 1600, 1200, walls, null, "cm", VIEW, [], { grid: false, ...opts })
    const dashedOps = new Set(dashed.map((d) => d.op))
    const isStroke = (o: Op): o is StrokeOp => o.kind === "stroke"
    return { strokes: ops.filter(isStroke).filter((o) => !dashedOps.has(o)), dashed: dashed.map((d) => d.op) }
  }

  // открытая сторона полотна (петля → открытый конец) лежит на одном из отрезков
  const leafIn = (strokes: StrokeOp[], h: Hinge, s: Swing): boolean => {
    const e = ref(h, s)
    const p = S(lerp(e.hinge, e.arcTo, 0.2))
    const q = S(lerp(e.hinge, e.arcTo, 0.8))
    return strokes.some((op) =>
      op.subpaths.some((sp) => {
        for (let i = 1; i < sp.length; i++) if (onSegment(p, [sp[i - 1], sp[i]], 0.6) && onSegment(q, [sp[i - 1], sp[i]], 0.6)) return true
        return false
      }),
    )
  }
  const arcIn = (strokes: StrokeOp[], h: Hinge, s: Swing): boolean => {
    const e = ref(h, s)
    return [20, 47.5, 80].every((deg) => {
      const p = S(arcPointAt(e, 90, deg))
      return strokes.some((op) =>
        op.subpaths.some((sp) => {
          for (let i = 1; i < sp.length; i++) if (onSegment(p, [sp[i - 1], sp[i]], 1)) return true
          return false
        }),
      )
    })
  }

  const { walls } = sceneF()
  const d = DR("a", "left")
  const base: RenderOptions = { doorways: [d], selectedDoorways: [d] }

  it("HV-6: направление под курсором — сплошное, остальные альтернативы — штриховые", () => {
    const { strokes, dashed } = draw(walls, { ...base, hoverDoorDirection: { hinge: "b", swing: "right" } })
    for (const [h, s] of ALL) {
      if (h === "a" && s === "left") continue
      const hovered = h === "b" && s === "right"
      expect(leafIn(strokes, h, s), `сплошное полотно ${h}/${s}`).toBe(hovered)
      expect(arcIn(strokes, h, s), `сплошная дуга ${h}/${s}`).toBe(hovered)
      expect(leafIn(dashed, h, s), `штриховое полотно ${h}/${s}`).toBe(!hovered)
      expect(arcIn(dashed, h, s), `штриховая дуга ${h}/${s}`).toBe(!hovered)
    }
  })

  it("HV-6b: подсвеченным может быть любое из трёх направлений", () => {
    for (const [h, s] of ALL) {
      if (h === "a" && s === "left") continue
      const { strokes, dashed } = draw(walls, { ...base, hoverDoorDirection: { hinge: h, swing: s } })
      expect(leafIn(strokes, h, s), `${h}/${s}`).toBe(true)
      expect(leafIn(dashed, h, s), `${h}/${s}`).toBe(false)
    }
  })

  it("HV-7: без подсветки все три альтернативы штриховые, сплошных нет", () => {
    for (const opts of [base, { ...base, hoverDoorDirection: null }]) {
      const { strokes, dashed } = draw(walls, opts)
      for (const [h, s] of ALL) {
        if (h === "a" && s === "left") continue
        expect(leafIn(dashed, h, s), `штрих ${h}/${s}`).toBe(true)
        expect(leafIn(strokes, h, s), `сплошное ${h}/${s}`).toBe(false)
      }
    }
  })

  it("HV-7b: у невыделенной двери, при мультивыделении и в PDF подсветка ничего не рисует", () => {
    const q = { ...d, id: "q", offsetCm: 300 }
    const hover = { hinge: "b", swing: "right" } as const
    const cases: RenderOptions[] = [
      { doorways: [d], hoverDoorDirection: hover },
      { doorways: [d, q], selectedDoorways: [d, q], hoverDoorDirection: hover },
      { ...base, metrics: PDF_METRICS, hoverDoorDirection: hover },
    ]
    for (const opts of cases) {
      const { strokes, dashed } = draw(walls, opts)
      expect(dashed.length, "штриховых нет").toBe(0)
      expect(leafIn(strokes, "b", "right"), "чужое полотно не рисуется").toBe(false)
    }
  })
})
