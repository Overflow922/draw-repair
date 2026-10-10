import { describe, expect, it } from "vitest"
import { window_ } from "../demolition/demolition.test-utils"
import type { DemolitionMark, Drawing, Wall, WallElement } from "../types"
import { pagesOf } from "./pdf"

// change demolition-window-sections: страница демонтажа PDF показывает пометки чистых участков стены с окном и не
// показывает пометки через участок окна (spec demolition-plan «Что сносится и что нет»). Перегородка P (300,10)–(300,400)
// толщиной 10 делит грань y = 10 стены w1 на [0, 295] и [305, 500]; окно слева (откосы 100–190).

const wall = (id: string, ax: number, ay: number, bx: number, by: number, thicknessCm = 20): Wall => ({ id, a: { x: ax, y: ay }, b: { x: bx, y: by }, thicknessCm, type: "brick" })
const walls = (): Wall[] => [wall("w1", 0, 0, 500, 0), wall("p", 300, 10, 300, 400, 10)]
const mark = (id: string, from: number, to: number): DemolitionMark => ({ id, wallId: "w1", anchor: "a", fromCm: from, toCm: to })

const drawing = (doorways: WallElement[], demolition: DemolitionMark[]): Drawing => ({
  id: "a",
  name: "Чертёж 1",
  walls: walls(),
  dimensions: [],
  doorways,
  view: { zoom: 1, pan: { x: 0, y: 0 } },
  scale: 100,
  demolition,
})

const shown = (d: Drawing): string[] => (pagesOf(d)[1]?.demolition ?? []).map((r) => r.mark.id)
const win = window_("w1", "a", 100, 90, "win")

describe("пометки страницы демонтажа и участки окон", () => {
  it("SW-40: пометка на чистом участке (300–450) попадает на страницу, пометка через участок окна (200–400) — нет", () => {
    expect(shown(drawing([win], [mark("clean", 300, 450), mark("over", 200, 400)]))).toEqual(["clean"])
  })

  it("SW-41: без окна обе пометки на странице", () => {
    expect(shown(drawing([], [mark("clean", 300, 450), mark("over", 200, 400)]))).toEqual(["clean", "over"])
  })

  it("SW-42: окно перенесено на правый участок (350–440): пометка 300–450 скрыта, 50–150 показана", () => {
    const moved = window_("w1", "a", 350, 90, "win")
    expect(shown(drawing([moved], [mark("a", 300, 450), mark("b", 50, 150)]))).toEqual(["b"])
  })

  it("SW-42: pagesOf не мутирует чертёж", () => {
    const d = drawing([win], [mark("clean", 300, 450)])
    const before = structuredClone(d)
    pagesOf(d)
    expect(d).toEqual(before)
  })
})