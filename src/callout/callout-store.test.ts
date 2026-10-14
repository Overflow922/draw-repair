import { describe, expect, it } from "vitest"
import type { Callout, Drawing } from "../types"
import { calloutsOf, withCallouts } from "./callout-store"
import { A, B, callout, deepFreeze, make } from "./callout.test-utils"

// change add-callout: списки выносок по планам (design D1, D2; spec callout «Данные выноски»; test-plan C-STORE-*, C-INV-4).

const M = callout("m", { x: 1, y: 2 }, { x: 3, y: 4 }, "монтаж")
const D = callout("d", { x: 5, y: 6 }, { x: 7, y: 8 }, "демонтаж")
const all = (): Drawing => make({ callouts: [A()], demolitionCallouts: [D], mounting: { walls: [], dimensions: [], callouts: [M] } })

describe("calloutsOf", () => {
  it("C-STORE-1: без списка — пустой список для каждого плана", () => {
    const d = make()
    for (const plan of ["measure", "demolition", "mounting"] as const) expect(calloutsOf(d, plan)).toEqual([])
  })

  it("C-STORE-2: каждый план получает только свои выноски", () => {
    const d = all()
    expect(calloutsOf(d, "measure")).toEqual([A()])
    expect(calloutsOf(d, "demolition")).toEqual([D])
    expect(calloutsOf(d, "mounting")).toEqual([M])
  })

  it("C-STORE-2b: «Монтаж» без поля выносок и «Монтаж» без объектов дают пустой список", () => {
    expect(calloutsOf(make({ mounting: { walls: [], dimensions: [] } }), "mounting")).toEqual([])
    expect(calloutsOf(make({ callouts: [A()] }), "mounting")).toEqual([])
  })
})

describe("withCallouts", () => {
  it("C-STORE-3: обмер пишет в чертёж, остальные планы не затронуты", () => {
    const next = withCallouts(all(), "measure", [B()])
    expect(calloutsOf(next, "measure")).toEqual([B()])
    expect(calloutsOf(next, "demolition")).toEqual([D])
    expect(calloutsOf(next, "mounting")).toEqual([M])
  })

  it("C-STORE-3b: «Демонтаж» пишет в свой список и сохраняет пометки сноса", () => {
    const marks = [{ id: "k", wallId: "W", anchor: "a" as const, fromCm: 0, toCm: 100 }]
    const next = withCallouts(make({ demolition: marks, callouts: [A()] }), "demolition", [D])
    expect(calloutsOf(next, "demolition")).toEqual([D])
    expect(next.demolition).toEqual(marks)
    expect(calloutsOf(next, "measure")).toEqual([A()])
  })

  it("C-STORE-3c: «Монтаж» сохраняет всё остальное содержимое плана: стены, размеры, элементы, батареи", () => {
    const walls = [{ id: "own", a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, thicknessCm: 10, type: "brick" as const }]
    const dimensions = [{ from: { a: { wallId: "own", edge: 0 }, b: { wallId: "own", edge: 2 } }, to: { a: { wallId: "own", edge: 1 }, b: { wallId: "own", edge: 3 } }, offset: 15 }]
    const doorways = [{ id: "dw", wallId: "own", anchor: "a" as const, offsetCm: 10, widthCm: 50, heightCm: 210 }]
    const batteries = [{ id: "bt", wallId: "own", face: 1 as const, anchor: "a" as const, offsetCm: 5, lengthCm: 40, thicknessCm: 10, gapCm: 2 }]
    const base = make({ mounting: { walls, dimensions, doorways, batteries, callouts: [M] } })
    const next = withCallouts(base, "mounting", [M, B()])
    expect(next.mounting?.walls).toEqual(walls)
    expect(next.mounting?.dimensions).toEqual(dimensions)
    expect(next.mounting?.doorways).toEqual(doorways)
    expect(next.mounting?.batteries).toEqual(batteries)
    expect(calloutsOf(next, "mounting")).toEqual([M, B()])
  })

  it("C-STORE-3d: у чертежа без объектов «Монтажа» они создаются пустыми, выноски записаны", () => {
    const next = withCallouts(make(), "mounting", [M])
    expect(next.mounting?.walls).toEqual([])
    expect(next.mounting?.dimensions).toEqual([])
    expect(calloutsOf(next, "mounting")).toEqual([M])
  })

  it("C-INV-4: исходный чертёж и переданный список не изменяются", () => {
    const base = deepFreeze(all())
    const list: Callout[] = deepFreeze([B()])
    const before = structuredClone(base)
    for (const plan of ["measure", "demolition", "mounting"] as const) withCallouts(base, plan, list)
    expect(base).toEqual(before)
  })

  it("C-STORE-4: прочие поля чертежа остаются теми же", () => {
    const base = all()
    const next = withCallouts(base, "measure", [])
    expect(next.id).toBe(base.id)
    expect(next.walls).toEqual(base.walls)
    expect(next.view).toEqual(base.view)
    expect(calloutsOf(next, "measure")).toEqual([])
  })
})
