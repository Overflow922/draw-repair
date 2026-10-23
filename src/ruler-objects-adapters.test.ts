import { describe, expect, it } from "vitest"
import { batteryRulerObject, communicationRulerObject, furnitureRulerObject, rulerObjectsOf } from "./ruler-objects"
import type { Battery, Communication, FurnitureItem } from "./types"
import { W } from "./room-area.test-utils"
import { expectPointNear, rot, sceneRoom300 } from "./ruler.test-utils"

// Тесты change ruler-objects-span: приведение объектов чертежа к объектам линейки (design D2).

const item = (over: Partial<FurnitureItem> = {}): FurnitureItem => ({ id: "t1", kind: "table", x: 200, y: 100, widthCm: 120, lengthCm: 60, angleDeg: 0, ...over })

function asRect(o: ReturnType<typeof furnitureRulerObject> | null): Extract<ReturnType<typeof furnitureRulerObject>, { kind: "rect" }> {
  expect(o?.kind).toBe("rect")
  if (!o || o.kind !== "rect") throw new Error("ожидался прямоугольник")
  return o
}

describe("объекты линейки из данных чертежа", () => {
  it("ROA-1: предмет мебели — центр, размеры и ось ширины по углу", () => {
    const o = asRect(furnitureRulerObject(item({ angleDeg: 30 })))
    expectPointNear(o.center, { x: 200, y: 100 }, 1e-9)
    expectPointNear(o.u, rot({ x: 1, y: 0 }, 30), 1e-9)
    expect([o.widthCm, o.depthCm]).toEqual([120, 60])
  })

  it("ROA-2: батарея на левой стене — ось вдоль стены, ширина — длина батареи, глубина — толщина", () => {
    const walls = sceneRoom300()
    const left = walls[3] // из (0, 300) в (0, 0), граница x ∈ [-10, 10]
    const battery: Battery = { id: "b1", wallId: left.id, face: 1, anchor: "a", offsetCm: 100, lengthCm: 80, thicknessCm: 8, gapCm: 5 }
    const o = asRect(batteryRulerObject(battery, walls))
    expectPointNear(o.center, { x: 19, y: 160 }, 1e-9) // x ∈ [15, 23], y ∈ [120, 200]
    expectPointNear(o.u, { x: 0, y: -1 }, 1e-9)
    expect(o.widthCm).toBeCloseTo(80, 9)
    expect(o.depthCm).toBeCloseTo(8, 9)
  })

  it("ROA-3: батарея с другой стороны стены — по ту сторону оси", () => {
    const walls = sceneRoom300()
    const left = walls[3]
    const battery: Battery = { id: "b1", wallId: left.id, face: -1, anchor: "a", offsetCm: 100, lengthCm: 80, thicknessCm: 8, gapCm: 5 }
    expectPointNear(asRect(batteryRulerObject(battery, walls)).center, { x: -19, y: 160 }, 1e-9)
  })

  it("ROA-4: батарея без стены-хозяина или с вырожденной стеной объекта не даёт", () => {
    const battery: Battery = { id: "b1", wallId: "нет", face: 1, anchor: "a", offsetCm: 0, lengthCm: 80, thicknessCm: 8, gapCm: 0 }
    expect(batteryRulerObject(battery, sceneRoom300())).toBeNull()
    const point = W(5, 5, 5, 5)
    expect(batteryRulerObject({ ...battery, wallId: point.id }, [point])).toBeNull()
  })

  it("ROA-5: воздуховод — прямоугольник по осям, стояк — круг", () => {
    const duct: Communication = { kind: "duct", id: "d1", x: 100, y: 50, widthCm: 40, depthCm: 30 }
    const riser: Communication = { kind: "riser", id: "r1", x: 10, y: 20, diameterCm: 12 }
    const d = asRect(communicationRulerObject(duct))
    expectPointNear(d.center, { x: 100, y: 50 }, 0)
    expect([d.u, d.widthCm, d.depthCm]).toEqual([{ x: 1, y: 0 }, 40, 30])
    expect(communicationRulerObject(riser)).toEqual({ kind: "circle", center: { x: 10, y: 20 }, diameterCm: 12 })
  })

  it("ROA-6: порядок списка — батареи, коммуникации, мебель", () => {
    const walls = sceneRoom300()
    const battery: Battery = { id: "b1", wallId: walls[3].id, face: 1, anchor: "a", offsetCm: 0, lengthCm: 50, thicknessCm: 8, gapCm: 0 }
    const riser: Communication = { kind: "riser", id: "r1", x: 1, y: 1, diameterCm: 5 }
    const objects = rulerObjectsOf({ walls, batteries: [battery], communications: [riser], items: [item()] })
    expect(objects.map((o) => o.kind)).toEqual(["rect", "circle", "rect"])
    expect(asRect(objects[2]).widthCm).toBe(120)
  })

  it("ROA-7: входные данные не мутируются", () => {
    const walls = sceneRoom300()
    const source = {
      walls,
      batteries: [{ id: "b1", wallId: walls[3].id, face: 1, anchor: "a", offsetCm: 0, lengthCm: 50, thicknessCm: 8, gapCm: 0 } satisfies Battery],
      communications: [{ kind: "riser", id: "r1", x: 1, y: 1, diameterCm: 5 } satisfies Communication],
      items: [item()],
    }
    const before = JSON.stringify(source)
    rulerObjectsOf(source)
    expect(JSON.stringify(source)).toBe(before)
  })
})
