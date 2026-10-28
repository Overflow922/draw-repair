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

const groups = readFileSync(new URL("./furniture-groups.ts", import.meta.url), "utf8")

// change furniture-kind-groups: четыре якоря групп видов (data-furniture-group); панель одна и переезжает под кнопку открытой группы
const anchorStart = toolbar.indexOf('data-tools="furniture"')
const anchors = [...toolbar.matchAll(/<div class="tool-anchor" data-tools="furniture" data-furniture-group="([a-z]+)">([\s\S]*?)(?=<div class="tool-anchor"|<div class="tool-separator"|$)/g)]
const panelStart = toolbar.indexOf('id="furniture-panel"')
const panel = toolbar.slice(panelStart, toolbar.indexOf('<div class="tool-anchor"', panelStart))

describe("разметка групп видов мебели", () => {
  it("FP-360: четыре кнопки групп «Комната», «Спальня», «Кухня», «Санузел» идут первыми, каждая со своей иконкой; кнопки «Мебель» нет", () => {
    expect(anchorStart).toBeGreaterThan(0)
    expect(anchors.map((a) => a[1])).toEqual(["room", "bedroom", "kitchen", "bathroom"])
    const titles = ["Комната", "Спальня", "Кухня", "Санузел"]
    anchors.forEach((a, i) => {
      expect(a[2]).toMatch(new RegExp(`<button id="tool-furniture-group-${a[1]}" class="tool"[^>]*title="${titles[i]}"`))
      expect(a[2]).toContain("<svg")
    })
    expect(toolbar).not.toMatch(/title="Мебель"/)
    expect(toolbar).not.toContain('id="tool-furniture"')
    expect(toolbar.slice(0, anchorStart).includes("<button")).toBe(false)
  })

  it("FP-360a: панель одна, как у других групп (tool-panel), и лежит внутри якоря группы", () => {
    expect([...toolbar.matchAll(/id="furniture-panel"/g)]).toHaveLength(1)
    expect(panel).toMatch(/^id="furniture-panel" class="panel tool-panel"/)
    expect(anchors[0]?.[2]).toContain('id="furniture-panel"')
  })

  it("FP-361: кнопки видов строятся из каталога (в разметке их нет) и показываются по группе открытой панели; вне панели кнопок видов нет", () => {
    expect(panel).toMatch(/id="furniture-kinds" class="group-tools"/)
    expect([...panel.matchAll(/<button/g)]).toHaveLength(0)
    expect(toolbar.replace(/tool-furniture-group-/g, "")).not.toContain("tool-furniture-")
    // TCR (change add-furniture-chair): в каталоге новый вид
    // TCR (change add-furniture-sofa): в каталоге новый вид
    // TCR (change add-furniture-desk-office-chair): в каталоге новые виды
    // TCR (change add-furniture-tv-wall-cabinet): в каталоге новые виды
    // TCR (change add-furniture-bed-nightstand): в каталоге новые виды
    // TCR (change add-furniture-wardrobes): в каталоге новые виды
    expect(FURNITURE_KIND_ORDER).toEqual(["table", "chair", "sofa", "desk", "officeChair", "tv", "wallCabinet", "bed", "nightstand", "slidingWardrobe", "doubleWardrobe", "curtains", "kitchenCabinet", "fridge", "wineCabinet", "hob", "dishwasher", "sink", "kitchenColumn", "oven", "microwave", "washer", "dryer", "toilet", "tropicalShower", "wallShowerDrain", "washbasin"]) // TCR (change add-furniture-kitchen-cabinet-fridge, add-furniture-kitchen-objects, add-furniture-appliances, add-toilet, add-furniture-tropical-shower, add-wall-shower-drain, add-washbasin): в каталоге новые виды
    expect(main).toContain("FURNITURE_KIND_ORDER.map((kind)")
    expect(main).toContain("button.id = `tool-furniture-${kind}`")
    expect(main).toContain('button.className = "group-tool"')
    expect(main).toContain('button.classList.toggle("active", menu.active && kind === menu.current[groupOf(kind)])')
    expect(main).toContain("button.hidden = menu.panel === null || groupOf(kind) !== menu.panel")
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
  it("FP-365: кнопки групп, видов и поля панели подключены", () => {
    expect(main).toContain('button.addEventListener("click", () => applyFurnitureMenu(clickGroup(furnitureMenu(), group)))')
    expect(main).toContain('button.addEventListener("click", () => applyFurnitureMenu(pickKind(furnitureMenu(), kind)))')
    for (const field of ["widthCm", "lengthCm", "angleDeg"]) expect(main).toContain(`applyItemField("${field}"`)
  })

  it("FP-366: переходы групп видов — те же функции, что у групп «Проёмы» и «Коммуникации»", () => {
    expect(groups).toContain("groupButtonClick(")
    expect(groups).toContain("groupPick(")
  })

  it("FP-368: выделение предмета открывает панель группы его вида, установка оставляет её открытой", () => {
    expect(main).toContain("revealSelection(")
    expect(main).toContain("placed(")
  })

  it("FP-367: шаги истории плана «Мебель» — записи furniture; общая запись стен на этом плане не пишется", () => {
    expect(main).toContain("recordFurniture(activeHistory(), { items, dimensions })")
    expect(main).toContain("stepFurniture(undoFurniture)")
    expect(main).toContain("stepFurniture(redoFurniture)")
  })
})
