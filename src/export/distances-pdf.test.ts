import { readFileSync } from "node:fs"
import type { jsPDF, jsPDFOptions } from "jspdf"
import { describe, expect, it, vi } from "vitest"
import { content, drawing, drywall, plaster, rectWalls } from "../reconstruction/reconstruction.test-utils"
import { openingOn } from "../rough/rough.test-utils"
import { LIGHT_PALETTE } from "../theme"
import type { Battery, Callout, Drawing, FurnitureItem, LightFixture, StretchCeiling } from "../types"
import { legendEntries } from "./legend"
import type { PlanPage } from "./pdf"
import { parsePaint } from "./pdf-paint.test-utils"
import type { PaintOp } from "./pdf-paint.test-utils"

// change split-ceiling-pdf-pages: девятая страница PDF «Освещение. Расстояния» — чистовые стены и объекты освещения с расстояниями
// (spec pdf-export «Страница «Освещение. Расстояния»», «Легенда страницы «Освещение. Расстояния»»; design D1–D4)
//
//  вид сверху, схематично, не в масштабе. Комната: стены толщиной 20 см по осям [-10,410]×[-10,310], внутренние грани
//  x = 0, x = 400, y = 0, y = 300. Светильник S в (100, 80), бра B на грани y = 0 с центром (120, 0)
//
//   страница 8 «Потолки и освещение»        страница 9 «Освещение. Расстояния»
//   ##########/B\######################    ##########/B\######################
//   #yyyyy  (S)  yyyyyyyy -50мм yyyyyyy#    #<--120-->  |80                    #
//   #y[T ]yyyyy[BAT]yyyyyyyyyyyyyyyyyyy#    #<---100--->(S)                    #
//   #####################################    #####################################
//   y — заливка потолка, [T ] — стол, [BAT] — батарея: на странице 9 их нет, а числа 120, 100, 80 есть

interface TextCall {
  page: number
  text: string
}

const texts = vi.hoisted((): TextCall[] => [])

vi.mock("jspdf", async (importOriginal) => {
  const mod = await importOriginal<typeof import("jspdf")>()
  class RecordingPdf extends mod.jsPDF {
    constructor(options?: jsPDFOptions) {
      super(options)
      const original: unknown = Reflect.get(this, "text")
      if (typeof original !== "function") throw new Error("jsPDF.text недоступен")
      Object.defineProperty(this, "text", {
        configurable: true,
        writable: true,
        value: (...args: unknown[]): unknown => {
          const [text] = args
          const lines = typeof text === "string" ? [text] : Array.isArray(text) ? text.filter((t): t is string => typeof t === "string") : []
          for (const line of lines) texts.push({ page: this.getCurrentPageInfo().pageNumber, text: line })
          return Reflect.apply(original, this, args)
        },
      })
    }
  }
  return { ...mod, jsPDF: RecordingPdf }
})

const { buildPdfPages, pageBounds, pagesOf } = await import("./pdf")

const font = readFileSync(new URL("../assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")
const SEP = new Date(2026, 8, 5, 14, 32, 7)

const NAME = "Освещение. Расстояния"
const build = (d: Drawing, scale = 50): jsPDF => {
  texts.length = 0
  return buildPdfPages(pagesOf(d), "cm", scale, "A3", font, d.name, SEP)
}
const textsOn = (n: number): string[] => texts.filter((t) => t.page === n).map((t) => t.text)
const pageOf = (d: Drawing, index: number): PlanPage => {
  const page = pagesOf(d)[index]
  if (!page) throw new Error(`нет страницы ${index + 1}`)
  return page
}
const labels = (page: PlanPage): string[] => legendEntries(page).map((e) => e.label)

const spot = (id: string, x: number, y: number): LightFixture => ({ id, kind: "spot", x, y })
const sconce: LightFixture = { id: "b", kind: "sconce", x: 120, y: 0, angleDeg: 90 }
const ceiling: StretchCeiling = { id: "c", at: { x: 300, y: 100 }, dropMm: 50 }
const table: FurnitureItem = { id: "t", kind: "table", x: 250, y: 200, widthCm: 80, lengthCm: 160, angleDeg: 0 }
const battery: Battery = { id: "bat", wallId: "k1", face: 1, anchor: "a", offsetCm: 250, lengthCm: 80, thicknessCm: 10, gapCm: 5 }
const callout: Callout = { id: "co", target: { x: 100, y: 80 }, at: { x: 180, y: 60 }, text: "Подвес" }

const room = (): Drawing => drawing({ walls: rectWalls("k", -10, -10, 410, 310) })
const withLights = (lights: LightFixture[]): Drawing => ({ ...room(), ceiling: { ceilings: [ceiling], lights } })
// всё, что на странице 9 быть не должно: мебель, батарея, стояк, потолок, выноска и примечание плана
const crowded = (): Drawing => ({
  ...room(),
  furniture: { items: [table], dimensions: [] },
  batteries: [battery],
  communications: [{ kind: "riser", id: "r", x: 200, y: 20, diameterCm: 12 }],
  ceiling: { ceilings: [ceiling], lights: [spot("s", 100, 80), sconce], callouts: [callout], notes: ["Светильники — отдельно"] },
})

const rgbOf = (hex: string): readonly number[] => {
  const short = hex.replace("#", "")
  const h = short.length === 3 ? [...short].map((c) => c + c).join("") : short
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
}
const near = (a: readonly number[], b: readonly number[]): boolean => a.every((v, i) => Math.abs(v - (b[i] ?? 0)) < 0.01)
const RED = rgbOf(LIGHT_PALETTE.lightingRed)
const YELLOW = rgbOf(LIGHT_PALETTE.ceiling)
type Stroke = Extract<PaintOp, { kind: "stroke" }>
const redBars = (ops: PaintOp[]): number[] =>
  ops
    .filter((op): op is Stroke => op.kind === "stroke" && near(op.color, RED))
    .flatMap((op) => op.subpaths)
    .filter((sp) => sp.length === 2 && Math.abs((sp[0]?.y ?? 0) - (sp[1]?.y ?? 1)) < 1e-6)
    .map((sp) => Math.abs((sp[1]?.x ?? 0) - (sp[0]?.x ?? 0)))
// в мм на бумаге: стол 80 × 160 см при 1:50 — 16 × 32 мм
const sized = (pts: readonly { x: number; y: number }[] | undefined, w: number, h: number): boolean => {
  if (!pts || pts.length < 3) return false
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  return Math.abs(Math.max(...xs) - Math.min(...xs) - w) < 0.1 && Math.abs(Math.max(...ys) - Math.min(...ys) - h) < 0.1
}

describe("страница «Освещение. Расстояния» в PDF: состав и порядок", () => {
  it("DP-1: страниц десять; девятая — «Освещение. Расстояния» после «Потолков и освещения», десятая — «Группы включения»", () => {
    const d = withLights([spot("s", 100, 80)])
    const pages = pagesOf(d)
    expect(pages).toHaveLength(10)
    expect(pages.map((p) => p.title)).toEqual([
      "Обмерочный план",
      "Демонтаж",
      "Монтаж",
      "Черновые работы",
      "Реконструкция",
      "Мебель",
      "Сантехника",
      "Потолки и освещение",
      NAME,
      "Группы включения",
    ])
    expect(build(d).getNumberOfPages()).toBe(10)
  })

  it("DP-2: название страницы выведено в полосе названия плана и в графе 5 основной надписи", () => {
    build(withLights([spot("s", 100, 80)]))
    // полоса названия и графа 5 — два вывода названия на странице; на странице 8 то же для «Потолки и освещение»
    expect(textsOn(9).filter((t) => t === NAME)).toHaveLength(2)
    expect(textsOn(8).filter((t) => t === "Потолки и освещение")).toHaveLength(2)
  })

  it("DP-3: числа «100», «80» светильника и «120» бра — на девятой странице и только на ней", () => {
    const d = withLights([spot("s", 100, 80), sconce])
    const doc = build(d)
    expect(textsOn(9)).toEqual(expect.arrayContaining(["100", "80", "120"]))
    expect(textsOn(8)).not.toContain("100")
    expect(textsOn(8)).not.toContain("80")
    expect(textsOn(8)).not.toContain("120")
    expect(redBars(parsePaint(doc, 9)).length).toBeGreaterThan(0)
  })

  it("DP-4: стены, штукатурка и гипсокартон подложки те же, что на «Мебели»; расстояние до гипсокартона", () => {
    const d: Drawing = {
      ...drawing({
        walls: rectWalls("k", -10, -10, 410, 310),
        roughPlaster: [plaster("p", "k1", 1, "a", 60, 200, 2)],
        reconstruction: content([drywall("g", 5, 0, 5, 300, 10, 250)]),
      }),
      ceiling: { ceilings: [], lights: [spot("s", 100, 150)] },
    }
    const page = pageOf(d, 8)
    expect(page.walls).toEqual(pageOf(d, 5).walls)
    expect(page.reconstruction).toEqual(pageOf(d, 5).reconstruction)
    // внутренняя грань гипсокартона x = 10: до светильника в (100, 150) — 90
    build(d)
    expect(textsOn(9)).toContain("90")
    expect(parsePaint(build(d), 9).some((op) => op.kind === "fill" && near(op.color, rgbOf("#6dbd6a")))).toBe(true)
  })

  it("DP-4b: штукатурка 3 см на левой стене — число «97», как на холсте", () => {
    const d: Drawing = {
      ...drawing({
        walls: rectWalls("k", -10, -10, 410, 310),
        roughPlaster: [plaster("p1", "k4", 1, "a", 0, 320, 30), plaster("p2", "k4", -1, "a", 0, 320, 30)],
      }),
      ceiling: { ceilings: [], lights: [spot("s", 100, 150)] },
    }
    build(d)
    expect(textsOn(9)).toContain("97")
  })

  it("DP-4c: проём, дверь и окно подложки нарисованы как на «Мебели»; расстояние до грани проём не прерывает", () => {
    const d: Drawing = { ...drawing({ walls: rectWalls("k", -10, -10, 410, 310), doorways: [openingOn("o1", "k4", 100, 90)] }), ceiling: { ceilings: [], lights: [spot("s", 100, 150)] } }
    const page = pageOf(d, 8)
    expect(page.doorways).toHaveLength(1)
    expect(page.doorways).toEqual(pageOf(d, 5).doorways)
    build(d)
    expect(textsOn(9)).toContain("100")
  })

  it("DP-5: мебели, батарей, стояков, потолков, выносок и примечаний на странице нет", () => {
    const d = crowded()
    const page = pageOf(d, 8)
    expect(page.furniture).toBeUndefined()
    expect(page.ceiling).toBeUndefined()
    expect(page.batteries).toBeUndefined()
    expect(page.communications).toBeUndefined()
    expect(page.callouts).toBeUndefined()
    expect(page.notes).toBeUndefined()
    const doc = build(d)
    const ops = parsePaint(doc, 9)
    expect(textsOn(9)).not.toContain("-50мм")
    expect(textsOn(9)).not.toContain("Подвес")
    expect(textsOn(9)).not.toContain("Светильники — отдельно")
    expect(ops.some((op) => op.kind === "fill" && near(op.color, YELLOW) && op.box !== null && op.box.w > 50)).toBe(false)
    expect(ops.some((op) => op.kind === "stroke" && sized(op.subpaths[0], 16, 32))).toBe(false)
    // то, что на странице 8 нарисовано: стол и подпись потолка
    expect(parsePaint(doc, 8).some((op) => op.kind === "stroke" && sized(op.subpaths[0], 16, 32))).toBe(true)
    expect(textsOn(8)).toContain("-50мм")
  })

  it("DP-6: выделение не влияет: все светильники со знаками и числами", () => {
    const d = withLights([spot("s1", 100, 80), spot("s2", 200, 150), spot("s3", 330, 260)])
    build(d)
    // s3: до правой грани x = 400 — 70, до нижней y = 300 — 40
    expect(textsOn(9)).toEqual(expect.arrayContaining(["100", "80", "200", "150", "70", "40"]))
  })

  it("DP-7: знак светильника 3 мм при 1:50 и 1:100", () => {
    const d = withLights([spot("s", 100, 80)])
    for (const scale of [50, 100]) {
      const bars = redBars(parsePaint(build(d, scale), 9))
      expect(bars.some((w) => Math.abs(w - 3) < 0.01)).toBe(true)
    }
  })

  it("DP-7b: длина размерной линии «100» — 20 мм при 1:50 и 10 мм при 1:100", () => {
    const d = withLights([spot("s", 100, 80)])
    const horizontal = (scale: number): number[] =>
      parsePaint(build(d, scale), 9)
        .filter((op): op is Stroke => op.kind === "stroke")
        .flatMap((op) => op.subpaths)
        .filter((sp) => sp.length === 2 && Math.abs((sp[0]?.y ?? 0) - (sp[1]?.y ?? 1)) < 1e-6)
        .map((sp) => Math.abs((sp[1]?.x ?? 0) - (sp[0]?.x ?? 0)))
    expect(horizontal(50).some((w) => Math.abs(w - 20) < 0.1)).toBe(true)
    expect(horizontal(100).some((w) => Math.abs(w - 10) < 0.1)).toBe(true)
  })

  it("DP-8: страница без освещения остаётся: стены подложки без расстояний", () => {
    const d = room()
    const page = pageOf(d, 8)
    expect(page.walls).toEqual(pageOf(d, 5).walls)
    expect(page.distances?.lights).toEqual([])
    expect(build(d).getNumberOfPages()).toBe(10)
  })
})

describe("страница «Освещение. Расстояния»: габариты", () => {
  it("DP-10: габариты включают центры освещения и не включают мебель, батареи, стояки и выноски", () => {
    const far = { ...table, x: 900 }
    const withFar: Drawing = { ...withLights([spot("s", 100, 80)]), furniture: { items: [far], dimensions: [] }, communications: [{ kind: "riser", id: "r", x: 1200, y: 20, diameterCm: 12 }] }
    expect(pageBounds(pageOf(withFar, 8), 50).maxX).toBeLessThan(700)
    expect(pageBounds(pageOf(withFar, 7), 50).maxX).toBeGreaterThanOrEqual(900)
    const lightFar = withLights([spot("s", 700, 80)])
    expect(pageBounds(pageOf(lightFar, 8), 50).maxX).toBeGreaterThanOrEqual(700)
  })
})

describe("легенда страницы «Освещение. Расстояния»", () => {
  it("DP-20: материалы, штукатурка, гипсокартон и виды освещения; батареи, стояка, стола и потолка нет", () => {
    const d: Drawing = {
      ...crowded(),
      roughPlaster: [plaster("p", "k1", 1, "a", 60, 200, 2)],
      reconstruction: content([drywall("g", 60, 250, 300, 250, 10, 270)]),
      ceiling: { ceilings: [ceiling], lights: [spot("s1", 100, 80), { id: "l", kind: "chandelier", x: 200, y: 200 }, spot("s2", 150, 80)] },
    }
    expect(labels(pageOf(d, 8))).toEqual(["Кирпич", "Штукатурка", "Гипсокартон", "Точечный встроенный светильник", "Люстра"])
  })

  it("DP-21: записей видов освещения нет, если объектов освещения нет", () => {
    expect(labels(pageOf(room(), 8))).toEqual(["Кирпич"])
  })

  it("DP-22: записи видов освещения только на страницах «Потолки и освещение», «Освещение. Расстояния» и «Группы включения»", () => {
    const pages = pagesOf(withLights([spot("s", 100, 80)]))
    expect(pages.map((p) => labels(p).includes("Точечный встроенный светильник"))).toEqual([false, false, false, false, false, false, false, true, true, true])
  })

  it("DP-23: записей плана «Группы включения» нет", () => {
    const d: Drawing = { ...withLights([spot("s", 100, 80)]), switching: { lines: [{ id: "n", targetId: "s", name: "L1" }] } }
    expect(labels(pageOf(d, 8))).not.toEqual(expect.arrayContaining(["Линия освещения"]))
    expect(labels(pageOf(d, 9))).toContain("Линия освещения")
  })
})
