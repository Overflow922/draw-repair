import { readFileSync } from "node:fs"
import type { jsPDF, jsPDFOptions } from "jspdf"
import { describe, expect, it, vi } from "vitest"
import { drywallColors } from "../reconstruction/reconstruction-render"
import { content, drawing, drywall, plaster, rectWalls, screed, wall } from "../reconstruction/reconstruction.test-utils"
import type { ReconstructionParts } from "../reconstruction/reconstruction.test-utils"
import type { Battery, Communication, Drawing } from "../types"
import { LEGEND_ROW_PITCH_MM, legendEntries, legendWidthMm } from "./legend"
import type { PageFormat } from "./pdf"
import { parsePaint } from "./pdf-paint.test-utils"

// change reconstruction-plan: пятая страница PDF — план «Реконструкция» и записи легенды
// (spec pdf-export «Страница плана «Реконструкция»», «Легенда на странице PDF»)

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

const { buildPdfPages, pagesOf, pageBounds } = await import("./pdf")

const font = readFileSync(new URL("../assets/pt-sans-regular.ttf", import.meta.url)).toString("base64")
const SEP = new Date(2026, 8, 5, 14, 32, 7)

const build = (d: Drawing, scale = 50, format: PageFormat = "A3"): jsPDF => {
  texts.length = 0
  return buildPdfPages(pagesOf(d), "cm", scale, format, font, d.name, SEP)
}
const textsOn = (n: number): string[] => texts.filter((t) => t.page === n).map((t) => t.text)

const ROOM = (): ReturnType<typeof rectWalls> => rectWalls("k", 0, 0, 420, 520)
const recon = (parts: ReconstructionParts = {}): Drawing => drawing({ walls: ROOM(), ...parts })
const G = (): ReturnType<typeof drywall> => drywall("g", 20, 30, 220, 30, 10, 270)

const rgbOf = (hex: string): readonly [number, number, number] => {
  const h = hex.replace("#", "")
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as unknown as readonly [number, number, number]
}
const near = (a: readonly number[], b: readonly number[]): boolean => a.every((v, i) => Math.abs(v - (b[i] ?? 0)) < 0.01)
const GREEN = rgbOf(drywallColors("light").fill)
const PURPLE = rgbOf("#a44ea8")
const GREY = rgbOf("#555555")
const greenFills = (doc: jsPDF, page: number) => parsePaint(doc, page).filter((op) => op.kind === "fill" && near(op.color, GREEN))
const purpleFills = (doc: jsPDF, page: number) => parsePaint(doc, page).filter((op) => op.kind === "fill" && near(op.color, PURPLE))
const greyFills = (doc: jsPDF, page: number) => parsePaint(doc, page).filter((op) => op.kind === "fill" && near(op.color, GREY))

const PLASTERED = [plaster("a", "k1", 1, "a", 0, 420, 30)]

describe("pagesOf: страница «Реконструкция»", () => {
  it("RC-120: страниц пять; пятая — «Реконструкция» с подложкой «Черновых работ» и стенами ГКЛ, без помещений и размеров подложки", () => {
    const pages = pagesOf(recon({ roughPlaster: PLASTERED, reconstruction: content([G()]) }))
    expect(pages).toHaveLength(8) // TCR (change furniture-plan-table): шесть // TCR (change add-plumbing-plan): семь — седьмой план «Сантехника» // TCR (change add-ceiling-plan): восемь — восьмой план «Потолки и освещение»
    const fifth = pages[4]
    expect(fifth?.title).toBe("Реконструкция")
    expect(fifth?.walls.map((w) => w.id)).toEqual(["k1~0", "k2~0", "k3~0", "k4~0"])
    expect(fifth?.dimensions).toEqual([])
    expect(fifth?.rooms).toBeUndefined()
    expect(fifth?.rough).toBeUndefined()
    expect(fifth?.demolition).toBeUndefined()
    expect(fifth?.reconstruction?.pieces).toHaveLength(1)
    expect(fifth?.reconstruction?.drywall.map((w) => w.id)).toEqual(["g"])
  })

  it("RC-120: у остальных страниц слоя «Реконструкции» нет", () => {
    const pages = pagesOf(recon({ reconstruction: content([G()]) }))
    for (const p of pages.slice(0, 4)) expect(p.reconstruction).toBeUndefined()
  })

  it("RC-121: стяжка и помещения в страницу не входят, даже если на «Черновых работах» они есть", () => {
    const fifth = pagesOf(recon({ roughScreeds: [screed("s", 200, 260, 65)] }))[4]
    expect(fifth?.rooms).toBeUndefined()
    expect(fifth?.reconstruction).toBeDefined()
  })

  it("RC-122: собственные размеры плана — на странице; размеров подложки нет", () => {
    const dim = { from: { a: { wallId: "g", edge: 0 }, b: { wallId: "k1~0", edge: 1 } }, to: { a: { wallId: "g", edge: 2 }, b: { wallId: "k1~0", edge: 3 } }, offset: 20 }
    const d = { ...recon({ reconstruction: content([G()], [dim]) }), dimensions: [dim] }
    expect(pagesOf(d)[4]?.dimensions).toEqual([dim])
    expect(pagesOf(d)[3]?.dimensions).toEqual([])
  })

  it("RC-123: выноски и примечания плана — свои у страницы", () => {
    const callouts = [{ id: "c", target: { x: 1, y: 1 }, at: { x: 50, y: 50 }, text: "Обшить" }]
    const fifth = pagesOf(recon({ reconstruction: { walls: [], dimensions: [], callouts, notes: ["Примечание"] } }))[4]
    expect(fifth?.callouts).toEqual(callouts)
    expect(fifth?.notes).toEqual(["Примечание"])
    expect(pagesOf(recon({ reconstruction: { walls: [], dimensions: [], callouts } }))[3]?.callouts).toBeUndefined()
  })

  it("RC-124: габариты страницы учитывают стену ГКЛ, выступающую за стены подложки", () => {
    const bare = pagesOf(recon())[4]
    const far = pagesOf(recon({ reconstruction: content([drywall("g", 0, -400, 300, -400)]) }))[4]
    if (!bare || !far) throw new Error("нет страниц")
    expect(pageBounds(far, 50).minY).toBeLessThan(pageBounds(bare, 50).minY)
  })

  it("RC-125: страница без объектов подложки и собственных объектов пуста, но остаётся в документе", () => {
    const pages = pagesOf({ ...drawing({ walls: [] }) })
    expect(pages).toHaveLength(8) // TCR (change furniture-plan-table): шесть // TCR (change add-plumbing-plan): семь — седьмой план «Сантехника» // TCR (change add-ceiling-plan): восемь — восьмой план «Потолки и освещение»
    expect(pages[4]?.walls).toEqual([])
  })
})

describe("страница «Реконструкция» в документе PDF", () => {
  it("RC-130: PDF содержит пять страниц; зелёная заливка — только на пятой", () => {
    const doc = build(recon({ reconstruction: content([G()]) }))
    expect(doc.getNumberOfPages()).toBe(8) // TCR (change furniture-plan-table): шесть // TCR (change add-plumbing-plan): семь — седьмой план «Сантехника» // TCR (change add-ceiling-plan): восемь — восьмой план «Потолки и освещение»
    expect(greenFills(doc, 5).length).toBeGreaterThan(0)
    for (const n of [1, 2, 3, 4]) expect(greenFills(doc, n), `страница ${n}`).toEqual([])
  })

  it("RC-131: толщина ГКЛ 10 см при 1:50 — полоса шириной 2 мм на листе, длиной 200 см = 40 мм", () => {
    const doc = build(recon({ reconstruction: content([G()]) }), 50)
    const boxes = greenFills(doc, 5).flatMap((op) => (op.kind === "fill" && op.box ? [op.box] : []))
    expect(boxes.some((b) => Math.abs(b.w - 40) < 0.05 && Math.abs(b.h - 2) < 0.05)).toBe(true)
  })

  it("RC-132: штукатурка подложки на пятой странице серая; фиолетовая — только на четвёртой", () => {
    const doc = build(recon({ roughPlaster: PLASTERED, reconstruction: content([G()]) }))
    expect(purpleFills(doc, 4).length).toBeGreaterThan(0)
    expect(purpleFills(doc, 5)).toEqual([])
    expect(greyFills(doc, 5).length).toBeGreaterThan(0)
  })

  it("RC-133: стяжка — подпись «h = 65мм» есть на четвёртой странице и нет на пятой", () => {
    build(recon({ roughScreeds: [screed("s", 200, 260, 65)] }))
    expect(textsOn(4)).toContain("h = 65мм")
    expect(textsOn(5).includes("h = 65мм")).toBe(false)
  })

  it("RC-134: блоков помещений, таблицы экспликации и подписей площади на пятой странице нет", () => {
    build(recon({ roughPlaster: PLASTERED, reconstruction: content([G()]) }))
    expect(textsOn(4)).toContain("Экспликация помещений")
    expect(textsOn(5)).not.toContain("Экспликация помещений")
    expect(textsOn(5)).not.toContain("H=3000")
    expect(textsOn(5).filter((t) => / м²$/.test(t))).toEqual([])
  })

  it("RC-135: название плана — в графе 5 и в полосе названия страницы 5", () => {
    build(recon({ reconstruction: content([G()]) }))
    expect(textsOn(5).filter((t) => t === "Реконструкция").length).toBeGreaterThanOrEqual(2)
  })

  it("RC-136: высота стены на страницу не выводится", () => {
    build(recon({ reconstruction: content([G()]) }))
    expect(textsOn(5).some((t) => t.includes("270") || t.includes("2700"))).toBe(false)
  })

  it("RC-137: первые четыре страницы не меняются от стен ГКЛ", () => {
    const firstFour = (): string[][] => [1, 2, 3, 4].map((n) => texts.filter((t) => t.page === n).map((t) => t.text))
    build(recon({ roughPlaster: PLASTERED }))
    const before = firstFour()
    build(recon({ roughPlaster: PLASTERED, reconstruction: content([G()]) }))
    expect(firstFour()).toEqual(before)
  })

  it("RC-138: PDF не зависит от того, какой план активен", () => {
    const base = recon({ reconstruction: content([G()]) })
    build({ ...base, activePlan: "measure" })
    const a = texts.map((t) => `${t.page}:${t.text}`)
    build({ ...base, activePlan: "reconstruction" })
    expect(texts.map((t) => `${t.page}:${t.text}`)).toEqual(a)
  })
})

describe("легенда страницы «Реконструкция»", () => {
  const labelsOf = (d: Drawing): string[][] => pagesOf(d).map((p) => legendEntries(p).map((e) => e.label))
  const TWO = (): ReturnType<typeof rectWalls> => [...rectWalls("k", 0, 0, 420, 320), wall("p", 200, 0, 200, 320)]

  it("RC-140: кирпичная стена, штукатурка, стяжка и стена ГКЛ: «Кирпич», «Штукатурка», «Гипсокартон»; стяжки нет", () => {
    const d = drawing({ walls: TWO(), roughPlaster: [plaster("a", "k1", 1, "a", 0, 420, 20)], roughScreeds: [screed("s", 100, 160, 65)], reconstruction: content([G()]) })
    expect(labelsOf(d)[4]).toEqual(["Кирпич", "Штукатурка", "Гипсокартон"])
  })

  it("RC-141: стен ГКЛ нет — записи «Гипсокартон» нет", () => {
    expect(labelsOf(drawing({ walls: TWO(), roughPlaster: [plaster("a", "k1", 1, "a", 0, 420, 20)] }))[4]).toEqual(["Кирпич", "Штукатурка"])
  })

  it("RC-142: «Гипсокартон» есть только на своей странице", () => {
    const d = drawing({ walls: TWO(), reconstruction: content([G()]) })
    for (const labels of labelsOf(d).slice(0, 4)) expect(labels).not.toContain("Гипсокартон")
  })

  it("RC-143: стена ГКЛ плана не даёт записи материала «ГКЛ»; материал «ГКЛ» подложки по-прежнему даёт", () => {
    const withDrywall = drawing({ walls: TWO(), reconstruction: content([G()]) })
    expect(labelsOf(withDrywall)[4]).not.toContain("ГКЛ")
    const gklWall = wall("x", 0, 600, 300, 600, 10, "gkl")
    expect(labelsOf(drawing({ walls: [...TWO(), gklWall], reconstruction: content([G()]) }))[4]).toContain("ГКЛ")
  })

  it("RC-144: стена ГКЛ — тоже стена: страница без стен подложки, но со стеной ГКЛ имеет легенду «Гипсокартон»; без обеих легенды нет", () => {
    expect(labelsOf(drawing({ walls: [], reconstruction: content([G()]) }))[4]).toEqual(["Гипсокартон"])
    expect(labelsOf(drawing({ walls: [] }))[4]).toEqual([])
  })

  it("RC-145: порядок: материалы, «Батарея», «Стояк», «Воздуховод», «Штукатурка», «Гипсокартон»", () => {
    const battery: Battery = { id: "b1", wallId: "k1", face: 1, anchor: "a", offsetCm: 100, lengthCm: 70, thicknessCm: 10, gapCm: 3 }
    const riser: Communication = { kind: "riser", id: "r1", x: 200, y: 160, diameterCm: 11 }
    const duct: Communication = { kind: "duct", id: "d1", x: 300, y: 200, widthCm: 30, depthCm: 20 }
    const d = { ...drawing({ walls: TWO(), roughPlaster: [plaster("a", "k1", 1, "a", 0, 420, 20)], reconstruction: content([G()]) }), batteries: [battery], communications: [riser, duct] }
    expect(labelsOf(d)[4]).toEqual(["Кирпич", "Батарея", "Стояк", "Воздуховод", "Штукатурка", "Гипсокартон"])
  })

  it("RC-146: страница «Черновые работы» по-прежнему даёт записи штукатурки и стяжки, без «Гипсокартон»", () => {
    const d = drawing({ walls: TWO(), roughPlaster: [plaster("a", "k1", 1, "a", 0, 420, 20)], roughScreeds: [screed("s", 100, 160, 100)], reconstruction: content([G()]) })
    expect(labelsOf(d)[3]).toEqual(["Кирпич", "Штукатурка", "Стяжка до 100 мм"])
  })

  it("RC-147: образцы: «Штукатурка» на пятой странице — серый, на четвёртой — фиолетовый (слева от области чертежа)", () => {
    const d = drawing({ walls: TWO(), roughPlaster: [plaster("a", "k1", 1, "a", 0, 420, 20)], reconstruction: content([G()]) })
    const doc = build(d)
    const sample = (n: number, color: readonly number[]): boolean => parsePaint(doc, n).some((op) => op.kind === "fill" && near(op.color, color) && !!op.box && op.box.x < 60)
    expect(sample(4, PURPLE)).toBe(true)
    expect(sample(5, PURPLE)).toBe(false)
    expect(sample(5, GREY)).toBe(true)
  })

  it("RC-148: образец «Гипсокартон» — зелёная заливка слева от области чертежа", () => {
    const d = drawing({ walls: TWO(), reconstruction: content([G()]) })
    const doc = build(d)
    expect(parsePaint(doc, 5).some((op) => op.kind === "fill" && near(op.color, GREEN) && !!op.box && op.box.x < 60)).toBe(true)
  })

  it("RC-149: запись «Гипсокартон» входит в ширину столбца легенды документа", () => {
    const base = drawing({ walls: TWO() })
    const full = drawing({ walls: TWO(), reconstruction: content([G()]) })
    expect(legendWidthMm(pagesOf(full))).toBeGreaterThanOrEqual(legendWidthMm(pagesOf(base)))
  })

  it("RC-150: самый большой набор записей страницы «Реконструкция» — десять; по высоте помещается на A3", () => {
    const battery: Battery = { id: "b1", wallId: "k1", face: 1, anchor: "a", offsetCm: 100, lengthCm: 70, thicknessCm: 10, gapCm: 3 }
    const materials = ["blocks", "brick", "concrete", "gkl", "wood-long"] as const
    const walls = [...rectWalls("k", 0, 0, 420, 320), ...materials.map((m, i) => wall(`m${i}`, 600, i * 60, 800, i * 60, 10, m))]
    const riser: Communication = { kind: "riser", id: "r1", x: 200, y: 160, diameterCm: 11 }
    const duct: Communication = { kind: "duct", id: "d1", x: 300, y: 200, widthCm: 30, depthCm: 20 }
    const d = { ...drawing({ walls, roughPlaster: [plaster("a", "k1", 1, "a", 0, 420, 20)], reconstruction: content([G()]) }), batteries: [battery], communications: [riser, duct] }
    const entries = legendEntries(pagesOf(d)[4] as NonNullable<ReturnType<typeof pagesOf>[number]>)
    expect(entries).toHaveLength(10)
    expect(entries.length * LEGEND_ROW_PITCH_MM).toBeLessThanOrEqual(222)
  })
})
