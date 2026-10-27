import { describe, expect, it } from "vitest"
import type { LightFixture, LightLine } from "../types"
import { canCarryLine, lineLabel, parseLineName, removeLine, setLine, storedLines, visibleLines } from "./light-lines"

const spot = (id: string): LightFixture => ({ id, kind: "spot", x: 0, y: 0 })
const smoke: LightFixture = { id: "ds", kind: "smoke-detector", x: 0, y: 0 }
const ids = (() => {
  let n = 0
  return () => "line-" + String(++n)
})()

describe("parseLineName", () => {
  it.each([
    ["3", "L3"],
    ["L3", "L3"],
    ["l3", "L3"],
    [" 3 ", "L3"],
    ["12", "L12"],
  ])("%j → %s", (text, name) => {
    expect(parseLineName(text)).toBe(name)
  })

  it.each(["0", "-2", "2,5", "2.5", "abc", "", "  ", "L", "L0", "3x", "LV1"])("%j → null", (text) => {
    expect(parseLineName(text)).toBeNull()
  })
})

describe("lineLabel", () => {
  it("число строится в имя", () => {
    expect(lineLabel(3)).toBe("L3")
  })
})

describe("setLine", () => {
  it("ставит метку светильнику; группа — одинаковые имена, реестра нет", () => {
    const lines = ["a", "b", "c", "d", "e"].reduce<LightLine[]>((acc, t) => setLine(acc, t, "L3", ids), [])
    expect(lines.map((l) => l.name)).toEqual(["L3", "L3", "L3", "L3", "L3"])
    expect(lines.map((l) => l.targetId)).toEqual(["a", "b", "c", "d", "e"])
  })

  it("у светильника одна метка: новое имя заменяет прежнее, id и порядок сохраняются", () => {
    const first = setLine([], "a", "L3", () => "x")
    const second = setLine(setLine(first, "b", "L3", () => "y"), "a", "L5", ids)
    expect(second).toEqual([
      { id: "x", targetId: "a", name: "L5" },
      { id: "y", targetId: "b", name: "L3" },
    ])
  })

  it("то же имя — тот же массив", () => {
    const lines = setLine([], "a", "L3", () => "x")
    expect(setLine(lines, "a", "L3", ids)).toBe(lines)
  })

  it("вход не мутируется", () => {
    const lines: LightLine[] = [{ id: "x", targetId: "a", name: "L3" }]
    setLine(lines, "a", "L5", ids)
    expect(lines).toEqual([{ id: "x", targetId: "a", name: "L3" }])
  })
})

describe("removeLine", () => {
  const lines: LightLine[] = [
    { id: "x", targetId: "a", name: "L3" },
    { id: "y", targetId: "b", name: "L3" },
  ]
  it("удаляет метку по id", () => {
    expect(removeLine(lines, "x")).toEqual([{ id: "y", targetId: "b", name: "L3" }])
  })
  it("нет такой метки — тот же массив", () => {
    expect(removeLine(lines, "zzz")).toBe(lines)
  })
})

describe("storedLines", () => {
  const l3: LightLine = { id: "x", targetId: "a", name: "L3" }
  // TCR (change merge-lighting-plans): выносок и примечаний в поле больше нет — «остальные объекты плана» представляют вытяжки
  const fan = { id: "f", x: 1, y: 2 }
  it("метки записываются, остальные объекты плана сохраняются", () => {
    expect(storedLines({ exhausts: [fan] }, [l3])).toEqual({ lines: [l3], exhausts: [fan] })
  })
  it("пустой список не пишется: ключа lines нет", () => {
    const next = storedLines({ lines: [l3], exhausts: [fan] }, [])
    expect(next).toEqual({ exhausts: [fan] })
    expect(next && "lines" in next).toBe(false)
  })
  it("поля не было и меток нет — поле не появляется", () => {
    expect(storedLines(undefined, [])).toBeUndefined()
  })
  it("поля не было — оно создаётся с метками", () => {
    expect(storedLines(undefined, [l3])).toEqual({ lines: [l3] })
  })
})

describe("visibleLines", () => {
  it("метка светильника, которого нет, не показывается и не теряется", () => {
    const lines: LightLine[] = [
      { id: "x", targetId: "a", name: "L3" },
      { id: "y", targetId: "gone", name: "L3" },
    ]
    expect(visibleLines(lines, [spot("a")]).map((v) => v.line.id)).toEqual(["x"])
    expect(lines).toHaveLength(2)
    expect(visibleLines(lines, [spot("a"), spot("gone")]).map((v) => v.line.id)).toEqual(["x", "y"])
  })

  it("несёт светильник-носитель", () => {
    expect(visibleLines([{ id: "x", targetId: "a", name: "L3" }], [spot("a")])[0]?.light.id).toBe("a")
  })
})

describe("canCarryLine", () => {
  it("датчик не несёт метку, остальные виды несут", () => {
    expect(canCarryLine(smoke)).toBe(false)
    expect(canCarryLine(spot("a"))).toBe(true)
    expect(canCarryLine({ id: "c", kind: "chandelier", x: 0, y: 0 })).toBe(true)
    expect(canCarryLine({ id: "s", kind: "sconce", x: 0, y: 0, angleDeg: 0 })).toBe(true)
    expect(canCarryLine({ id: "o", kind: "lighting-outlet", x: 0, y: 0 })).toBe(true)
  })
})
