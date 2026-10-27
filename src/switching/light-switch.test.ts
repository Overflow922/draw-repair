import { describe, expect, it } from "vitest"
import type { LightSwitch, SwitchingContent } from "../types"
import { addSwitch, keyLabel, moveSwitch, newSwitch, parseKeyCount, parseKeyLines, removeSwitch, setKeyCount, setKeyLines, storedSwitches } from "./light-switch"

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

describe("parseKeyCount", () => {
  it.each([
    ["1", 1],
    [" 3 ", 3],
    ["6", 6],
  ])("%j → %i", (text, n) => {
    expect(parseKeyCount(text)).toBe(n)
  })

  it.each(["0", "7", "2,5", "2.5", "abc", "", "-1", "03x"])("%j → null", (text) => {
    expect(parseKeyCount(text)).toBeNull()
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

describe("newSwitch / addSwitch: блок из трёх клавиш", () => {
  it("число пустых клавиш, центр и направление", () => {
    const s = newSwitch("s1", { at: { x: 120, y: -7.5 }, angle: -90 }, 3)
    expect(s).toEqual({ id: "s1", at: { x: 120, y: -7.5 }, angle: -90, keys: [{ lines: [] }, { lines: [] }, { lines: [] }] })
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

describe("setKeyCount", () => {
  it("увеличение добавляет пустые клавиши в конец", () => {
    const list = [sw("a", [["L1"], ["L2"]])]
    const next = setKeyCount(list, "a", 3)
    expect(next[0]?.keys.map((k) => k.lines)).toEqual([["L1"], ["L2"], []])
    expect(list[0]?.keys).toHaveLength(2)
  })

  it("уменьшение отбрасывает последние клавиши вместе с линиями", () => {
    const next = setKeyCount([sw("a", [["L1"], ["L2"], ["L3"]])], "a", 2)
    expect(next[0]?.keys.map((k) => k.lines)).toEqual([["L1"], ["L2"]])
  })

  it("центр и направление сохраняются", () => {
    const list = [sw("a", [["L1"]])]
    const next = setKeyCount(list, "a", 4)
    expect(next[0]?.at).toEqual({ x: 120, y: 0 })
    expect(next[0]?.angle).toBe(-90)
  })

  it("прежнее число и недопустимое число — тот же массив", () => {
    const list = [sw("a", [["L1"], ["L2"]])]
    expect(setKeyCount(list, "a", 2)).toBe(list)
    expect(setKeyCount(list, "a", 0)).toBe(list)
    expect(setKeyCount(list, "a", 7)).toBe(list)
    expect(setKeyCount(list, "a", 2.5)).toBe(list)
    expect(setKeyCount(list, "zzz", 3)).toBe(list)
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
    const prev: SwitchingContent = { lines: [{ id: "l", targetId: "t", name: "L1" }], notes: ["n"] }
    const stored = storedSwitches(prev, [sw("a")])
    expect(stored?.switches).toHaveLength(1)
    expect(stored?.lines).toHaveLength(1)
    expect(stored?.notes).toEqual(["n"])
  })

  it("пустой список не пишется; поля, которого не было, не появляется", () => {
    expect(storedSwitches(undefined, [])).toBeUndefined()
    const stored = storedSwitches({ switches: [sw("a")], notes: ["n"] }, [])
    expect(stored).toEqual({ notes: ["n"] })
  })
})
