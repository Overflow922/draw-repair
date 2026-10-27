import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

// change add-light-switch: кнопка и панель «Выключатель» в разметке (spec canvas-app «Кнопка «Выключатель»», «Панель выключателя»;
// design D5)

const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8")
const toolbarStart = html.indexOf('id="toolbar"')
const toolbar = html.slice(toolbarStart, html.indexOf("</aside>", toolbarStart))

const anchorOf = (tools: string): string => {
  const start = toolbar.indexOf(`data-tools="${tools}"`)
  if (start < 0) return ""
  const next = toolbar.indexOf('class="tool-anchor"', start)
  return toolbar.slice(start, next < 0 ? toolbar.length : next)
}

describe("панель «Выключатель»", () => {
  it("LS-90: якорь инструмента — кнопка «Выключатель» и панель справа от неё; это одна кнопка без группы", () => {
    const anchor = anchorOf("lightSwitch")
    expect(anchor).toContain('id="tool-light-switch"')
    expect(anchor).toContain('title="Выключатель"')
    expect(anchor.indexOf('id="tool-light-switch"')).toBeLessThan(anchor.indexOf('id="light-switch-panel"'))
    expect(anchor).not.toContain("group-tool")
  })

  it("LS-91: в панели одно поле «Клавиш», по умолчанию 1; других полей нет", () => {
    const anchor = anchorOf("lightSwitch")
    const panel = anchor.slice(anchor.indexOf('id="light-switch-panel"'))
    expect([...panel.matchAll(/<input/g)]).toHaveLength(1)
    expect(panel).toContain('id="light-switch-keys"')
    expect(panel).toContain('value="1"')
    expect(panel).toContain("<span>Клавиш</span>")
    for (const tag of ["<select", "<textarea"]) expect(panel.includes(tag), tag).toBe(false)
  })

  it("LS-92: кнопка стоит сразу после кнопки «Линия освещения»", () => {
    expect(toolbar.indexOf('data-tools="lightSwitch"')).toBeGreaterThan(toolbar.indexOf('data-tools="lightLine"'))
    expect(toolbar.indexOf('data-tools="lightSwitch"')).toBeLessThan(toolbar.indexOf('data-tools="wall"'))
  })

  it("LS-93: значок знака рисуется цветом освещения", () => {
    expect(anchorOf("lightSwitch")).toContain('stroke="var(--lighting-red)"')
  })
})
