import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { PLANS, toolsOf } from "../plans"
import { FURNITURE_KIND_ORDER } from "./furniture-kinds"

// change furniture-plan-table: разметка группы «Мебель» и связки в main.ts
// (spec furniture-plan «Панель группы «Мебель» и инструмента «Стол»», canvas-app «Вспомогательная панель инструмента»).
// TCR (change furniture-items-catalog, design D4): кнопки видов строятся из каталога (в разметке их нет), поля панели общие для
// видов и названы furniture-*, инструмент группы — «furniture»; утверждения о составе панели и связках сохранены.

const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8")
const toolbarStart = html.indexOf('id="toolbar"')
const toolbar = html.slice(toolbarStart, html.indexOf("</aside>", toolbarStart))
const main = readFileSync(new URL("../main.ts", import.meta.url), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1")

const anchorStart = toolbar.indexOf('data-tools="furniture"')
const anchor = toolbar.slice(anchorStart, toolbar.indexOf('class="tool-anchor"', anchorStart + 1))
const panel = anchor.slice(anchor.indexOf('id="furniture-panel"'))

describe("разметка группы «Мебель»", () => {
  it("FP-360: кнопка группы с иконкой и панель правее, как у других групп (tool-anchor + tool-panel)", () => {
    expect(anchorStart).toBeGreaterThan(0)
    expect(anchor).toMatch(/<button id="tool-furniture" class="tool"[^>]*title="Мебель"/)
    expect(anchor).toContain("<svg")
    expect(panel).toMatch(/^id="furniture-panel" class="panel tool-panel"/)
  })

  it("FP-361: в панели одна кнопка на вид каталога (сейчас «Стол»), выделенная как текущая; вне панели кнопок видов нет", () => {
    expect(panel).toMatch(/id="furniture-kinds" class="group-tools"/)
    expect([...panel.matchAll(/<button/g)]).toHaveLength(0)
    expect(toolbar).not.toContain("tool-furniture-")
    // TCR (change add-furniture-chair): в каталоге новый вид
    // TCR (change add-furniture-sofa): в каталоге новый вид
    // TCR (change add-furniture-desk-office-chair): в каталоге новые виды
    // TCR (change add-furniture-tv-wall-cabinet): в каталоге новые виды
    // TCR (change add-furniture-bed-nightstand): в каталоге новые виды
    // TCR (change add-furniture-wardrobes): в каталоге новые виды
    expect(FURNITURE_KIND_ORDER).toEqual(["table", "chair", "sofa", "desk", "officeChair", "tv", "wallCabinet", "bed", "nightstand", "slidingWardrobe", "doubleWardrobe", "curtains", "kitchenCabinet", "fridge", "wineCabinet", "hob", "dishwasher", "sink", "kitchenColumn", "oven", "microwave", "washer", "dryer", "toilet", "tropicalShower"]) // TCR (change add-furniture-kitchen-cabinet-fridge, add-furniture-kitchen-objects, add-furniture-appliances, add-toilet, add-furniture-tropical-shower): в каталоге новые виды
    expect(main).toContain("FURNITURE_KIND_ORDER.map((kind)")
    expect(main).toContain("button.id = `tool-furniture-${kind}`")
    expect(main).toContain('button.className = "group-tool"')
    expect(main).toContain('button.classList.toggle("active", tool === "furniture" && kind === furnitureKind)')
  })

  it("FP-362: поля панели — «Ширина», «Длина», «Угол»; других полей у группы нет", () => {
    const inputs = [...panel.matchAll(/<input[^>]*id="([^"]+)"/g)].map((m) => m[1])
    // TCR (change add-toilet): четыре поля унитаза скрыты, пока активен и выделен не унитаз (spec furniture-plan «Панель унитаза»);
    // общие поля остались теми же, других общих полей нет
    expect(inputs).toEqual(["furniture-width", "furniture-length", "furniture-bowl-width", "furniture-bowl-length", "furniture-block-width", "furniture-block-depth", "furniture-angle"])
    expect(panel).toContain("Ширина")
    expect(panel).toContain("Длина")
    expect(panel).toContain("Угол")
    for (const tag of ["<select", "<textarea"]) expect(panel.includes(tag), tag).toBe(false)
  })

  it("FP-363: единицы подписей полей «Ширина» и «Длина» задаёт main.ts, подпись «Угол» — градусы", () => {
    expect(panel).toContain('id="furniture-width-unit"')
    expect(panel).toContain('id="furniture-length-unit"')
    expect(panel).toMatch(/Угол, °/)
  })

  it("FP-364: группа показывается только на плане «Мебель»: её инструмент входит в набор одного плана", () => {
    const plans = PLANS.filter((p) => toolsOf(p.id).some((t) => t === "furniture")).map((p) => p.id)
    expect(plans).toEqual(["furniture"])
  })
})

describe("связки в main.ts", () => {
  it("FP-365: кнопки группы, инструмента и поля панели подключены", () => {
    expect(main).toContain('toolFurnitureBtn.addEventListener("click"')
    expect(main).toContain('button.addEventListener("click", () => applyFurnitureGroup(groupPick(furnitureGroupState(), kind)))')
    for (const field of ["widthCm", "lengthCm", "angleDeg"]) expect(main).toContain(`applyItemField("${field}"`)
  })

  it("FP-366: переходы группы — те же функции, что у групп «Проёмы» и «Коммуникации»", () => {
    expect(main).toContain("groupButtonClick(furnitureGroupState())")
  })

  it("FP-367: шаги истории плана «Мебель» — записи furniture; общая запись стен на этом плане не пишется", () => {
    expect(main).toContain("recordFurniture(activeHistory(), { items, dimensions })")
    expect(main).toContain("stepFurniture(undoFurniture)")
    expect(main).toContain("stepFurniture(redoFurniture)")
  })
})
