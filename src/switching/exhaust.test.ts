import { describe, expect, it } from "vitest"
import type { ExhaustFan, LightLine } from "../types"
import { addExhaust, moveExhaust, newExhaust, removeExhaust, storedExhausts } from "./exhaust"

const fan = (id: string, x = 100, y = 80): ExhaustFan => ({ id, x, y })

describe("newExhaust", () => {
  it("округляет центр до целого сантиметра", () => {
    expect(newExhaust("a", { x: 100.4, y: 79.6 })).toEqual({ id: "a", x: 100, y: 80 })
  })
})

describe("addExhaust / moveExhaust", () => {
  it("добавляет в конец и не мутирует вход", () => {
    const list = [fan("a")]
    const next = addExhaust(list, fan("b"))
    expect(next.map((f) => f.id)).toEqual(["a", "b"])
    expect(list).toHaveLength(1)
  })
  it("перемещает центр", () => {
    expect(moveExhaust([fan("a")], "a", { x: 150, y: 80 })).toEqual([fan("a", 150, 80)])
  })
  it("то же место или нет такой вытяжки — тот же массив", () => {
    const list = [fan("a")]
    expect(moveExhaust(list, "a", { x: 100.2, y: 80 })).toBe(list)
    expect(moveExhaust(list, "zz", { x: 1, y: 1 })).toBe(list)
  })
})

describe("removeExhaust", () => {
  const lines: LightLine[] = [
    { id: "l1", targetId: "a", name: "LV1" },
    { id: "l2", targetId: "s", name: "L3" },
  ]
  it("удаляет вытяжку вместе с её меткой, метки светильников остаются", () => {
    const r = removeExhaust([fan("a"), fan("b")], lines, "a")
    expect(r.exhausts.map((f) => f.id)).toEqual(["b"])
    expect(r.lines.map((l) => l.id)).toEqual(["l2"])
  })
  it("вытяжка без метки — метки те же", () => {
    expect(removeExhaust([fan("b")], lines, "b").lines).toBe(lines)
  })
  it("нет такой вытяжки — те же списки", () => {
    const list = [fan("a")]
    const r = removeExhaust(list, lines, "zz")
    expect(r.exhausts).toBe(list)
    expect(r.lines).toBe(lines)
  })
  it("не мутирует вход", () => {
    const list = [fan("a")]
    removeExhaust(list, lines, "a")
    expect(list).toHaveLength(1)
    expect(lines).toHaveLength(2)
  })
})

describe("storedExhausts", () => {
  it("пустой список не пишется; поля не было — не появляется", () => {
    expect(storedExhausts(undefined, [])).toBeUndefined()
    expect(storedExhausts({ exhausts: [fan("a")] }, [])).toEqual({})
  })
  it("сохраняет остальные объекты плана", () => {
    // TCR (change merge-lighting-plans): выносок и примечаний в поле больше нет — «остальные объекты» представляют метки
    const l = { id: "l", targetId: "t", name: "L1" }
    expect(storedExhausts({ lines: [l] }, [fan("a")])).toEqual({ lines: [l], exhausts: [fan("a")] })
  })
  it("метки, правленные вместе с вытяжкой, записываются; пустой список меток не пишется", () => {
    const prev = { exhausts: [fan("a")], lines: [{ id: "l", targetId: "a", name: "LV1" }] }
    expect(storedExhausts(prev, [], [])).toEqual({})
    expect(storedExhausts(prev, [fan("a")], [{ id: "m", targetId: "a", name: "LV2" }])?.lines?.[0]?.id).toBe("m")
  })
})
