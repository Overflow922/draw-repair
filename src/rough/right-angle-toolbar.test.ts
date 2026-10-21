import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { toolsOf } from "../plans"
import { escapeAction } from "../tool-mode"

// change plaster-right-angle: кнопка «Прямой угол» на панели инструментов (spec canvas-app «Группы инструментов»,
// rough-works-plan «Инструмент «Прямой угол»»): одна кнопка, без панели параметров

const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8")
const buttonIds = [...html.matchAll(/<button id="(tool-[a-z-]+)"/g)].map((m) => m[1])

describe("кнопка «Прямой угол»", () => {
  it("RA-90: кнопка стоит между «Штукатуркой» и «Стяжкой»", () => {
    const at = (id: string): number => buttonIds.indexOf(id)
    expect(at("tool-right-angle")).toBeGreaterThan(at("tool-plaster"))
    expect(at("tool-right-angle")).toBeLessThan(at("tool-screed"))
  })

  it("RA-90: кнопка в наборе только плана «Черновые работы»", () => {
    expect(html).toMatch(/data-tools="rightAngle"/)
    for (const plan of ["measure", "demolition", "mounting", "reconstruction"] as const) expect(toolsOf(plan)).not.toContain("rightAngle")
    expect(toolsOf("rough")).toContain("rightAngle")
  })

  it("RA-91: у инструмента нет панели параметров и полей ввода", () => {
    const anchor = html.match(/<div class="tool-anchor" data-tools="rightAngle">[\s\S]*?<\/button>\s*<\/div>/)
    expect(anchor).not.toBeNull()
    expect(anchor?.[0]).not.toMatch(/panel|<input/)
    expect(html).not.toMatch(/id="right-angle-panel"/)
  })

  it("RA-93: Escape снимает активный инструмент, а без инструмента — выделение пометки", () => {
    const base = { gestureActive: false, dimensionDraft: false }
    expect(escapeAction({ ...base, tool: "rightAngle", hasSelection: false })).toBe("deactivate-tool")
    expect(escapeAction({ ...base, tool: "none", hasSelection: true })).toBe("clear-selection")
  })

  it("RA-92: у кнопки есть подпись", () => {
    expect(html).toMatch(/id="tool-right-angle"[^>]*title="Прямой угол"/)
  })
})
