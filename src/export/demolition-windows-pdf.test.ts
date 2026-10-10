import { describe, expect, it } from "vitest"
import { door } from "../doorway/doorway.test-utils"
import { door_, window_ } from "../demolition/demolition.test-utils"
import type { DemolitionMark, Drawing, Wall, WallElement } from "../types"
import { pagesOf } from "./pdf"

// change demolition-no-window-walls: страница демонтажа PDF не показывает пометки стен с окнами (spec demolition-plan
// «Что сносится и что нет»; design D3). 1:100.

const wall = (id: string, y: number): Wall => ({ id, a: { x: 0, y }, b: { x: 500, y }, thicknessCm: 20, type: "brick" })
const M1: DemolitionMark = { id: "m1", wallId: "w1", anchor: "a", fromCm: 100, toCm: 190 }

const drawing = (walls: Wall[], doorways: WallElement[], demolition: DemolitionMark[] = [M1]): Drawing => ({
  id: "a",
  name: "Чертёж 1",
  walls,
  dimensions: [],
  doorways,
  view: { zoom: 1, pan: { x: 0, y: 0 } },
  scale: 100,
  demolition,
})

const marksOf = (d: Drawing) => pagesOf(d)[1]?.demolition ?? []

describe("пометки страницы демонтажа и окна", () => {
  it("NW-30: на стене с окном пометка не попадает на страницу демонтажа", () => {
    expect(marksOf(drawing([wall("w1", 0)], [window_("w1", "a", 210, 90, "w1")]))).toEqual([])
  })

  it("NW-31: без окна та же пометка на странице: участок 100–190", () => {
    const out = marksOf(drawing([wall("w1", 0)], []))
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ from: 100, to: 190 })
  })

  it("NW-32: проём и дверь пометке не мешают: пометка на странице, элементы переданы на страницу", () => {
    const opening = door("w1", "a", 210, 90, 210, "p")
    const leaf = door_("w1", "b", 100, 90, "dr")
    const d = drawing([wall("w1", 0)], [opening, leaf])
    expect(marksOf(d)).toHaveLength(1)
    expect(pagesOf(d)[1]?.doorways).toEqual([opening, leaf])
  })

  it("NW-33: окно на другой стене: пометка w1 на странице, пометка стены с окном — нет", () => {
    const v: DemolitionMark = { id: "m2", wallId: "w2", anchor: "a", fromCm: 0, toCm: 500 }
    const d = drawing([wall("w1", 0), wall("w2", 300)], [window_("w2", "a", 210, 90, "w1")], [M1, v])
    expect(marksOf(d).map((r) => r.mark.id)).toEqual(["m1"])
  })

  it("NW-30: окно на странице демонтажа по-прежнему рисуется: элементы переданы, окно среди них", () => {
    const w = window_("w1", "a", 210, 90, "win")
    expect(pagesOf(drawing([wall("w1", 0)], [w]))[1]?.doorways).toEqual([w])
  })

  it("NW-31: pagesOf не мутирует чертёж", () => {
    const d = drawing([wall("w1", 0)], [window_("w1", "a", 210, 90, "w1")])
    const before = structuredClone(d)
    pagesOf(d)
    expect(d).toEqual(before)
  })
})
