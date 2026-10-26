import { describe, expect, it } from "vitest"
import { visibleDimensions } from "../dimension-visibility"
import type { Dimension } from "../types"

// change add-plumbing-plan: размер к прибору показывается, пока прибор есть на плане «Мебель» (spec dimension-tool «Точки замера
// на приборах», plumbing-plan «Инструменты плана «Сантехника»», сценарий «Размер к удалённому прибору»; design D3)

const edge = { a: { wallId: "w1", edge: 1 }, b: { wallId: "w2", edge: 1 } }
const toSink: Dimension = { from: edge, to: { kind: "item", itemId: "s", at: { kind: "center" } }, offset: -30 }
const walls = new Set(["w1", "w2"])
const none = new Set<string>()

describe("видимость размеров к приборам", () => {
  it("IV-01: прибор есть — размер виден", () => {
    expect(visibleDimensions([toSink], { walls, doorways: none, batteries: none, items: new Set(["s"]) })).toEqual([toSink])
  })

  it("IV-02: прибора нет (удалён на «Мебели») — размер скрыт; он возвращается, когда прибор появляется снова", () => {
    expect(visibleDimensions([toSink], { walls, doorways: none, batteries: none, items: none })).toEqual([])
    expect(visibleDimensions([toSink], { walls, doorways: none, batteries: none, items: new Set(["s"]) })).toEqual([toSink])
  })

  it("IV-03: на плане без приборов (список не задан) точка прибора не действует", () => {
    expect(visibleDimensions([toSink], { walls, doorways: none, batteries: none })).toEqual([])
  })
})
