import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

// change furniture-plan-table: плашка пересечений в разметке и стилях (spec furniture-plan «Пересечения стола»; design D8)

const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8")
const css = readFileSync(new URL("../style.css", import.meta.url), "utf8")
const rule = (selector: string): string => css.match(new RegExp(`${selector.replace(/[#[\]]/g, "\\$&")}\\s*\\{([^}]*)\\}`))?.[1] ?? ""

describe("плашка пересечений", () => {
  it("FP-330: элемент есть, по умолчанию скрыт, лежит над холстом, а не в панели инструментов", () => {
    const wrap = html.slice(html.indexOf('id="canvas-wrap"'), html.indexOf("</main>"))
    expect(wrap).toMatch(/<div id="furniture-warning"[^>]*\bhidden\b/)
    const toolbar = html.slice(html.indexOf('id="toolbar"'), html.indexOf("</aside>"))
    expect(toolbar).not.toContain("furniture-warning")
  })

  it("FP-331: стоит в правом верхнем углу с отступом 12 px и не перехватывает клики", () => {
    const r = rule("#furniture-warning")
    expect(r).toMatch(/position:\s*absolute/)
    expect(r).toMatch(/top:\s*12px/)
    expect(r).toMatch(/right:\s*12px/)
    expect(r).toMatch(/pointer-events:\s*none/)
  })

  it("FP-331: красная палитра попапов (--popup-*) для обеих схем", () => {
    const r = rule("#furniture-warning")
    expect(r).toContain("var(--popup-text)")
    expect(r).toContain("var(--popup-bg)")
    expect(r).toContain("var(--popup-border)")
    expect(css.match(/--popup-text:/g)).toHaveLength(2)
  })

  it("FP-332: плашка не содержит кнопок и полей — не закрывается и не открывает диалогов", () => {
    const tag = html.match(/<div id="furniture-warning"[^>]*><\/div>/)
    expect(tag).not.toBeNull()
  })
})
