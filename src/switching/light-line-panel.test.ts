import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

// change add-light-lines: кнопка и панель «Линия освещения» в разметке (spec canvas-app «Кнопка «Линия освещения»»,
// «Панель линии»; design D4)

const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8")
const toolbarStart = html.indexOf('id="toolbar"')
const toolbar = html.slice(toolbarStart, html.indexOf("</aside>", toolbarStart))

const anchorOf = (tools: string): string => {
  const start = toolbar.indexOf(`data-tools="${tools}"`)
  if (start < 0) return ""
  const next = toolbar.indexOf('class="tool-anchor"', start)
  return toolbar.slice(start, next < 0 ? toolbar.length : next)
}

describe("панель «Линия освещения»", () => {
  it("LL-90: якорь инструмента — кнопка «Линия освещения» и панель справа от неё; это одна кнопка без группы", () => {
    const anchor = anchorOf("lightLine")
    expect(anchor).toContain('id="tool-light-line"')
    expect(anchor).toContain('title="Линия освещения"')
    expect(anchor.indexOf('id="tool-light-line"')).toBeLessThan(anchor.indexOf('id="light-line-panel"'))
    expect(anchor).not.toContain("group-tool")
  })

  it("LL-91: в панели одно меню «Линия» (select); числового поля и других элементов нет", () => {
    const anchor = anchorOf("lightLine")
    const panel = anchor.slice(anchor.indexOf('id="light-line-panel"'))
    expect([...panel.matchAll(/<select/g)]).toHaveLength(1)
    expect(panel).toContain('id="light-line-number"')
    expect(panel).toContain("<span>Линия</span>")
    for (const tag of ["<input", "<textarea"]) expect(panel.includes(tag), tag).toBe(false)
  })

  it("LL-92: значок — подпись «L1» красным цветом освещения", () => {
    expect(anchorOf("lightLine")).toMatch(/<text[^>]*fill="var\(--lighting-red\)"[^>]*>L1<\/text>/)
  })
})
