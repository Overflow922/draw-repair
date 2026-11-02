import { describe, expect, it } from "vitest"
import { dimLevelSnap, dimensionGeometry, dimPointPoint, measureDimension, nearestDimAnchor } from "../geometry"
import { cloneScene } from "../history"
import { reconstructionScene } from "../reconstruction/reconstruction-scene"
import { drawing, drywall } from "../reconstruction/reconstruction.test-utils"
import { isDimension } from "../storage"
import { visibleDimensions } from "../dimension-visibility"
import type { Dimension, SectionCornerPoint, SectionLine, SectionShape, ShapeCornerPoint } from "../types"
import { shapeCornerPosition, shapeCorners } from "./section-corners"

// change add-section-shapes: углы детали разреза как точки замера (spec dimension-tool «Точки замера на фигуре разреза»)
//
// фигура линии L1: стена (100,0)-(300,0), толщина 10, высота 250; крайние стены на y = -95 и y = 95 дают сечения s 0..10 и 190..200;
// линия x = 200, y -100..100, взгляд вправо: фигура правее габаритов, x = 400 + s, пол y = 100, z = 100 - y
//
//   s=0..10 сечение        деталь s 30..190, z 120..125 (полка)
//   +--+      +==========+   z = 125
//   |//|      +==========+   z = 120                          схематично, не в масштабе
const line: SectionLine = { id: "L1", label: "A", view: "right", points: [{ x: 200, y: -100 }, { x: 200, y: 100 }] }
const SHELF: SectionShape = { id: "p1", lineId: "L1", s0: 30, s1: 190, z0: 120, z1: 125 }
const build = (shapes: SectionShape[] = [SHELF]) =>
  reconstructionScene(
    drawing({
      walls: [],
      reconstruction: { walls: [drywall("W", 100, 0, 300, 0, 10, 250), drywall("E1", 100, -95, 300, -95, 10, 250), drywall("E2", 100, 95, 300, 95, 10, 250)], dimensions: [], sections: [line], sectionShapes: shapes },
    }),
  )
const entries = build().sections

const corner = (s: "lo" | "hi", z: "lo" | "hi"): ShapeCornerPoint => ({ kind: "shape", lineId: "L1", shapeId: "p1", at: { s, z } })
const dim = (from: ShapeCornerPoint | SectionCornerPoint, to: ShapeCornerPoint | SectionCornerPoint): Dimension => ({ from, to, offset: 10 })

describe("углы детали", () => {
  it("SH-1000: четыре угла прямоугольника в координатах чертежа", () => {
    expect(shapeCornerPosition(corner("lo", "lo"), entries)).toEqual({ x: 430, y: -20 })
    expect(shapeCornerPosition(corner("hi", "lo"), entries)).toEqual({ x: 590, y: -20 })
    expect(shapeCornerPosition(corner("hi", "hi"), entries)).toEqual({ x: 590, y: -25 })
    expect(shapeCornerPosition(corner("lo", "hi"), entries)).toEqual({ x: 430, y: -25 })
    expect(shapeCorners(entries)).toHaveLength(4)
  })

  it("SH-1001: нет линии или детали — угол не разрешается", () => {
    expect(shapeCornerPosition({ ...corner("lo", "lo"), lineId: "none" }, entries)).toBeNull()
    expect(shapeCornerPosition({ ...corner("lo", "lo"), shapeId: "none" }, entries)).toBeNull()
    expect(dimPointPoint(corner("lo", "lo"), [], [], [], [], [])).toBeNull()
  })

  it("SH-1002: привязка к ближайшему углу детали в радиусе, вне радиуса — нет", () => {
    expect(nearestDimAnchor({ x: 588, y: -26 }, [], [], 5, [], [], entries)?.anchor).toEqual(corner("hi", "hi"))
    expect(nearestDimAnchor({ x: 510, y: -22 }, [], [], 5, [], [], entries)).toBeNull()
  })

  it("SH-1003: угол детали совпадает с углом сечения — выигрывает ближайший, при равенстве — не меняется порядок", () => {
    // правый верхний угол детали (s = 190, z = 125) лежит у грани сечения s 190..200, но не на её углу: угол сечения (190, 250) далеко
    expect(nearestDimAnchor({ x: 590, y: -25 }, [], [], 3, [], [], entries)?.anchor).toEqual(corner("hi", "hi"))
  })
})

describe("число и ось", () => {
  it("SH-1004: ширина детали — между левым и правым нижними углами", () => {
    const m = measureDimension(dim(corner("lo", "lo"), corner("hi", "lo")), [], [], [], [], entries)
    expect(m?.valueCm).toBeCloseTo(160, 9)
    expect(m?.direction).toEqual({ x: 1, y: 0 })
  })

  it("SH-1005: высота детали — между нижним и верхним левыми углами", () => {
    const m = measureDimension(dim(corner("lo", "lo"), corner("lo", "hi")), [], [], [], [], entries)
    expect(m?.valueCm).toBeCloseTo(5, 9)
    expect(m?.direction).toEqual({ x: 0, y: -1 })
  })

  it("SH-1006: размер между деталью и сечением выбирает большую проекцию: 125 по z против 20 по s", () => {
    const wall: SectionCornerPoint = { kind: "section", lineId: "L1", wallId: "E1", segment: 0, at: { s: "hi", z: "top" } }
    const m = measureDimension(dim(corner("lo", "hi"), wall), [], [], [], [], entries)
    expect(m?.valueCm).toBeCloseTo(125, 9)
    expect(m?.direction).toEqual({ x: 0, y: -1 })
  })

  it("SH-1006a: размер между двумя деталями на одной высоте — по горизонтали, 30", () => {
    const other: SectionShape = { id: "p2", lineId: "L1", s0: 120, s1: 190, z0: 120, z1: 125 }
    const two = build([{ ...SHELF, s1: 90 }, other]).sections
    const right: ShapeCornerPoint = { kind: "shape", lineId: "L1", shapeId: "p1", at: { s: "hi", z: "hi" } }
    const left: ShapeCornerPoint = { kind: "shape", lineId: "L1", shapeId: "p2", at: { s: "lo", z: "hi" } }
    const m = measureDimension(dim(right, left), [], [], [], [], two)
    expect(m?.valueCm).toBeCloseTo(30, 9)
    expect(m?.direction).toEqual({ x: 1, y: 0 })
  })

  it("SH-1007: размер следует за деталью: сдвинули вправо на 10 — ширина та же; сузили до 100 — 100", () => {
    const d = dim(corner("lo", "lo"), corner("hi", "lo"))
    const moved = build([{ ...SHELF, s0: 40, s1: 200 }]).sections
    expect(measureDimension(d, [], [], [], [], moved)?.valueCm).toBeCloseTo(160, 9)
    const narrow = build([{ ...SHELF, s0: 60, s1: 160 }]).sections
    expect(measureDimension(d, [], [], [], [], narrow)?.valueCm).toBeCloseTo(100, 9)
  })
})

describe("хранение, история, видимость", () => {
  it("SH-1008: точка детали принимается при чтении; негодные — нет", () => {
    expect(isDimension(dim(corner("lo", "hi"), corner("hi", "lo")))).toBe(true)
    expect(isDimension({ from: { ...corner("lo", "lo"), shapeId: "" }, to: corner("hi", "lo"), offset: 10 })).toBe(false)
    expect(isDimension({ from: { ...corner("lo", "lo"), at: { s: "lo", z: "floor" } }, to: corner("hi", "lo"), offset: 10 })).toBe(false)
  })

  it("SH-1009: копия сцены не делит угол с оригиналом", () => {
    const src = dim(corner("lo", "lo"), corner("hi", "hi"))
    const copy = cloneScene({ walls: [], dimensions: [src] }).dimensions[0]
    expect(copy).toEqual(src)
    if (copy.from.kind !== "shape") throw new Error("ожидалась точка детали")
    expect(copy.from.at).not.toBe(src.from.kind === "shape" ? src.from.at : null)
  })

  it("SH-1010: размер скрыт без детали, показан, когда линия есть (видимость — по линии)", () => {
    const d = dim(corner("lo", "lo"), corner("hi", "lo"))
    const targets = { walls: new Set<string>(), doorways: new Set<string>(), batteries: new Set<string>(), sections: new Set(["L1"]) }
    expect(visibleDimensions([d], targets)).toEqual([d])
    expect(visibleDimensions([d], { ...targets, sections: new Set<string>() })).toEqual([])
    // деталь удалена: угол не разрешается, размер не измеряется (хранится, но не рисуется)
    expect(measureDimension(d, [], [], [], [], build([]).sections)).toBeNull()
  })
})

describe("уровень размерной линии на фигуре", () => {
  // размер ширины детали (горизонтальный) с линией на 30 см от верхней кромки; новый размер — у нижней кромки той же детали
  const first: Dimension = { ...dim(corner("lo", "hi"), corner("hi", "hi")), offset: 30 }
  const axisOf = (d: Dimension) => {
    const g = dimensionGeometry({ ...d, offset: 0 }, [], [], [], [], entries)
    if (!g) throw new Error("размер не разрешился")
    return g
  }
  const along = (axis: ReturnType<typeof axisOf>, offset: number) => ({ x: axis.a.x + axis.nx * offset + 80, y: axis.a.y + axis.ny * offset })
  const levelOfFirst = (axis: ReturnType<typeof axisOf>): number => {
    const g = dimensionGeometry(first, [], [], [], [], entries)
    if (!g) throw new Error("нет геометрии соседа")
    return (g.p1.x - axis.a.x) * axis.nx + (g.p1.y - axis.a.y) * axis.ny
  }

  it("SH-1011: третий клик рядом с уровнем соседа на фигуре привязывается к его уровню", () => {
    const axis = axisOf(dim(corner("lo", "lo"), corner("hi", "lo")))
    const level = levelOfFirst(axis)
    const snap = dimLevelSnap(along(axis, level - 2), axis, [first], [], 3, [], [], [], entries)
    expect(snap?.offset).toBeCloseTo(level, 6)
  })

  it("SH-1012: вне радиуса привязки соседа нет; без разрешения точек сосед не виден", () => {
    const axis = axisOf(dim(corner("lo", "lo"), corner("hi", "lo")))
    const level = levelOfFirst(axis)
    expect(dimLevelSnap(along(axis, level - 10), axis, [first], [], 3, [], [], [], entries)).toBeNull()
    // без списка фигур точки детали не разрешаются — сосед пропускается (так было до этого change для любых точек фигуры)
    expect(dimLevelSnap(along(axis, level), axis, [first], [], 3)).toBeNull()
  })

  it("SH-1013: перпендикулярный размер уровень не привязывает", () => {
    const vertical = axisOf(dim(corner("lo", "lo"), corner("lo", "hi")))
    const level = levelOfFirst(vertical)
    expect(dimLevelSnap(along(vertical, level - 1), vertical, [first], [], 3, [], [], [], entries)).toBeNull()
  })
})
