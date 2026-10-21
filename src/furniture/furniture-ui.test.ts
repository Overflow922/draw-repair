import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { PLANS, toolsOf } from "../plans"

// change furniture-plan-table: разметка группы «Мебель» и связки в main.ts
// (spec furniture-plan «Панель группы «Мебель» и инструмента «Стол»», canvas-app «Вспомогательная панель инструмента»).

const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8")
const toolbarStart = html.indexOf('id="toolbar"')
const toolbar = html.slice(toolbarStart, html.indexOf("</aside>", toolbarStart))
const main = readFileSync(new URL("../main.ts", import.meta.url), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1")

const anchorStart = toolbar.indexOf('data-tools="table"')
const anchor = toolbar.slice(anchorStart, toolbar.indexOf('class="tool-anchor"', anchorStart + 1))
const panel = anchor.slice(anchor.indexOf('id="furniture-panel"'))

describe("разметка группы «Мебель»", () => {
  it("FP-360: кнопка группы с иконкой и панель правее, как у других групп (tool-anchor + tool-panel)", () => {
    expect(anchorStart).toBeGreaterThan(0)
    expect(anchor).toMatch(/<button id="tool-furniture" class="tool"[^>]*title="Мебель"/)
    expect(anchor).toContain("<svg")
    expect(panel).toMatch(/^id="furniture-panel" class="panel tool-panel"/)
  })

  it("FP-361: в панели одна кнопка инструмента — «Стол», выделенная как текущая; кнопки «Стол» вне панели нет", () => {
    const buttons = [...panel.matchAll(/<button[^>]*id="([^"]+)"[^>]*>/g)].map((m) => m[1])
    expect(buttons).toEqual(["tool-table"])
    expect(panel).toMatch(/id="tool-table" class="group-tool active"/)
    expect(toolbar.match(/id="tool-table"/g)).toHaveLength(1)
  })

  it("FP-362: поля панели — «Ширина», «Длина», «Угол»; других полей у группы нет", () => {
    const inputs = [...panel.matchAll(/<input[^>]*id="([^"]+)"/g)].map((m) => m[1])
    expect(inputs).toEqual(["table-width", "table-length", "table-angle"])
    expect(panel).toContain("Ширина")
    expect(panel).toContain("Длина")
    expect(panel).toContain("Угол")
    for (const tag of ["<select", "<textarea"]) expect(panel.includes(tag), tag).toBe(false)
  })

  it("FP-363: единицы подписей полей «Ширина» и «Длина» задаёт main.ts, подпись «Угол» — градусы", () => {
    expect(panel).toContain('id="table-width-unit"')
    expect(panel).toContain('id="table-length-unit"')
    expect(panel).toMatch(/Угол, °/)
  })

  it("FP-364: группа показывается только на плане «Мебель»: её инструмент входит в набор одного плана", () => {
    const plans = PLANS.filter((p) => toolsOf(p.id).some((t) => t === "table")).map((p) => p.id)
    expect(plans).toEqual(["furniture"])
  })
})

describe("связки в main.ts", () => {
  it("FP-365: кнопки группы, инструмента и поля панели подключены", () => {
    expect(main).toContain('toolFurnitureBtn.addEventListener("click"')
    expect(main).toContain('toolTableBtn.addEventListener("click"')
    for (const field of ["widthCm", "lengthCm", "angleDeg"]) expect(main).toContain(`applyTableField("${field}"`)
  })

  it("FP-366: переходы группы — те же функции, что у групп «Проёмы» и «Коммуникации»", () => {
    expect(main).toContain("groupButtonClick(furnitureGroupState())")
    expect(main).toContain('groupPick(furnitureGroupState(), "table")')
  })

  it("FP-367: шаги истории плана «Мебель» — записи furniture; общая запись стен на этом плане не пишется", () => {
    expect(main).toContain("recordFurniture(activeHistory(), { tables, dimensions })")
    expect(main).toContain("stepFurniture(undoFurniture)")
    expect(main).toContain("stepFurniture(redoFurniture)")
  })
})
