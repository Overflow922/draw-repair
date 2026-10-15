import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { defaultToolOf, toolsOf } from "../plans"
import { afterPlace, escapeAction, selectionAllowed } from "../tool-mode"
import type { GroupState } from "../doorway/openings-group"

// change add-battery: кнопка и режим инструмента «Батарея» (spec canvas-app «Кнопка «Батарея»»; battery «Инструмент «Батарея» и
// параметры новых батарей»; design D10; test-plan B-TOOL-3, B-TOOL-4, B-TOOL-7).
// Конфликт с одобренными тестами: plan-tools.test.ts, mounting-plans.test.ts, communications/plans.test.ts проверяют прежние
// наборы инструментов без «Батареи»; это фиксируется в test-suite.md как test-change-request, а не правится здесь.

const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8")
const at = (needle: string): number => html.indexOf(needle)

const group: GroupState = { current: "doorway", active: "other", panelOpen: false }

describe("наборы инструментов планов", () => {
  it("B-TOOL-7: обмерочный план — «Батарея» сразу после «Окна», остальной порядок прежний", () => {
    expect(toolsOf("measure")).toEqual(["wall", "doorway", "door", "window", "battery", "riser", "duct", "dimension", "callout", "ruler", "notes", "eraser"])
  })

  it("B-TOOL-7b: «Монтаж» — «Батарея» сразу после «Окна»", () => {
    expect(toolsOf("mounting")).toEqual(["wall", "doorway", "door", "window", "battery", "dimension", "callout", "ruler", "notes", "eraser"])
  })

  it("B-TOOL-7c: «Демонтаж» — без кнопки «Батарея»: набор прежний", () => {
    expect(toolsOf("demolition")).toEqual(["demolition", "callout", "ruler", "notes", "eraser"])
    expect(toolsOf("demolition")).not.toContain("battery")
  })

  it("B-TOOL-7d: инструмент по умолчанию у планов не меняется", () => {
    expect(defaultToolOf("measure")).toBe("wall")
    expect(defaultToolOf("mounting")).toBe("wall")
    expect(defaultToolOf("demolition")).toBe("demolition")
  })
})

describe("режим инструмента", () => {
  it("B-TOOL-1b: после установки «Батарея» снимается, группа «Проёмы» не меняется", () => {
    expect(afterPlace("battery", group)).toEqual({ tool: "none", group })
  })

  it("B-TOOL-4: Esc при активном инструменте снимает его", () => {
    expect(escapeAction({ tool: "battery", gestureActive: false, dimensionDraft: false, hasSelection: false })).toBe("deactivate-tool")
  })

  it("B-TOOL-4b: при активном инструменте выделять и править существующие объекты нельзя", () => {
    expect(selectionAllowed("battery")).toBe(false)
  })
})

describe("кнопка в index.html", () => {
  it("B-TOOL-3: кнопка «Батарея» стоит сразу после «Окна» и перед группой «Коммуникации»", () => {
    const window = at('id="tool-window"')
    const battery = at('id="tool-battery"')
    const communications = at('id="tool-communications"')
    expect(battery).toBeGreaterThan(window)
    expect(battery).toBeLessThan(communications)
  })

  it("B-TOOL-3b: у кнопки подпись «Батарея», якорь с data-tools=\"battery\" (виден там, где инструмент есть в наборе плана)", () => {
    expect(html).toMatch(/<div class="tool-anchor" data-tools="battery">\s*<button id="tool-battery" class="tool" title="Батарея" type="button">/)
  })

  it("B-TOOL-3c: вспомогательной панели у инструмента нет: между кнопкой и закрытием якоря нет блока panel", () => {
    const start = at('data-tools="battery"')
    expect(start).toBeGreaterThan(-1)
    const rest = html.slice(start)
    const anchorEnd = rest.indexOf("</div>")
    expect(rest.slice(0, anchorEnd)).not.toContain("tool-panel")
    expect(html).not.toContain('id="battery-panel"')
  })

  it("B-TOOL-3d: значок — SVG того же размера, что у соседних инструментов (32×32)", () => {
    const start = at('id="tool-battery"')
    const svg = /<svg width="32" height="32"/.exec(html.slice(start, start + 400))
    expect(svg).not.toBeNull()
  })
})
