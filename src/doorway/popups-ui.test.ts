import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import * as group from "./openings-group"

// change popups-buttons-only: инвариант вспомогательных панелей в разметке и связки в main.ts
// (spec canvas-app «Вспомогательная панель инструмента», «Панель группы «Проёмы»»; door «Направление выделенной
// двери»; doorway «Инструмент «Проём» и параметры новых проёмов»; design D3, D4, D7).

const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8")
// исходник main.ts без комментариев: упоминание в комментарии не должно удовлетворять проверкам
const main = readFileSync(new URL("../main.ts", import.meta.url), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1")

const toolbarStart = html.indexOf('id="toolbar"')
const toolbar = html.slice(toolbarStart, html.indexOf("</aside>", toolbarStart))

// содержимое панели: от её открывающего тега до следующего якоря инструмента, разделителя или конца панели
function panel(id: string): string {
  const start = toolbar.indexOf(`id="${id}"`)
  if (start < 0) return ""
  const ends = ['class="tool-anchor"', 'class="tool-separator"']
    .map((m) => toolbar.indexOf(m, start))
    .filter((i) => i > start)
  return toolbar.slice(start, ends.length ? Math.min(...ends) : toolbar.length)
}

const count = (s: string, re: RegExp): number => [...s.matchAll(re)].length

describe("разметка панелей", () => {
  it("PB-UI-01: панель группы «Проёмы» — только кнопки; панель «Стена» — кнопки образцов и поле толщины", () => {
    const openings = panel("openings-panel")
    expect(openings.length).toBeGreaterThan(0)
    for (const tag of ["<input", "<select", "<textarea", "<label"]) expect(openings.includes(tag), tag).toBe(false)
    const wall = panel("wall-panel")
    expect(count(wall, /<input/g)).toBe(1)
    expect(wall).toContain('id="thickness"')
    for (const tag of ["<select", "<textarea"]) expect(wall.includes(tag), tag).toBe(false)
  })

  it("PB-GR-01: в панели группы ровно две кнопки — «Проём», затем «Дверь»", () => {
    const openings = panel("openings-panel")
    const ids = [...openings.matchAll(/<button[^>]*id="([^"]+)"/g)].map((m) => m[1])
    expect(ids).toEqual(["tool-doorway", "tool-door"])
    expect(count(openings, /<button/g)).toBe(2)
  })

  it("PB-UI-02: панели есть только у «Стена» и группы «Проёмы»; удалённых полей и панелей нет", () => {
    expect(count(toolbar, /class="[^"]*\btool-panel\b/g)).toBe(2)
    for (const id of [
      "window-panel",
      "dim-panel",
      "door-rotate",
      "doorway-width",
      "doorway-height",
      "door-width",
      "door-height",
      "window-width",
      "window-height",
      "window-sill",
      "dim-offset",
      "dim-value",
      "doorway-fields",
      "door-fields",
    ])
      expect(html.includes(`id="${id}"`), id).toBe(false)
    // кнопки инструментов без панели остаются на панели инструментов
    for (const id of ["tool-window", "tool-dimension", "tool-ruler", "tool-eraser"]) expect(toolbar.includes(`id="${id}"`), id).toBe(true)
  })
})

describe("группа «Проёмы»", () => {
  it("PB-GR-02: переходы группы — кнопка группы и выбор в панели (переход после установки — afterPlace в tool-mode, change select-only-without-tool); состояния реакции на выделение нет", () => {
    expect(Object.keys(group).sort()).toEqual(["groupButtonActive", "groupButtonClick", "groupPick"])
    expect(main.includes("groupSelect")).toBe(false)
  })
})

describe("связки в main.ts", () => {
  it("PB-INT-01: параметры новых элементов — одно значение приложения из initialParams(), вне вкладок", () => {
    expect(count(main, /initialParams\(\)/g)).toBe(1)
    const storage = readFileSync(new URL("../storage.ts", import.meta.url), "utf8")
    expect(storage.includes("initialParams")).toBe(false)
    expect(storage.includes("NewElementParams")).toBe(false)
  })

  it("PB-INT-03: хост элементов читает и наследует одно значение параметров приложения", () => {
    // let <имя>(: тип)? = initialParams()
    const decl = /\blet\s+(\w+)\s*(?::[^=]+)?=\s*initialParams\(\)/.exec(main)
    expect(decl).not.toBeNull()
    if (!decl) return
    const v = decl[1]
    // наследование — единственный вызов inheritFrom, результат присваивается тому же значению
    expect(count(main, /\binheritFrom\(/g)).toBe(1)
    expect(new RegExp(`\\b${v}\\s*=\\s*inheritFrom\\(\\s*${v}\\s*,`).test(main)).toBe(true)
    // хост: params возвращает это значение, inherit вызывает присваивание через inheritFrom
    const host = main.slice(main.indexOf("ElementToolHost = {"), main.indexOf("ElementToolHost = {") + 4000)
    expect(main.includes("ElementToolHost = {")).toBe(true)
    expect(new RegExp(`\\bparams\\s*(?::\\s*\\(\\)\\s*=>|\\(\\)[^{]*\\{[^}]*return)\\s*${v}\\b`).test(host)).toBe(true)
    const inherit = /\binherit\s*(?::\s*\([^)]*\)\s*=>|\([^)]*\)[^{]*)\s*\{?([^}]*)/.exec(host)
    expect(inherit).not.toBeNull()
    if (inherit) expect(inherit[0]).toMatch(new RegExp(`\\b${v}\\s*=\\s*inheritFrom\\(`))
  })

  it("PB-INT-02: нажатие без инструмента — правимое число, затем зона двери, затем выбор цели", () => {
    const start = main.indexOf('addEventListener("pointerdown"')
    expect(start).toBeGreaterThanOrEqual(0)
    const body = main.slice(start)
    const num = body.indexOf(".pressNumber(")
    const zone = body.indexOf(".pressZone(")
    const pick = body.indexOf("pressPick(")
    expect(num).toBeGreaterThan(0)
    expect(zone).toBeGreaterThan(num)
    expect(pick).toBeGreaterThan(zone)
    // обе проверки — после выхода при активном инструменте (change select-only-without-tool)
    const guard = body.lastIndexOf("!selectionAllowed(tool)", num)
    expect(guard).toBeGreaterThanOrEqual(0)
  })
})
