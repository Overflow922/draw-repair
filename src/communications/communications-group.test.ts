import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import type { GroupState as OpeningsState } from "../doorway/openings-group"
import { afterPlace, escapeAction, selectionAllowed } from "../tool-mode"
import { afterPlaceCommunication, groupButtonActive, groupButtonClick, groupPick } from "./communications-group"
import type { GroupState } from "./communications-group"

// change add-communications: группа «Коммуникации» — переходы состояния кнопки группы и её панели; разметка панели
// (spec canvas-app «Панель группы «Коммуникации»», «Группы инструментов», «Вспомогательная панель инструмента»;
// test-plan UI-*). Образец — openings-group.test.ts.

const initial: GroupState = { current: "riser", active: "other", panelOpen: false }

describe("кнопка группы «Коммуникации»", () => {
  it("UI-04: по умолчанию текущий инструмент группы — «Стояк»; клик активирует его и открывает панель", () => {
    expect(groupButtonClick(initial)).toEqual({ current: "riser", active: "riser", panelOpen: true })
  })

  it("UI-04b: повторные клики переключают панель, инструмент не меняется", () => {
    let s = groupButtonClick(initial)
    s = groupButtonClick(s)
    expect(s).toEqual({ current: "riser", active: "riser", panelOpen: false })
    s = groupButtonClick(s)
    expect(s).toEqual({ current: "riser", active: "riser", panelOpen: true })
  })

  it("UI-05: выбор «Воздуховод» делает его текущим и активным, панель открыта", () => {
    expect(groupPick(groupButtonClick(initial), "duct")).toEqual({ current: "duct", active: "duct", panelOpen: true })
    expect(groupPick(initial, "duct")).toEqual({ current: "duct", active: "duct", panelOpen: true })
  })

  it("UI-06: кнопка группы помнит последний инструмент после другого инструмента", () => {
    let s = groupPick(groupButtonClick(initial), "duct")
    s = { ...s, active: "other" }
    s = groupButtonClick(s)
    expect(s).toEqual({ current: "duct", active: "duct", panelOpen: true })
  })

  it("UI-07: кнопка группы активна при любом инструменте группы и неактивна иначе", () => {
    expect(groupButtonActive({ current: "riser", active: "riser", panelOpen: false })).toBe(true)
    expect(groupButtonActive({ current: "riser", active: "duct", panelOpen: false })).toBe(true)
    expect(groupButtonActive({ current: "duct", active: "other", panelOpen: true })).toBe(false)
  })

  it("UI-08: переходы не мутируют входное состояние", () => {
    const s: GroupState = { ...initial }
    groupButtonClick(s)
    groupPick(s, "duct")
    expect(s).toEqual(initial)
  })
})

describe("режим инструментов", () => {
  const openings: OpeningsState = { current: "door", active: "other", panelOpen: false }

  it("UI-09: после установки коммуникации инструмент группы снимается, панель закрывается, текущий инструмент помнится", () => {
    expect(afterPlaceCommunication({ current: "duct", active: "duct", panelOpen: true })).toEqual({ current: "duct", active: "other", panelOpen: false })
    expect(afterPlaceCommunication({ current: "riser", active: "riser", panelOpen: true })).toEqual({ current: "riser", active: "other", panelOpen: false })
  })

  it("UI-09b: общий afterPlace для «Стояк» и «Воздуховод» снимает инструмент и не трогает группу «Проёмы»", () => {
    for (const tool of ["riser", "duct"] as const) expect(afterPlace(tool, openings)).toEqual({ tool: "none", group: openings })
  })

  it("UI-10: выделять и править при активных «Стояк» и «Воздуховод» нельзя", () => {
    expect(selectionAllowed("riser")).toBe(false)
    expect(selectionAllowed("duct")).toBe(false)
    expect(selectionAllowed("none")).toBe(true)
  })

  it("UI-11: Esc при активном инструменте коммуникаций снимает инструмент, без инструмента — выделение", () => {
    for (const tool of ["riser", "duct"] as const)
      expect(escapeAction({ tool, gestureActive: false, dimensionDraft: false, hasSelection: true })).toBe("deactivate-tool")
    expect(escapeAction({ tool: "none", gestureActive: false, dimensionDraft: false, hasSelection: true })).toBe("clear-selection")
  })
})

describe("разметка панели инструментов", () => {
  const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8")
  const start = html.indexOf('id="toolbar"')
  const toolbar = html.slice(start, html.indexOf("</aside>", start))
  const at = (needle: string): number => toolbar.indexOf(needle)
  const panelOf = (id: string): string => {
    const from = at(`id="${id}"`)
    if (from < 0) return ""
    const ends = ['class="tool-anchor"', 'class="tool-separator"'].map((m) => toolbar.indexOf(m, from)).filter((i) => i > from)
    return toolbar.slice(from, ends.length ? Math.min(...ends) : toolbar.length)
  }

  it("UI-01: порядок «Стена», «Проёмы», «Окно», «Коммуникации», разделитель, «Размер», «Линейка», разделитель, «Ластик»", () => {
    const marks = ['id="tool-wall"', 'id="tool-openings"', 'id="tool-window"', 'id="tool-communications"', 'id="tool-dimension"', 'id="tool-ruler"', 'id="tool-eraser"']
    const pos = marks.map(at)
    for (const p of pos) expect(p).toBeGreaterThanOrEqual(0)
    expect([...pos].sort((p, q) => p - q)).toEqual(pos)
    const seps = [...toolbar.matchAll(/class="tool-separator"/g)].map((m) => m.index ?? -1)
    expect(seps).toHaveLength(2)
    expect(seps[0]).toBeGreaterThan(pos[3])
    expect(seps[0]).toBeLessThan(pos[4])
    expect(seps[1]).toBeGreaterThan(pos[5])
    expect(seps[1]).toBeLessThan(pos[6])
  })

  it("UI-01b: отдельных кнопок «Стояк» и «Воздуховод» на панели инструментов нет — они только в панели группы", () => {
    const panel = at('id="communications-panel"')
    expect(panel).toBeGreaterThan(at('id="tool-communications"'))
    expect(at('id="tool-riser"')).toBeGreaterThan(panel)
    expect(at('id="tool-duct"')).toBeGreaterThan(at('id="tool-riser"'))
    // обе — до разделителя перед «Размер», то есть внутри якоря группы
    expect(at('id="tool-duct"')).toBeLessThan(at('id="tool-dimension"'))
  })

  it("UI-02: панель группы — ровно две кнопки «Стояк», затем «Воздуховод», без полей ввода", () => {
    const panel = panelOf("communications-panel")
    expect(panel.length).toBeGreaterThan(0)
    const ids = [...panel.matchAll(/<button[^>]*id="([^"]+)"/g)].map((m) => m[1])
    expect(ids).toEqual(["tool-riser", "tool-duct"])
    expect([...panel.matchAll(/<button/g)]).toHaveLength(2)
    for (const tag of ["<input", "<select", "<textarea", "<label"]) expect(panel.includes(tag), tag).toBe(false)
  })

  it("UI-03: у кнопки группы своя иконка, отличная от иконок других кнопок", () => {
    const svgAfter = (id: string): string => {
      const i = at(`id="${id}"`)
      const s = toolbar.indexOf("<svg", i)
      return toolbar.slice(s, toolbar.indexOf("</svg>", s))
    }
    const group = svgAfter("tool-communications")
    expect(group.length).toBeGreaterThan(0)
    for (const other of ["tool-openings", "tool-window", "tool-wall", "tool-dimension", "tool-riser", "tool-duct"]) expect(group).not.toEqual(svgAfter(other))
  })

  it("UI-03b: у кнопки группы есть заголовок «Коммуникации»", () => {
    const tag = /<button[^>]*id="tool-communications"[^>]*>/.exec(toolbar)?.[0] ?? ""
    expect(tag).toContain('title="Коммуникации"')
  })

  it("UI-03c: якорь группы перечисляет её инструменты (data-tools = «riser duct»): виден на плане, где они есть", () => {
    // последний якорь перед кнопкой группы — якорь самой группы
    const before = toolbar.slice(0, at('id="tool-communications"'))
    const last = before.lastIndexOf('class="tool-anchor"')
    expect(last).toBeGreaterThanOrEqual(0)
    const tools = /data-tools="([^"]*)"/.exec(before.slice(last))?.[1] ?? ""
    expect(tools.split(/\s+/).sort()).toEqual(["duct", "riser"])
  })
})
