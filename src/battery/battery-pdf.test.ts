import { readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"
import type { Op } from "../doorway/doorway.test-utils"
import { colorRecorder } from "../doorway/window.test-utils"
import type { ColoredText } from "../doorway/window.test-utils"
import type { RenderOptions } from "../render"
import type { Battery, Dimension, Drawing, Wall } from "../types"
import { bat, sceneR, windowAt } from "./battery.test-utils"

// change add-battery: батареи в PDF: состав страниц планов, границы содержимого, передача в отрисовку каждой страницы без выделения и чисел
// (spec pdf-export «Батареи в PDF»; design D11; test-plan B-PDF-*).
// drawScene и drawDemolitionScene подменяются обёртками: запоминают аргументы и вызывают оригинал (как window-pdf.test.ts).

const calls = vi.hoisted((): { opts: RenderOptions | undefined; ops: Op[]; texts: ColoredText[] }[] => [])
const demolitionCalls = vi.hoisted((): { batteries: readonly Battery[] | undefined; demolished: ReadonlySet<string> | undefined }[] => [])

vi.mock("../render", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../render")>()
  return {
    ...mod,
    drawScene: (...args: Parameters<typeof mod.drawScene>): void => {
      const { ctx, ops, texts } = colorRecorder()
      const [, w, h, walls, preview, unit, view, selected, opts] = args
      mod.drawScene(ctx, w, h, walls, preview, unit, view, selected, opts)
      calls.push({ opts, ops, texts })
      mod.drawScene(...args)
    },
  }
})

vi.mock("../demolition/demolition-render", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../demolition/demolition-render")>()
  return {
    ...mod,
    drawDemolitionScene: (...args: Parameters<typeof mod.drawDemolitionScene>): void => {
      const scene = args[3]
      demolitionCalls.push({ batteries: scene.batteries, demolished: scene.demolishedBatteryIds })
      mod.drawDemolitionScene(...args)
    },
  }
})

const { buildPdfPages, pageBounds, pagesOf } = await import("../export/pdf")

const font = readFileSync(new URL("../assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")
const SCALE = 100
const W: Wall = { id: "W", a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, thicknessCm: 20, type: "brick" }
const X = bat("W", "a", 100)

const make = (extra: Partial<Drawing> = {}): Drawing => ({
  id: "d",
  name: "Чертёж 1",
  walls: [W],
  dimensions: [],
  view: { zoom: 1, pan: { x: 0, y: 0 } },
  ...extra,
})

// комната: видимая грань W — от x = 10 до x = 490, числа выделенной батареи X были бы 90 / 320
const room = (extra: Partial<Drawing> = {}): Drawing => make({ walls: sceneR().walls, ...extra })

describe("страницы планов", () => {
  it("B-PDF-1: страница обмера содержит батареи обмера", () => {
    const [measure] = pagesOf(make({ batteries: [X] }))
    expect(measure.batteries).toEqual([X])
  })

  it("B-PDF-2: страница «Демонтаж» содержит батареи обмера и множество снесённых: помеченная попадает в него", () => {
    const [, demolition] = pagesOf(make({ batteries: [X], batteryDemolition: [{ id: "m", batteryId: "b0" }] }))
    expect(demolition.batteries).toEqual([X])
    expect([...(demolition.demolishedBatteryIds ?? [])]).toEqual(["b0"])
  })

  it("B-PDF-2b: без пометок множество снесённых пусто", () => {
    const [, demolition] = pagesOf(make({ batteries: [X] }))
    expect([...(demolition.demolishedBatteryIds ?? [])]).toEqual([])
  })

  it("B-PDF-2c: страница «Монтаж» не содержит помеченной батареи, но содержит непомеченную и собственные", () => {
    const own = bat("W", "a", 300, { id: "own" })
    const other = bat("W", "a", 400, { id: "other" })
    const pages = pagesOf(
      make({
        batteries: [X, other],
        batteryDemolition: [{ id: "m", batteryId: "b0" }],
        mounting: { walls: [], dimensions: [], batteries: [own] },
      }),
    )
    expect(pages[2].batteries?.map((b: Battery) => b.id)).toEqual(["other", "own"])
  })

  it("B-PDF-2d: без батарей поля страниц пусты", () => {
    for (const page of pagesOf(make())) expect(page.batteries ?? []).toEqual([])
  })

  it("B-PDF-4: размер с углом батареи входит в страницу обмера и на неё же передаются батареи для его разрешения", () => {
    const d: Dimension = { from: { kind: "corner", batteryId: "b0", end: "a", side: "back" }, to: { kind: "corner", batteryId: "b0", end: "b", side: "back" }, offset: 15 }
    const [measure] = pagesOf(make({ batteries: [X], dimensions: [d] }))
    expect(measure.dimensions).toEqual([d])
    expect(measure.batteries).toEqual([X])
  })
})

describe("границы содержимого страницы", () => {
  it("B-PDF-5: батарея за гранью стены расширяет границы: на грани −1 её передняя сторона y = −23 внутри области", () => {
    const outer = bat("W", "a", 100, { face: -1 })
    const withBattery = pageBounds(pagesOf(make({ batteries: [outer] }))[0], SCALE)
    const without = pageBounds(pagesOf(make())[0], SCALE)
    expect(withBattery.minY).toBeLessThanOrEqual(-23)
    expect(withBattery.minY).toBeLessThan(without.minY)
  })

  it("B-PDF-5b: батарея внутри габарита стен границы по x не меняет", () => {
    const withBattery = pageBounds(pagesOf(make({ batteries: [X] }))[0], SCALE)
    const without = pageBounds(pagesOf(make())[0], SCALE)
    expect(withBattery.maxX).toBe(without.maxX)
    expect(withBattery.minX).toBe(without.minX)
  })
})

describe("отрисовка страниц", () => {
  const build = (drawing: Drawing) => {
    calls.length = 0
    demolitionCalls.length = 0
    buildPdfPages(pagesOf(drawing), "cm", SCALE, "A4", font, "t", new Date(2026, 0, 1))
    return { draws: calls.filter((c) => !c.opts?.underlay), demolition: [...demolitionCalls] }
  }

  it("B-PDF-3: числа выделенной батареи в PDF не попадают: в отрисовку страниц выделение не передаётся", () => {
    const { draws } = build(room({ batteries: [X] }))
    expect(draws.length).toBeGreaterThan(0)
    expect(draws[0].opts?.batteries).toEqual([X]) // батарея в отрисовку передана
    for (const c of draws) expect(c.opts?.selectedBatteries ?? []).toEqual([])
  })

  it("риска центровки в PDF не попадает: батарея по центру окна, в отрисовку страниц линии трекинга не передаются", () => {
    const win = windowAt("W", "a", 200) // центр 260
    const centred = bat("W", "a", 225)
    const { draws } = build(room({ batteries: [centred], doorways: [win] }))
    expect(draws.length).toBeGreaterThan(0)
    expect(draws[0].opts?.batteries).toEqual([centred])
    for (const c of draws) expect(c.opts?.tracks ?? []).toEqual([])
  })

  it("B-PDF-1b: страница обмера рисует батареи обмера (передаёт список в drawScene)", () => {
    const { draws } = build(make({ batteries: [X] }))
    expect(draws[0].opts?.batteries).toEqual([X])
  })

  it("B-PDF-1c: числа батареи (90 / 320 / 70) не выводятся на страницу; сама батарея передана на рисование", () => {
    const { draws } = build(room({ batteries: [X] }))
    expect(draws[0].opts?.batteries).toEqual([X])
    for (const c of draws) {
      const shown = c.texts.map((t) => t.text)
      for (const n of ["90", "320", "70"]) expect(shown).not.toContain(n)
    }
  })

  it("B-PDF-6: страница «Демонтаж»: в рисование переданы батареи обмера и множество снесённых", () => {
    const { demolition } = build(make({ batteries: [X, bat("W", "a", 300, { id: "y" })], batteryDemolition: [{ id: "m", batteryId: "y" }] }))
    expect(demolition).toHaveLength(1)
    expect(demolition[0].batteries?.map((b) => b.id)).toEqual(["b0", "y"])
    expect([...(demolition[0].demolished ?? [])]).toEqual(["y"])
  })

  it("B-PDF-6b: страница «Демонтаж» без пометок: множество снесённых пусто", () => {
    const { demolition } = build(make({ batteries: [X] }))
    expect([...(demolition[0].demolished ?? [])]).toEqual([])
  })

  it("B-PDF-7: страница «Монтаж»: рисуются непомеченные батареи обмера и собственные, помеченная скрыта", () => {
    const own = bat("W", "a", 300, { id: "own" })
    const other = bat("W", "a", 400, { id: "other" })
    const { draws } = build(
      make({ batteries: [X, other], batteryDemolition: [{ id: "m", batteryId: "b0" }], mounting: { walls: [], dimensions: [], batteries: [own] } }),
    )
    // draws: страница обмера и страница «Монтаж» (подложка «Демонтажа» отфильтрована)
    expect(draws).toHaveLength(2)
    expect(draws[0].opts?.batteries?.map((b) => b.id)).toEqual(["b0", "other"])
    expect(draws[1].opts?.batteries?.map((b) => b.id)).toEqual(["other", "own"])
  })

  it("B-PDF-7b: страница «Монтаж» без батарей не получает пустого мусора: список пуст или отсутствует", () => {
    const { draws } = build(make())
    expect(draws[1].opts?.batteries ?? []).toEqual([])
  })

  it("B-PDF-8: размер с углом батареи рисуется на странице обмера с теми же батареями (число 70 — длина)", () => {
    const d: Dimension = { from: { kind: "corner", batteryId: "b0", end: "a", side: "front" }, to: { kind: "corner", batteryId: "b0", end: "b", side: "front" }, offset: 15 }
    const { draws } = build(make({ batteries: [X], dimensions: [d] }))
    expect(draws[0].opts?.dimensions).toEqual([d])
    expect(draws[0].opts?.batteries).toEqual([X])
    expect(draws[0].texts.map((t) => t.text)).toContain("70")
  })
})
