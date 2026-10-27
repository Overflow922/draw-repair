import { describe, expect, it } from "vitest"
import { emptyHistory, parseHistory, planHistory, recordCallouts, recordCeilingPlan, redoCallouts, serializeHistory, undoCallouts, undoCeilingPlan } from "../history"
import type { Callout, LightFixture } from "../types"

// change add-switching-plan: история плана «Группы включения» — свой ключ «<id>:switching», записи выносок и примечаний
// (spec drawing-history «История плана «Группы включения»»; design D6)

const callout = (text = "Выключатель"): Callout => ({ id: "c", target: { x: 1, y: 2 }, at: { x: 3, y: 4 }, text })
const spot: LightFixture = { id: "l", kind: "spot", x: 10, y: 20 }

describe("история плана «Группы включения»", () => {
  it("SW-60: отмена выноски убирает её, повтор возвращает", () => {
    const h = planHistory(emptyHistory(), "a", "switching")
    recordCallouts(h, [])
    expect(undoCallouts(h, [callout()])).toEqual([])
    expect(redoCallouts(h, [])).toEqual([callout()])
  })

  it("SW-61: история лежит под ключом «<id>:switching» и независима от «Потолков и освещения»", () => {
    const store = emptyHistory()
    recordCeilingPlan(planHistory(store, "a", "ceiling"), { ceilings: [], lights: [] })
    recordCallouts(planHistory(store, "a", "switching"), [])
    expect(Object.keys(store.histories).sort()).toEqual(["a:ceiling", "a:switching"])
    // отмена на «Группах включения» убирает выноску, шаг «Потолков» остаётся в его истории
    expect(undoCallouts(planHistory(store, "a", "switching"), [callout()])).toEqual([])
    expect(planHistory(store, "a", "ceiling").past).toHaveLength(1)
    expect(undoCeilingPlan(planHistory(store, "a", "ceiling"), { ceilings: [], lights: [spot] })?.lights).toEqual([])
  })

  it("SW-62: отмена на «Потолках и освещении» не трогает историю «Групп включения»", () => {
    const store = emptyHistory()
    recordCallouts(planHistory(store, "a", "switching"), [])
    recordCeilingPlan(planHistory(store, "a", "ceiling"), { ceilings: [], lights: [] })
    undoCeilingPlan(planHistory(store, "a", "ceiling"), { ceilings: [], lights: [spot] })
    expect(planHistory(store, "a", "switching").past).toEqual([{ kind: "callouts", callouts: [] }])
    expect(planHistory(store, "a", "switching").future).toEqual([])
  })

  it("SW-63: история переживает перезагрузку: «Отменить» и «Повторить» на тех же шагах", () => {
    const store = emptyHistory()
    const h = planHistory(store, "a", "switching")
    recordCallouts(h, [])
    recordCallouts(h, [callout()])
    undoCallouts(h, [callout(), callout("Второй")])
    const loaded = parseHistory(serializeHistory(store))
    expect(loaded?.readOnly).toBe(false)
    const again = loaded ? planHistory(loaded.history, "a", "switching") : null
    expect(again?.past).toEqual([{ kind: "callouts", callouts: [] }])
    expect(again?.future).toEqual([{ kind: "callouts", callouts: [callout(), callout("Второй")] }])
  })

  it("SW-64: история, сохранённая до введения плана, читается без изменений; история плана пуста", () => {
    const store = emptyHistory()
    recordCeilingPlan(planHistory(store, "a", "ceiling"), { ceilings: [], lights: [] })
    const loaded = parseHistory(serializeHistory(store))
    expect(loaded ? planHistory(loaded.history, "a", "ceiling").past : null).toHaveLength(1)
    expect(loaded ? planHistory(loaded.history, "a", "switching").past : null).toEqual([])
  })
})
