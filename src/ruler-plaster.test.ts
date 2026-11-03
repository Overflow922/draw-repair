import { describe, expect, it } from "vitest"
import { ceilingScene } from "./ceiling/ceiling-scene"
import { electricalScene } from "./electrical/electrical-scene"
import { furnitureScene } from "./furniture/furniture-scene"
import { mountingScene } from "./mounting/mounting-scene"
import { plumbingScene } from "./plumbing/plumbing-scene"
import { reconstructionScene } from "./reconstruction/reconstruction-scene"
import { roughScene } from "./rough/rough-scene"
import { drawing, openingOn, plaster, rectWalls, reveal, wall } from "./rough/rough.test-utils"
import { rulerReading } from "./ruler"
import type { RulerReading } from "./ruler"
import { rulerPlasterOf } from "./ruler-objects"
import type { Drawing, EndPlasterMark, Point, Wall } from "./types"

// Тесты change ruler-plaster-layer (spec ruler-tool «Замер пролёта между гранями», «Замер стены по оси»;
// rough-works-plan «Линейка на плане «Черновые работы»»): линейка считает пролёт до поверхности штукатурки,
// а курсор над полосой даёт замер стены-хозяина. Числа выведены из спецификации, а не из реализации.
//
// Комната: оси прямоугольника (0,0)-(320,300), толщина 20 см; внутренние грани x ∈ [10, 310], y ∈ [10, 290].
// Обход: w1 верх, w2 право, w3 низ, w4 лево; грань +1 каждой стены смотрит внутрь комнаты.

const room = (): Wall[] => rectWalls("w", 0, 0, 320, 300)

const horizontal = (r: RulerReading): number | null => (r.kind === "space" ? (r.horizontal?.lengthCm ?? null) : null)
const vertical = (r: RulerReading): number | null => (r.kind === "space" ? (r.vertical?.lengthCm ?? null) : null)

const roughOf = (d: Drawing) => roughScene(d)
const measureAt = (d: Drawing, cursor: Point): RulerReading => {
  const s = roughOf(d)
  return rulerReading(cursor, s.base.walls, [], rulerPlasterOf(s.pieces))
}

const bothSides = (): Drawing =>
  drawing({ walls: room(), roughPlaster: [plaster("pl", "w4", 1, "b", 0, 300), plaster("pr", "w2", 1, "a", 0, 300)] })

describe("линейка с учётом штукатурки: пролёт", () => {
  it("RPL-1: штукатурка 20 мм на обеих стенах — пролёт 296 см вместо 300", () => {
    expect(horizontal(measureAt(bothSides(), { x: 160, y: 150 }))).toBeCloseTo(296, 6)
  })

  it("RPL-2: без штукатурки пролёт 300 см", () => {
    expect(horizontal(measureAt(drawing({ walls: room() }), { x: 160, y: 150 }))).toBeCloseTo(300, 6)
  })

  it("RPL-3: штукатурка только на участке 0–200 от верха левой стены — 298 в участке, 300 вне его", () => {
    const d = drawing({ walls: room(), roughPlaster: [plaster("pl", "w4", 1, "b", 0, 200)] })
    expect(horizontal(measureAt(d, { x: 160, y: 100 }))).toBeCloseTo(298, 6)
    expect(horizontal(measureAt(d, { x: 160, y: 250 }))).toBeCloseTo(300, 6)
  })

  it("RPL-4: вертикальный пролёт тоже идёт до штукатурки на верхней и нижней стенах", () => {
    const d = drawing({ walls: room(), roughPlaster: [plaster("pt", "w1", 1, "a", 0, 320), plaster("pb", "w3", 1, "a", 0, 320)] })
    expect(vertical(measureAt(d, { x: 160, y: 150 }))).toBeCloseTo(276, 6)
  })

  it("RPL-5: торцевая штукатурка перегородки останавливает луч у своей поверхности", () => {
    const partition = wall("p", 160, 0, 160, 150)
    const end: EndPlasterMark = { id: "pe", wallId: "p", face: "end", anchor: "b", thicknessMm: 20 }
    const withEnd = drawing({ walls: [...room(), partition], roughPlaster: [end] })
    const without = drawing({ walls: [...room(), partition] })
    expect(vertical(measureAt(without, { x: 160, y: 250 }))).toBeCloseTo(140, 6)
    expect(vertical(measureAt(withEnd, { x: 160, y: 250 }))).toBeCloseTo(138, 6)
  })

  it("RPL-6: откос проёма пролёт не меняет", () => {
    const opening = openingOn("o", "w2", 100, 100)
    const withReveal = drawing({ walls: room(), doorways: [opening], roughPlaster: [reveal("r", "o", "a")] })
    const without = drawing({ walls: room(), doorways: [opening] })
    expect(horizontal(measureAt(withReveal, { x: 160, y: 150 }))).toBeCloseTo(horizontal(measureAt(without, { x: 160, y: 150 })) ?? NaN, 6)
  })

  it("RPL-7: стяжка не препятствие", () => {
    const d = drawing({ walls: room(), roughScreeds: [{ id: "s", at: { x: 60, y: 150 }, thicknessMm: 50 }] })
    expect(horizontal(measureAt(d, { x: 160, y: 150 }))).toBeCloseTo(300, 6)
  })

  it("RPL-8: удалённая штукатурка не учитывается", () => {
    const d = drawing({ walls: room(), roughPlaster: [] })
    expect(horizontal(measureAt(d, { x: 160, y: 150 }))).toBeCloseTo(300, 6)
  })
})

describe("линейка с учётом штукатурки: курсор над полосой", () => {
  const onTop = (): Drawing => drawing({ walls: room(), roughPlaster: [plaster("pt", "w1", 1, "a", 0, 320)] })

  it("RPL-9: курсор в полосе (y ∈ [10, 12]) — замер оси стены-хозяина", () => {
    const r = measureAt(onTop(), { x: 160, y: 11 })
    expect(r.kind).toBe("wall")
    if (r.kind !== "wall") return
    expect(r.wall.id.startsWith("w1")).toBe(true)
    expect(r.lengthCm).toBeCloseTo(320, 6)
  })

  it("RPL-11: курсор в комнате за полосой (y = 13) — пролёт, а не замер стены", () => {
    expect(measureAt(onTop(), { x: 160, y: 13 }).kind).toBe("space")
  })

  it("RPL-12: стена главнее полосы: курсор в теле стены даёт замер этой стены", () => {
    const r = measureAt(onTop(), { x: 160, y: 5 })
    expect(r.kind === "wall" && r.wall.id.startsWith("w1")).toBe(true)
  })
})

describe("линейка с учётом штукатурки: каждый план, где она нарисована", () => {
  const d = bothSides()
  const at = { x: 160, y: 150 }
  const span = (walls: readonly Wall[], pieces: Parameters<typeof rulerPlasterOf>[0]): number | null =>
    horizontal(rulerReading(at, [...walls], [], rulerPlasterOf(pieces)))

  it("RPL-13: «Черновые работы» — 296", () => {
    const s = roughScene(d)
    expect(span(s.base.walls, s.pieces)).toBeCloseTo(296, 6)
  })

  it("RPL-14: «Реконструкция» — 296", () => {
    const s = reconstructionScene(d)
    expect(span(s.underlay, s.pieces)).toBeCloseTo(296, 6)
  })

  it("RPL-15: «Мебель» — 296", () => {
    const s = furnitureScene(d)
    expect(span(s.base.underlay, s.base.pieces)).toBeCloseTo(296, 6)
  })

  it("RPL-16: «Сантехника» — 296", () => {
    const s = plumbingScene(d)
    expect(span(s.base.underlay, s.base.pieces)).toBeCloseTo(296, 6)
  })

  it("RPL-17: «Потолок» — 296", () => {
    const s = ceilingScene(d)
    expect(span(s.base.underlay, s.base.pieces)).toBeCloseTo(296, 6)
  })

  it("RPL-18: «Электрика» — 296", () => {
    const s = electricalScene(d)
    expect(span(s.base.underlay, s.base.pieces)).toBeCloseTo(296, 6)
  })

  it("RPL-19: «Монтаж» штукатурки не имеет — 300", () => {
    expect(span(mountingScene(d).walls, [])).toBeCloseTo(300, 6)
  })
})

describe("полосы штукатурки для линейки", () => {
  it("RPL-20: откос в полосы не попадает, торцевая и боковая — попадают", () => {
    const partition = wall("p", 160, 0, 160, 150)
    const end: EndPlasterMark = { id: "pe", wallId: "p", face: "end", anchor: "b", thicknessMm: 20 }
    const opening = openingOn("o", "w2", 100, 100)
    const d = drawing({ walls: [...room(), partition], doorways: [opening], roughPlaster: [plaster("ps", "w4", 1, "b", 0, 300), end, reveal("r", "o", "a")] })
    const strips = rulerPlasterOf(roughScene(d).pieces)
    expect(strips).toHaveLength(2)
    expect(strips.map((s) => s.hostId.split("~")[0]).sort()).toEqual(["p", "w4"])
  })
})
