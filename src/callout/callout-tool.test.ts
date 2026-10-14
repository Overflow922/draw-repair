import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import type { GroupState, Tool } from "../doorway/openings-group"
import { PLANS, defaultToolOf, toolsOf } from "../plans"
import { afterPlace, escapeAction, selectionAllowed } from "../tool-mode"

// change add-callout: инструмент «Выноска» — наборы инструментов планов, кнопка, Esc, режим выделения
// (spec canvas-app «Кнопка «Выноска»», «Esc снимает активный инструмент», «Выделение и правка только без инструмента»;
// drawing-plans «Выноски — объекты плана»; design D4, D11; test-plan C-TOOL-*).
// Конфликт с одобренными тестами точных наборов инструментов (plan-tools.test.ts, mounting-plans.test.ts, communications/plans.test.ts,
// battery/battery-tool.test.ts B-TOOL-7, 7b, 7c) оформляется как test-change-request, а не правится здесь.

const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8")
const at = (needle: string): number => html.indexOf(needle)
const group: GroupState = { current: "doorway", active: "other", panelOpen: false }
const state = { gestureActive: false, dimensionDraft: false, hasSelection: false }

describe("наборы инструментов планов", () => {
  it("C-TOOL-1: обмерочный план — «Выноска» сразу после «Размера», перед «Линейкой»; остальной порядок прежний", () => {
    expect(toolsOf("measure")).toEqual(["wall", "doorway", "door", "window", "battery", "riser", "duct", "dimension", "callout", "ruler", "eraser"])
  })

  it("C-TOOL-2: «Монтаж» — «Выноска» сразу после «Размера»", () => {
    expect(toolsOf("mounting")).toEqual(["wall", "doorway", "door", "window", "battery", "dimension", "callout", "ruler", "eraser"])
  })

  it("C-TOOL-3: «Демонтаж» — «Демонтаж», «Выноска», «Линейка», «Ластик»", () => {
    expect(toolsOf("demolition")).toEqual(["demolition", "callout", "ruler", "eraser"])
  })

  it("C-TOOL-3b: «Выноска» есть у каждого плана каталога ровно один раз", () => {
    for (const plan of PLANS) expect(toolsOf(plan.id).filter((t) => t === "callout")).toHaveLength(1)
  })

  it("C-TOOL-7: инструмент по умолчанию у планов не меняется", () => {
    expect(defaultToolOf("measure")).toBe("wall")
    expect(defaultToolOf("mounting")).toBe("wall")
    expect(defaultToolOf("demolition")).toBe("demolition")
  })
})

describe("Esc и режим инструмента", () => {
  it("C-TOOL-4: при начатом размещении Esc отменяет черновик, не снимая инструмент", () => {
    expect(escapeAction({ ...state, tool: "callout", calloutDraft: true })).toBe("cancel-callout-draft")
  })

  it("C-TOOL-5: без черновика Esc снимает инструмент «Выноска»", () => {
    expect(escapeAction({ ...state, tool: "callout", calloutDraft: false })).toBe("deactivate-tool")
    expect(escapeAction({ ...state, tool: "callout" })).toBe("deactivate-tool")
  })

  it("C-TOOL-5b: приоритет действий — жест стены, затем черновик размера, затем черновик выноски", () => {
    expect(escapeAction({ ...state, tool: "callout", calloutDraft: true, gestureActive: true })).toBe("end-gesture")
    expect(escapeAction({ ...state, tool: "callout", calloutDraft: true, dimensionDraft: true })).toBe("cancel-dimension-draft")
  })

  it("C-TOOL-5c: прежние состояния Esc без поля черновика выноски работают как раньше", () => {
    expect(escapeAction({ ...state, tool: "dimension", dimensionDraft: true })).toBe("cancel-dimension-draft")
    expect(escapeAction({ ...state, tool: "wall" })).toBe("deactivate-tool")
    expect(escapeAction({ ...state, tool: "none", hasSelection: true })).toBe("clear-selection")
    expect(escapeAction({ ...state, tool: "none" })).toBe("none")
  })

  it("C-TOOL-6: при активной «Выноске» выделять и править существующие объекты нельзя; без инструмента можно", () => {
    expect(selectionAllowed("callout")).toBe(false)
    expect(selectionAllowed("none")).toBe(true)
    for (const tool of ["wall", "dimension", "ruler", "eraser"] as const satisfies readonly Tool[]) expect(selectionAllowed(tool)).toBe(false)
  })

  it("C-TOOL-8: после завершения ввода инструмент остаётся активным: afterPlace его не снимает, группа не меняется", () => {
    expect(afterPlace("callout", group)).toEqual({ tool: "callout", group })
  })
})

describe("кнопка в index.html", () => {
  it("C-TOOL-9: кнопка «Выноска» стоит после «Размера» и перед «Линейкой»", () => {
    const callout = at('id="tool-callout"')
    expect(callout).toBeGreaterThan(-1)
    expect(callout).toBeGreaterThan(at('id="tool-dimension"'))
    expect(callout).toBeLessThan(at('id="tool-ruler"'))
    expect(callout).toBeLessThan(at('id="tool-eraser"'))
  })

  it("C-TOOL-9a: у кнопки название «Выноска», она в блоке с data-tools=\"callout\"", () => {
    const i = at('id="tool-callout"')
    const tag = html.slice(html.lastIndexOf("<button", i), html.indexOf(">", i))
    expect(tag).toContain('title="Выноска"')
    const around = html.slice(Math.max(0, i - 200), i)
    expect(around).toContain('data-tools="callout"')
  })

  it("C-TOOL-9b: у «Выноски» нет вспомогательной панели", () => {
    expect(html).not.toMatch(/id="callout-panel"/)
    expect(html).not.toMatch(/data-panel="callout"/)
  })

  it("C-TOOL-9c: на кнопке есть значок и кнопка единственная", () => {
    const i = at('id="tool-callout"')
    const end = html.indexOf("</button>", i)
    const button = html.slice(i, end)
    expect(button).toContain("<svg")
    expect(button).toMatch(/<(path|line|rect|circle|polyline|polygon)\b/)
    expect(html.split('id="tool-callout"')).toHaveLength(2)
  })
})
