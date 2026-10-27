import { describe, expect, it } from "vitest"
import type { ExhaustFan, LightFixture, LightLine, LightSwitch } from "../types"
import { linkedObjects } from "./line-links"

const spot = (id: string): LightFixture => ({ id, kind: "spot", x: 0, y: 0 })
const smoke: LightFixture = { id: "ds", kind: "smoke-detector", x: 0, y: 0 }
const fan = (id: string): ExhaustFan => ({ id, x: 0, y: 0 })
const line = (id: string, targetId: string, name: string): LightLine => ({ id, targetId, name })
const sw = (id: string, ...keys: string[][]): LightSwitch => ({ id, at: { x: 0, y: 0 }, angle: 0, keys: keys.map((lines) => ({ lines })) })

const lights = [spot("a"), spot("b"), spot("c"), spot("d"), spot("e"), smoke]
const fans = [fan("f")]
const lines = [line("la", "a", "L3"), line("lb", "b", "L3"), line("lc", "c", "L3"), line("ld", "d", "L4"), line("le", "e", "L5"), line("lf", "f", "LV1")]

const result = (selection: Parameters<typeof linkedObjects>[0], switches: LightSwitch[] = []) => {
  const r = linkedObjects(selection, lines, switches, lights, fans)
  return { carriers: [...r.carrierIds].sort(), labels: [...r.lineIds].sort(), switches: [...r.switchIds].sort() }
}

describe("linkedObjects: выделен выключатель", () => {
  it("подсвечивает носители и метки с именами всех клавиш", () => {
    const r = result({ kind: "switch", id: "s" }, [sw("s", ["L3"], ["L4", "LV1"])])
    expect(r.carriers).toEqual(["a", "b", "c", "d", "f"])
    expect(r.labels).toEqual(["la", "lb", "lc", "ld", "lf"])
    expect(r.switches).toEqual([])
  })

  it("линии нет на плане — ничего", () => {
    expect(result({ kind: "switch", id: "s" }, [sw("s", ["L9"])])).toEqual({ carriers: [], labels: [], switches: [] })
  })

  it("клавиши без линий — ничего", () => {
    expect(result({ kind: "switch", id: "s" }, [sw("s", [], [])])).toEqual({ carriers: [], labels: [], switches: [] })
  })
})

describe("linkedObjects: выделен носитель или метка", () => {
  const switches = [sw("A", ["L1"], ["L3"]), sw("B", ["L4"])]

  it("светильник: только выключатели с этим именем, другие светильники линии не подсвечиваются", () => {
    const r = result({ kind: "carrier", id: "a" }, switches)
    expect(r.carriers).toEqual([])
    expect(r.labels).toEqual([])
    expect(r.switches).toEqual(["A"])
  })

  it("метка даёт ту же подсветку, что её светильник", () => {
    expect(result({ kind: "label", id: "la" }, switches)).toEqual(result({ kind: "carrier", id: "a" }, switches))
  })

  it("вытяжка связана по имени LV", () => {
    const r = result({ kind: "carrier", id: "f" }, [sw("A", ["L3", "LV1"])])
    expect(r.carriers).toEqual([])
    expect(r.switches).toEqual(["A"])
  })

  it("вытяжка: другая вытяжка с тем же именем не подсвечивается", () => {
    const r = linkedObjects({ kind: "carrier", id: "f" }, [...lines, line("lg", "g", "LV1")], [sw("A", ["LV1"])], lights, [...fans, fan("g")])
    expect([...r.carrierIds]).toEqual([])
    expect([...r.lineIds]).toEqual([])
    expect([...r.switchIds]).toEqual(["A"])
  })

  it("линия есть у светильника, но ни в одной клавише — ничего", () => {
    expect(result({ kind: "carrier", id: "a" }, [sw("B", ["L4"])])).toEqual({ carriers: [], labels: [], switches: [] })
  })

  it("светильник без метки — ничего", () => {
    expect(result({ kind: "carrier", id: "ds" }, switches)).toEqual({ carriers: [], labels: [], switches: [] })
  })

  it("метка не по виду носителя не показывается и не участвует", () => {
    const wrong = [line("x", "a", "LV3"), line("y", "b", "L3")]
    const r = linkedObjects({ kind: "carrier", id: "b" }, wrong, [sw("A", ["LV3"])], lights, fans)
    expect([...r.carrierIds]).toEqual([])
    expect([...r.switchIds]).toEqual([])
  })

  it("метка удалённого светильника не подсвечивается", () => {
    const r = linkedObjects({ kind: "carrier", id: "a" }, [...lines, line("gone", "zz", "L3")], [sw("A", ["L3"])], lights, fans)
    expect([...r.lineIds]).toEqual([])
    expect([...r.switchIds]).toEqual(["A"])
  })
})

describe("linkedObjects: правка имени обновляет связи", () => {
  it("после смены метки светильника подсвечиваются только выключатели новой линии, прежней — нет", () => {
    const switches = [sw("A", ["L3"]), sw("B", ["L5"])]
    const before = linkedObjects({ kind: "carrier", id: "a" }, lines, switches, lights, fans)
    expect([...before.carrierIds]).toEqual([])
    expect([...before.switchIds]).toEqual(["A"])

    const renamed = lines.map((l) => (l.id === "la" ? { ...l, name: "L5" } : l))
    const after = linkedObjects({ kind: "carrier", id: "a" }, renamed, switches, lights, fans)
    expect([...after.carrierIds]).toEqual([])
    expect([...after.lineIds]).toEqual([])
    expect([...after.switchIds]).toEqual(["B"])
  })
})

describe("linkedObjects: без выделения", () => {
  it("null — ничего", () => {
    expect(result(null)).toEqual({ carriers: [], labels: [], switches: [] })
  })
})
