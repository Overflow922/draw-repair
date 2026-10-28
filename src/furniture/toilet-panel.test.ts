import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

// change add-toilet: поля панели унитаза (spec furniture-plan «Панель унитаза»). Как furniture-ui.test.ts, проверяется разметка
// и связки в main.ts: поведение полей — в toilet-model.test.ts (правка) и toilet-numbers.test.ts (ввод в числа).

const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8")
const main = readFileSync(new URL("../main.ts", import.meta.url), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1")

const panelStart = html.indexOf('id="furniture-panel"')
const panel = html.slice(panelStart, html.indexOf("</aside>", panelStart))

describe("панель унитаза", () => {
  it("TLP-01: в панели четыре скрытых по умолчанию поля унитаза с подписями в единицах и поле угла", () => {
    for (const [id, label] of [
      ["furniture-bowl-width", "Ширина чаши"],
      ["furniture-bowl-length", "Длина чаши"],
      ["furniture-block-width", "Ширина блока"],
      ["furniture-block-depth", "Глубина блока"],
    ]) {
      expect(panel).toMatch(new RegExp(`<label class="thickness-field" data-toilet-field hidden[^>]*>\\s*<span id="${id}-unit">${label}, мм</span>\\s*<input id="${id}" type="text" inputmode="decimal" />`))
    }
    expect(panel).toContain('id="furniture-angle"')
  })

  it("TLP-02: поля ширины и длины предмета помечены и скрываются у унитаза", () => {
    expect([...panel.matchAll(/data-size-field/g)]).toHaveLength(2)
    expect(panel).toMatch(/data-size-field[^>]*title="Ширина \(вдоль X/)
    expect(panel).toMatch(/data-size-field[^>]*title="Длина \(вдоль Y/)
    expect(main).toContain('(selected?.kind ?? furnitureKind) === "toilet"')
    expect(main).toContain("for (const el of furnitureSizeFields) el.hidden = toiletPanel")
    expect(main).toContain("for (const el of furnitureToiletFields) el.hidden = !toiletPanel")
  })

  it("TLP-03: каждое поле применяется по фиксации ввода и не отдаёт клавиши холсту", () => {
    expect(main).toContain('f.input.addEventListener("change", () => applyToiletField(f.key, f.input))')
    expect(main).toContain("...toiletPanelFields.map((f) => f.input)")
    expect(main).toMatch(/function applyToiletField\(key: keyof ToiletSizes, input: HTMLInputElement\)/)
  })

  it("TLP-04: правка поля идёт тем же путём, что поле ширины: выделенный унитаз заменяется одним шагом, иначе меняются значения для новых", () => {
    expect(main).toMatch(/editItemParams\(itemParamsOf\(furnitureKind\), itemTool\.selectedItem\(\), \{ toilet: patch \}\)/)
    expect(main).toContain("if (edited.table) itemTool.replaceSelected(edited.table)")
  })
})
