import { describe, expect, it } from "vitest"
import { pagesOf } from "../export/pdf"
import { emptyHistory, parseHistory, planHistory, recordCallouts, serializeHistory, undoCallouts } from "../history"
import { mountingScene } from "../mounting/mounting-scene"
import { parseStore, serializeStore } from "../storage"
import type { Drawing, DrawingStore } from "../types"
import { commitCallout, removeCallout } from "./callout-actions"
import { calloutsOf, withCallouts } from "./callout-store"
import { A, B, callout, make } from "./callout.test-utils"

// change add-callout: сквозные сценарии независимости планов — операции, хранение, история и страницы PDF
// (spec callout «Данные выноски», drawing-plans «Выноски — объекты плана», demolition-plan, mounting-plan; test-plan C-PLN-*, C-HIS-12).

const NEW = (id: string) => ({ kind: "new" as const, id, target: { x: 10, y: 10 }, at: { x: 50, y: 50 } })

describe("выноски трёх планов вместе", () => {
  it("C-PLN-1: созданные на трёх планах выноски проходят хранение и сборку страниц, не смешиваясь", () => {
    let d: Drawing = make({ demolition: [{ id: "k", wallId: "W", anchor: "a", fromCm: 0, toCm: 100 }] })
    for (const [plan, id] of [["measure", "o"], ["demolition", "d"], ["mounting", "m"]] as const) {
      d = withCallouts(d, plan, commitCallout(calloutsOf(d, plan), NEW(id), `текст ${id}`).list)
    }
    const store: DrawingStore = { version: 3, activeId: d.id, drawings: [d] }
    const loaded = parseStore(serializeStore(store))?.store.drawings[0]
    expect(loaded).toBeDefined()
    if (!loaded) return
    for (const [plan, id] of [["measure", "o"], ["demolition", "d"], ["mounting", "m"]] as const) {
      expect(calloutsOf(loaded, plan).map((c) => c.id)).toEqual([id])
    }
    const [measure, demolition, mounting] = pagesOf(loaded)
    expect(measure.callouts?.map((c) => c.id)).toEqual(["o"])
    expect(demolition.callouts?.map((c) => c.id)).toEqual(["d"])
    expect(mounting.callouts?.map((c) => c.id)).toEqual(["m"])
    expect(loaded.demolition).toEqual(d.demolition)
  })

  it("C-PLN-2: история выноски плана «Монтаж» не трогает выноски других планов", () => {
    const hist = emptyHistory()
    let d: Drawing = make({ callouts: [A()], demolitionCallouts: [B()] })
    const mounting = planHistory(hist, d.id, "mounting")
    recordCallouts(mounting, calloutsOf(d, "mounting"))
    d = withCallouts(d, "mounting", commitCallout(calloutsOf(d, "mounting"), NEW("m"), "монтаж").list)
    expect(calloutsOf(d, "mounting")).toHaveLength(1)
    const restored = undoCallouts(mounting, calloutsOf(d, "mounting"))
    expect(restored).toEqual([])
    d = withCallouts(d, "mounting", restored ?? [])
    expect(calloutsOf(d, "mounting")).toEqual([])
    expect(calloutsOf(d, "measure")).toEqual([A()])
    expect(calloutsOf(d, "demolition")).toEqual([B()])
    expect(planHistory(hist, d.id, "measure").past).toHaveLength(0)
    expect(planHistory(hist, d.id, "demolition").past).toHaveLength(0)
  })

  it("C-PLN-3: удаление выноски на плане не затрагивает стены, пометки сноса и собственные объекты «Монтажа»", () => {
    const marks = [{ id: "k", wallId: "W", anchor: "a" as const, fromCm: 0, toCm: 100 }]
    const own = [{ id: "own", a: { x: 0, y: 0 }, b: { x: 10, y: 0 }, thicknessCm: 10, type: "brick" as const }]
    const base = make({ demolition: marks, demolitionCallouts: [A()], callouts: [B()], mounting: { walls: own, dimensions: [], callouts: [callout("m", { x: 1, y: 1 }, { x: 2, y: 2 }, "м")] } })
    for (const plan of ["measure", "demolition", "mounting"] as const) {
      const list = calloutsOf(base, plan)
      const next = withCallouts(base, plan, removeCallout(list, list[0].id).list)
      expect(calloutsOf(next, plan)).toEqual([])
      expect(next.walls).toEqual(base.walls)
      expect(next.demolition).toEqual(marks)
      expect(next.mounting?.walls).toEqual(own)
      for (const other of (["measure", "demolition", "mounting"] as const).filter((p) => p !== plan)) expect(calloutsOf(next, other)).toEqual(calloutsOf(base, other))
    }
  })

  it("C-PLN-4: пересчёт остатков «Монтажа» не меняет и не читает выноски: список прежний, в сцене их нет", () => {
    const m = callout("m", { x: 1, y: 1 }, { x: 2, y: 2 }, "монтаж")
    const marks = [{ id: "k", wallId: "W", anchor: "a" as const, fromCm: 0, toCm: 100 }]
    const d = make({ mounting: { walls: [], dimensions: [], callouts: [m] } })
    const withMarks = make({ demolition: marks, mounting: { walls: [], dimensions: [], callouts: [m] } })
    const before = JSON.stringify(withMarks.mounting?.callouts)
    const scene = mountingScene(withMarks)
    expect(JSON.stringify(withMarks.mounting?.callouts)).toBe(before)
    expect(Object.keys(scene)).not.toContain("callouts")
    expect(calloutsOf(d, "mounting")).toEqual(calloutsOf(withMarks, "mounting"))
  })
})

describe("закрытие вкладки и история", () => {
  it("C-HIS-12: чертёж с выносками в корзине истории читается и сохраняется вместе с выносками", () => {
    const drawing = make({ callouts: [A()], demolitionCallouts: [B()], mounting: { walls: [], dimensions: [], callouts: [callout("m", { x: 1, y: 1 }, { x: 2, y: 2 }, "м")] } })
    const hist = emptyHistory()
    hist.trash.push({ index: 0, drawing })
    const loaded = parseHistory(serializeHistory(hist))
    expect(loaded).not.toBeNull()
    expect(loaded?.history.trash[0].drawing.callouts).toEqual([A()])
    expect(loaded?.history.trash[0].drawing.demolitionCallouts).toEqual([B()])
    expect(loaded?.history.trash[0].drawing.mounting?.callouts).toHaveLength(1)
  })
})
