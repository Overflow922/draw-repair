import { describe, expect, it } from "vitest"
import { drawScene } from "./render"
import { rulerReading } from "./ruler"
import { rulerObjectsOf } from "./ruler-objects"
import type { Battery, Communication, FurnitureItem, Point, Unit, View, Wall } from "./types"
import { arcRecorder, extraOps, sceneRoom300 } from "./ruler.test-utils"
import type { Op } from "./ruler.test-utils"

// Сквозные тесты change ruler-objects-span: данные чертежа (мебель, батареи, коммуникации) →
// rulerObjectsOf → rulerReading → drawScene → подписи (spec ruler-tool «Замер пролёта между
// гранями», «Замер объекта», «Отображение замеров линейки»).

const VIEW: View = { zoom: 1, pan: { x: -50, y: -50 } }

interface Plan {
  walls: Wall[]
  batteries?: Battery[]
  communications?: Communication[]
  items?: FurnitureItem[]
}

function drawn(plan: Plan, cursor: Point, unit: Unit = "mm", view: View = VIEW): Op[] {
  const draw = (withRuler: boolean): Op[] => {
    const { ctx, ops } = arcRecorder()
    const objects = rulerObjectsOf({ walls: plan.walls, batteries: plan.batteries ?? [], communications: plan.communications ?? [], items: plan.items ?? [] })
    drawScene(ctx, 1200, 900, plan.walls, null, unit, view, [], withRuler ? { ruler: rulerReading(cursor, plan.walls, objects) } : {})
    return ops
  }
  return extraOps(draw(false), draw(true)).extra
}

const labels = (plan: Plan, cursor: Point, unit: Unit = "mm"): string[] => drawn(plan, cursor, unit).flatMap((o) => (o.kind === "text" ? [o.text] : []))

const table = (over: Partial<FurnitureItem> = {}): FurnitureItem => ({ id: "t1", kind: "table", x: 500, y: 500, widthCm: 120, lengthCm: 60, angleDeg: 0, ...over })

describe("линейка с объектами от данных до подписей", () => {
  it("ROE-1: курсор над столом — «1200» и «600», без углов и дуг", () => {
    const ops = drawn({ walls: [], items: [table()] }, { x: 510, y: 505 })
    expect(ops.flatMap((o) => (o.kind === "text" ? [o.text] : [])).sort()).toEqual(["1200", "600"])
    expect(ops.some((o) => (o.kind === "stroke" || o.kind === "fill") && o.arcs.length > 0)).toBe(false)
  })

  it("ROE-2: повёрнутый стол — те же числа", () => {
    expect(labels({ walls: [], items: [table({ angleDeg: 30 })] }, { x: 505, y: 502 }).sort()).toEqual(["1200", "600"])
  })

  it("ROE-3: батарея 80 × 8 на левой стене — «800» вдоль стены и «80» поперёк", () => {
    const walls = sceneRoom300()
    const left = walls[3] // из (0, 300) в (0, 0)
    const battery: Battery = { id: "b1", wallId: left.id, face: 1, anchor: "a", offsetCm: 100, lengthCm: 80, thicknessCm: 8, gapCm: 5 }
    expect(labels({ walls, batteries: [battery] }, { x: 19, y: 160 }).sort()).toEqual(["80", "800"])
  })

  it("ROE-4: воздуховод 40 × 30 и стояк диаметром 10", () => {
    const duct: Communication = { kind: "duct", id: "d1", x: 100, y: 100, widthCm: 40, depthCm: 30 }
    const riser: Communication = { kind: "riser", id: "r1", x: 300, y: 100, diameterCm: 10 }
    expect(labels({ walls: [], communications: [duct, riser] }, { x: 100, y: 100 }).sort()).toEqual(["300", "400"])
    expect(labels({ walls: [], communications: [duct, riser] }, { x: 301, y: 101 })).toEqual(["100"])
  })

  it("ROE-5: батарея и воздуховод в комнате — пролёт «2570» и «2800» вместо «3000»", () => {
    const walls = sceneRoom300()
    const left = walls[3]
    const battery: Battery = { id: "b1", wallId: left.id, face: 1, anchor: "a", offsetCm: 100, lengthCm: 80, thicknessCm: 8, gapCm: 5 }
    const duct: Communication = { kind: "duct", id: "d1", x: 295, y: 150, widthCm: 30, depthCm: 40 }
    const text = labels({ walls, batteries: [battery], communications: [duct] }, { x: 150, y: 150 })
    expect(text.filter((t) => !t.endsWith("°")).sort()).toEqual(["2570", "2800"])
    expect(text.filter((t) => t === "90°")).toHaveLength(4)
  })

  it("ROE-6: стол у стены — пролёт «2100» из сценария, а не «3000»", () => {
    const text = labels({ walls: sceneRoom300(), items: [table({ x: 60, y: 150, widthCm: 80 })] }, { x: 160, y: 150 })
    expect(text.filter((t) => !t.endsWith("°")).sort()).toEqual(["2100", "2800"])
  })

  it("ROE-7: единица метры — «1,2» и «0,6»", () => {
    expect(labels({ walls: [], items: [table()] }, { x: 510, y: 505 }, "m").sort()).toEqual(["0,6", "1,2"])
  })

  it("ROE-8: цвет и толщина линий замера объекта те же, что у замера стены, и не зависят от масштаба", () => {
    const style = (ops: Op[]): string[] => [...new Set(ops.flatMap((o) => (o.kind === "stroke" ? [`${o.style}|${o.widthPx}`] : [])))].sort()
    const walls = [sceneRoom300()[0]]
    const wallOps = drawn({ walls }, { x: 160, y: 0 })
    const onTable = drawn({ walls: [], items: [table()] }, { x: 510, y: 505 })
    const zoomed = drawn({ walls: [], items: [table()] }, { x: 510, y: 505 }, "mm", { zoom: 2, pan: VIEW.pan })
    const wallColors = new Set(style(wallOps).map((s) => s.split("|")[0]))
    for (const s of style(onTable)) expect(wallColors, s).toContain(s.split("|")[0])
    expect(style(zoomed)).toEqual(style(onTable))
  })
})
