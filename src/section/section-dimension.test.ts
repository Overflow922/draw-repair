import { describe, expect, it } from "vitest"
import { dimensionGeometry, dimPointPoint, measureDimension, nearestDimAnchor } from "../geometry"
import { cloneScene } from "../history"
import { reconstructionScene } from "../reconstruction/reconstruction-scene"
import { drawing, drywall } from "../reconstruction/reconstruction.test-utils"
import { isDimension } from "../storage"
import type { Dimension, SectionCornerPoint, SectionLine } from "../types"
import { sectionCornerPosition, sectionCorners } from "./section-corners"

// change add-section-view: точки замера на фигуре разреза (spec dimension-tool «Точки замера на фигуре разреза»)
//
// фигура линии L1 (стена ГКЛ (100,100)-(400,100), толщина 10, высота 250; линия x = 250, y 0…200, взгляд вправо):
//
//   (595,-145)+--+(605,-145)    top
//             |##|
//             |##|              сечение 10 × 250
//   (595, 105)+--+(605, 105)    floor
//
// схематично, не в масштабе

const line: SectionLine = { id: "L1", label: "A", view: "right", points: [{ x: 250, y: 0 }, { x: 250, y: 200 }] }
const build = (lines: SectionLine[] = [line]) =>
  reconstructionScene(drawing({ walls: [], reconstruction: { walls: [drywall("G", 100, 100, 400, 100, 10, 250)], dimensions: [], sections: lines } }))
const entries = build().sections

const corner = (s: "lo" | "hi", z: "floor" | "top"): SectionCornerPoint => ({ kind: "section", lineId: "L1", wallId: "G", segment: 0, at: { s, z } })
const dim = (from: SectionCornerPoint, to: SectionCornerPoint): Dimension => ({ from, to, offset: 10 })

describe("углы сечения", () => {
  it("SV-300: четыре угла прямоугольника в координатах чертежа", () => {
    expect(sectionCornerPosition(corner("lo", "floor"), entries)).toEqual({ x: 595, y: 105 })
    expect(sectionCornerPosition(corner("hi", "floor"), entries)).toEqual({ x: 605, y: 105 })
    expect(sectionCornerPosition(corner("hi", "top"), entries)).toEqual({ x: 605, y: -145 })
    expect(sectionCornerPosition(corner("lo", "top"), entries)).toEqual({ x: 595, y: -145 })
    expect(sectionCorners(entries)).toHaveLength(4)
  })

  it("SV-301: нет линии или стены — угол не разрешается", () => {
    expect(sectionCornerPosition({ ...corner("lo", "floor"), lineId: "none" }, entries)).toBeNull()
    expect(sectionCornerPosition({ ...corner("lo", "floor"), wallId: "none" }, entries)).toBeNull()
    expect(dimPointPoint(corner("lo", "floor"), [], [], [], [], [])).toBeNull()
  })

  it("SV-302: привязка к ближайшему углу в радиусе, вне радиуса — нет", () => {
    expect(nearestDimAnchor({ x: 603, y: -142 }, [], [], 5, [], [], entries)?.anchor).toEqual(corner("hi", "top"))
    expect(nearestDimAnchor({ x: 700, y: 0 }, [], [], 5, [], [], entries)).toBeNull()
  })
})

describe("число и ось", () => {
  it("SV-303: по вертикали — высота стены", () => {
    const m = measureDimension(dim(corner("lo", "floor"), corner("lo", "top")), [], [], [], [], entries)
    expect(m?.valueCm).toBeCloseTo(250, 9)
    expect(m?.direction).toEqual({ x: 0, y: -1 })
  })

  it("SV-304: по горизонтали — толщина сечения", () => {
    const m = measureDimension(dim(corner("lo", "floor"), corner("hi", "floor")), [], [], [], [], entries)
    expect(m?.valueCm).toBeCloseTo(10, 9)
    expect(m?.direction).toEqual({ x: 1, y: 0 })
  })

  it("SV-305: по диагонали ось — большая проекция (250 вертикаль, 10 горизонталь)", () => {
    const m = measureDimension(dim(corner("lo", "floor"), corner("hi", "top")), [], [], [], [], entries)
    expect(m?.valueCm).toBeCloseTo(250, 9)
  })

  it("SV-306: размерная линия строится и отнесена на смещение", () => {
    const g = dimensionGeometry(dim(corner("lo", "floor"), corner("hi", "floor")), [], [], [], [], entries)
    expect(g).not.toBeNull()
    expect(g?.valueCm).toBeCloseTo(10, 9)
  })

  it("SV-307: размер без разрешаемых точек не строится", () => {
    expect(dimensionGeometry(dim(corner("lo", "floor"), corner("hi", "floor")), [], [], [], [], [])).toBeNull()
  })
})

describe("правка стены", () => {
  const measured = (height: number, present = true) => {
    const s = reconstructionScene(drawing({ walls: [], reconstruction: { walls: present ? [drywall("G", 100, 100, 400, 100, 10, height)] : [], dimensions: [], sections: [line] } }))
    return dimensionGeometry(dim(corner("lo", "floor"), corner("lo", "top")), [], [], [], [], s.sections)?.valueCm ?? null
  }

  it("SV-311: размер следует за высотой стены: число меняется, точки те же", () => {
    expect(measured(250)).toBeCloseTo(250, 9)
    expect(measured(300)).toBeCloseTo(300, 9)
  })

  it("SV-312: без стены размер не строится, с возвращённой стеной — снова строится", () => {
    expect(measured(250, false)).toBeNull()
    expect(measured(250, true)).toBeCloseTo(250, 9)
  })
})

describe("видимость и хранение", () => {
  const d = dim(corner("lo", "floor"), corner("lo", "top"))
  const withDim = (lines: SectionLine[]) =>
    reconstructionScene(drawing({ walls: [], reconstruction: { walls: [drywall("G", 100, 100, 400, 100, 10, 250)], dimensions: [d], sections: lines } }))

  it("SV-308: размер виден, пока линия есть, и скрыт без неё, но не удаляется из хранимого списка", () => {
    expect(withDim([line]).dimensions).toHaveLength(1)
    expect(withDim([]).dimensions).toEqual([])
  })

  it("SV-309: проверка размера: допустимая точка принимается, с мусором — нет", () => {
    expect(isDimension(d)).toBe(true)
    expect(isDimension({ ...d, from: { ...corner("lo", "floor"), at: { s: "mid", z: "floor" } } })).toBe(false)
    expect(isDimension({ ...d, to: { ...corner("lo", "floor"), segment: -1 } })).toBe(false)
    expect(isDimension({ ...d, to: { ...corner("lo", "floor"), lineId: "" } })).toBe(false)
  })

  it("SV-310: снимок истории копирует точку глубоко", () => {
    const scene = cloneScene({ walls: [], dimensions: [d] })
    const copy = scene.dimensions[0].from
    expect(copy).toEqual(d.from)
    if (copy.kind !== "section") throw new Error("ожидалась точка фигуры")
    expect(copy.at).not.toBe((d.from as SectionCornerPoint).at)
  })
})
