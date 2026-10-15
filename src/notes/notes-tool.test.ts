import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { PLANS, defaultToolOf, toolsOf } from "../plans"
import { afterPlace, escapeAction, selectionAllowed } from "../tool-mode"

// change add-plan-notes: инструмент «Примечания» — наборы инструментов планов, кнопка и панель в index.html
// (spec plan-notes «Кнопка и панель «Примечания»»; canvas-app «Вспомогательная панель инструмента»; design D4).

const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8")
const at = (needle: string): number => html.indexOf(needle)

describe("наборы инструментов планов", () => {
  it("«Примечания» есть у каждого плана каталога ровно один раз", () => {
    for (const plan of PLANS) expect(toolsOf(plan.id).filter((t) => t === "notes")).toHaveLength(1)
  })

  it("«Примечания» стоят сразу после «Линейки» и перед «Ластиком» на каждом плане", () => {
    for (const plan of PLANS) {
      const tools = toolsOf(plan.id)
      const i = tools.indexOf("notes")
      expect(tools[i - 1]).toBe("ruler")
      expect(tools[i + 1]).toBe("eraser")
    }
  })

  it("остальные наборы остались прежними: без «Примечаний» они дают прежние списки", () => {
    const without = (plan: "measure" | "demolition" | "mounting"): string[] => toolsOf(plan).filter((t) => t !== "notes")
    expect(without("measure")).toEqual(["wall", "doorway", "door", "window", "battery", "riser", "duct", "dimension", "callout", "ruler", "eraser"])
    expect(without("demolition")).toEqual(["demolition", "callout", "ruler", "eraser"])
    expect(without("mounting")).toEqual(["wall", "doorway", "door", "window", "battery", "dimension", "callout", "ruler", "eraser"])
  })

  it("инструмент плана по умолчанию не меняется", () => {
    expect(defaultToolOf("measure")).toBe("wall")
    expect(defaultToolOf("mounting")).toBe("wall")
    expect(defaultToolOf("demolition")).toBe("demolition")
  })
})

describe("режим инструмента", () => {
  const state = { gestureActive: false, dimensionDraft: false, hasSelection: false }

  it("Esc снимает инструмент «Примечания»", () => {
    expect(escapeAction({ ...state, tool: "notes" })).toBe("deactivate-tool")
  })

  it("при активных «Примечаниях» объекты чертежа не выделяются и не правятся", () => {
    expect(selectionAllowed("notes")).toBe(false)
  })

  it("постановка объектов «Примечания» не снимает", () => {
    const group = { current: "doorway", active: "other", panelOpen: false } as const
    expect(afterPlace("notes", group)).toEqual({ tool: "notes", group })
  })
})

describe("кнопка и панель в index.html", () => {
  const buttonTag = (): string => {
    const i = at('id="tool-notes"')
    return html.slice(html.lastIndexOf("<button", i), html.indexOf(">", i))
  }
  const panel = (): string => {
    const i = at('id="notes-panel"')
    return html.slice(i, html.indexOf("</label>", i))
  }

  it("кнопка стоит после «Линейки» и перед «Ластиком», название «Примечания»", () => {
    const notes = at('id="tool-notes"')
    expect(notes).toBeGreaterThan(at('id="tool-ruler"'))
    expect(notes).toBeLessThan(at('id="tool-eraser"'))
    expect(buttonTag()).toContain('title="Примечания"')
  })

  it("кнопка в блоке с data-tools=\"notes\", единственная, со значком", () => {
    const i = at('id="tool-notes"')
    expect(html.slice(Math.max(0, i - 200), i)).toContain('data-tools="notes"')
    expect(html.split('id="tool-notes"')).toHaveLength(2)
    const button = html.slice(i, html.indexOf("</button>", i))
    expect(button).toContain("<svg")
    expect(button).toMatch(/<(path|line|rect|circle)\b/)
  })

  it("панель — в том же блоке, что кнопка, и использует общий класс панелей инструментов", () => {
    const i = at('id="notes-panel"')
    expect(i).toBeGreaterThan(at('id="tool-notes"'))
    expect(i).toBeLessThan(at('id="tool-eraser"'))
    expect(html.slice(html.lastIndexOf("<div", i), html.indexOf(">", i))).toContain("tool-panel")
  })

  it("в панели заголовок «Примечание» и одно многострочное поле, больше полей нет", () => {
    const p = panel()
    expect(p).toContain("Примечание")
    expect(p.match(/<textarea\b/g)).toHaveLength(1)
    expect(p).not.toMatch(/<input\b/)
    expect(p).not.toMatch(/<select\b/)
    expect(p).not.toMatch(/<button\b/)
  })

  it("полей ввода нет ни в одной другой панели, кроме «Стены» (толщина) и «Примечаний»", () => {
    for (const id of ["openings-panel", "communications-panel"]) {
      const i = at(`id="${id}"`)
      const end = html.indexOf("</aside>", i)
      const panelEnd = html.indexOf('<div class="tool-anchor"', i)
      const body = html.slice(i, Math.min(end, panelEnd === -1 ? end : panelEnd))
      expect(body, id).not.toMatch(/<(input|textarea|select)\b/)
    }
    const wallStart = at('id="wall-panel"')
    const wallBody = html.slice(wallStart, html.indexOf('<div class="tool-anchor"', wallStart))
    expect(wallBody.match(/<(input|textarea|select)\b/g)).toHaveLength(1)
    expect(wallBody).toContain('id="thickness"')
  })
})
