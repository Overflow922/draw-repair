import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { CEILING_DROP_DEFAULT } from "./ceiling"

// change add-ceiling-plan: кнопка и панель «Натяжной потолок» в разметке (spec canvas-app «Панель «Натяжной потолок»»,
// «Поле только в панели «Примечания»»; design D5)

const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8")
const toolbarStart = html.indexOf('id="toolbar"')
const toolbar = html.slice(toolbarStart, html.indexOf("</aside>", toolbarStart))

const anchorOf = (tools: string): string => {
  const start = toolbar.indexOf(`data-tools="${tools}"`)
  if (start < 0) return ""
  const next = toolbar.indexOf('class="tool-anchor"', start)
  return toolbar.slice(start, next < 0 ? toolbar.length : next)
}

describe("панель «Натяжной потолок»", () => {
  it("CP-120: якорь инструмента — кнопка «Натяжной потолок» и панель справа от неё", () => {
    const anchor = anchorOf("stretchCeiling")
    expect(anchor).toContain('id="tool-stretch-ceiling"')
    expect(anchor).toContain('title="Натяжной потолок"')
    expect(anchor.indexOf('id="tool-stretch-ceiling"')).toBeLessThan(anchor.indexOf('id="ceiling-panel"'))
  })

  it("CP-121: в панели одно поле — опускание в миллиметрах, 50 по умолчанию; других полей нет", () => {
    const panel = anchorOf("stretchCeiling").slice(anchorOf("stretchCeiling").indexOf('id="ceiling-panel"'))
    expect([...panel.matchAll(/<input/g)]).toHaveLength(1)
    expect(panel).toContain('id="ceiling-drop"')
    expect(panel).toContain(`value="${CEILING_DROP_DEFAULT}"`)
    expect(panel).toContain("мм")
    for (const tag of ["<select", "<textarea"]) expect(panel.includes(tag), tag).toBe(false)
  })

  it("CP-122: значок — прямоугольник с жёлтой заливкой цветом схемы", () => {
    expect(anchorOf("stretchCeiling")).toMatch(/<rect[^>]*fill="var\(--ceiling\)"/)
  })
})
