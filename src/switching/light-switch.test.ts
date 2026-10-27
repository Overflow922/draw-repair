import { describe, expect, it } from "vitest"
import type { LightSwitch, SwitchingContent } from "../types"
import { addSwitch, keyLabel, moveSwitch, newSwitch, parseKeyLines, removeSwitch, setKeyLines, storedSwitches, switchLineField } from "./light-switch"

const sw = (id: string, keys: string[][] = [[]]): LightSwitch => ({ id, at: { x: 120, y: 0 }, angle: -90, keys: keys.map((lines) => ({ lines })) })

describe("parseKeyLines", () => {
  it.each([
    ["L2,LV1", ["L2", "LV1"]],
    ["l2, lv1", ["L2", "LV1"]],
    ["L2;LV1", ["L2", "LV1"]],
    [" L2 ; LV1 ,L3 ", ["L2", "LV1", "L3"]],
    ["L2,L2,l2", ["L2"]],
    ["L3,L2,L3", ["L3", "L2"]],
    ["", []],
    ["   ", []],
    ["L12", ["L12"]],
  ])("%j → %j", (text, lines) => {
    expect(parseKeyLines(text)).toEqual(lines)
  })

  it.each(["L0", "L2,abc", "LV", "3", "L", "LV0", "L2,,L3", "L2,", "L-1", "L2.5", "V1"])("%j → null", (text) => {
    expect(parseKeyLines(text)).toBeNull()
  })
})

describe("keyLabel", () => {
  it("имена через запятую без пробелов", () => {
    expect(keyLabel(["L2", "LV1"])).toBe("L2,LV1")
    expect(keyLabel(["L3"])).toBe("L3")
  })

  it("у клавиши без линий подписи нет", () => {
    expect(keyLabel([])).toBe("")
  })
})

describe("newSwitch / addSwitch: выключатель из одной клавиши", () => {
  it("одна клавиша с переданной линией, центр и направление", () => {
    const s = newSwitch("s1", { at: { x: 120, y: -7.5 }, angle: -90 }, "L1")
    expect(s).toEqual({ id: "s1", at: { x: 120, y: -7.5 }, angle: -90, keys: [{ lines: ["L1"] }] })
  })

  it("линия вытяжки сохраняется как есть", () => {
    expect(newSwitch("s1", { at: { x: 0, y: 0 }, angle: 0 }, "LV2").keys).toEqual([{ lines: ["LV2"] }])
  })

  it("постановка добавляет в конец и не мутирует вход", () => {
    const list = [sw("a")]
    const next = addSwitch(list, sw("b"))
    expect(next.map((s) => s.id)).toEqual(["a", "b"])
    expect(list).toHaveLength(1)
  })
})

describe("setKeyLines", () => {
  it("клавиша получает список, остальные не меняются; вход не мутируется", () => {
    const list = [sw("a", [["L1"], ["L2"]])]
    const next = setKeyLines(list, "a", 1, ["L3", "LV1"])
    expect(next[0]?.keys.map((k) => k.lines)).toEqual([["L1"], ["L3", "LV1"]])
    expect(list[0]?.keys[1]?.lines).toEqual(["L2"])
  })

  it("линии нет на плане — имя принимается как есть", () => {
    const next = setKeyLines([sw("a")], "a", 0, ["L9"])
    expect(next[0]?.keys[0]?.lines).toEqual(["L9"])
  })

  it("тот же список — тот же массив", () => {
    const list = [sw("a", [["L1", "L2"]])]
    expect(setKeyLines(list, "a", 0, ["L1", "L2"])).toBe(list)
  })

  it("нет выключателя или клавиши — тот же массив", () => {
    const list = [sw("a")]
    expect(setKeyLines(list, "zzz", 0, ["L1"])).toBe(list)
    expect(setKeyLines(list, "a", 5, ["L1"])).toBe(list)
  })
})

describe("switchLineField: меню «Линия» панели", () => {
  it("без выделения — текущая линия сеанса, меню доступно", () => {
    expect(switchLineField(null, "L4")).toEqual({ line: "L4", editable: true })
  })

  it("выделен выключатель из одной клавиши с одной линией — эта линия, меню доступно", () => {
    expect(switchLineField(sw("a", [["L3"]]), "L4")).toEqual({ line: "L3", editable: true })
    expect(switchLineField(sw("a", [["LV1"]]), "L4")).toEqual({ line: "LV1", editable: true })
  })

  it("выключатель из одной клавиши без линий — «—», меню доступно", () => {
    expect(switchLineField(sw("a", [[]]), "L4")).toEqual({ line: null, editable: true })
  })

  it("несколько клавиш или несколько линий в клавише (старые чертежи) — меню недоступно", () => {
    expect(switchLineField(sw("a", [["L1"], ["L2"]]), "L4")).toEqual({ line: null, editable: false })
    expect(switchLineField(sw("a", [["L3", "LV1"]]), "L4")).toEqual({ line: null, editable: false })
  })
})

describe("moveSwitch", () => {
  it("меняет центр и направление, клавиши сохраняются", () => {
    const list = [sw("a", [["L1"], ["L2"]])]
    const next = moveSwitch(list, "a", { at: { x: 5, y: 40 }, angle: 0 })
    expect(next[0]).toEqual({ id: "a", at: { x: 5, y: 40 }, angle: 0, keys: [{ lines: ["L1"] }, { lines: ["L2"] }] })
    expect(list[0]?.at).toEqual({ x: 120, y: 0 })
  })

  it("то же положение — тот же массив", () => {
    const list = [sw("a")]
    expect(moveSwitch(list, "a", { at: { x: 120, y: 0 }, angle: -90 })).toBe(list)
  })
})

describe("removeSwitch", () => {
  it("удаляет выключатель по id", () => {
    const list = [sw("a"), sw("b")]
    expect(removeSwitch(list, "a").map((s) => s.id)).toEqual(["b"])
    expect(list).toHaveLength(2)
  })

  it("нет такого — тот же массив", () => {
    const list = [sw("a")]
    expect(removeSwitch(list, "zzz")).toBe(list)
  })
})

describe("storedSwitches", () => {
  it("список записывается рядом с остальными объектами плана", () => {
    // TCR (change merge-lighting-plans): выносок и примечаний в поле больше нет — «остальные объекты» представляют вытяжки
    const prev: SwitchingContent = { lines: [{ id: "l", targetId: "t", name: "L1" }], exhausts: [{ id: "f", x: 1, y: 2 }] }
    const stored = storedSwitches(prev, [sw("a")])
    expect(stored?.switches).toHaveLength(1)
    expect(stored?.lines).toHaveLength(1)
    expect(stored?.exhausts).toEqual([{ id: "f", x: 1, y: 2 }])
  })

  it("пустой список не пишется; поля, которого не было, не появляется", () => {
    expect(storedSwitches(undefined, [])).toBeUndefined()
    const stored = storedSwitches({ switches: [sw("a")], exhausts: [{ id: "f", x: 1, y: 2 }] }, [])
    expect(stored).toEqual({ exhausts: [{ id: "f", x: 1, y: 2 }] })
  })
})
