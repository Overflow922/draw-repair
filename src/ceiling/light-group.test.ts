import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { PLANS, defaultToolOf, toolsOf } from "../plans"
import { LIGHT_GROUP_DEFAULT, groupButtonClick, groupPick } from "./light-group"
import type { LightGroupState } from "./light-group"

// change add-ceiling-lighting: группа «Освещение» — каталог инструментов плана, переходы кнопки группы и разметка панели
// (spec canvas-app «Панель группы «Освещение»», «Группы инструментов»; drawing-plans «Инструменты плана»)

const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8")
const toolbarStart = html.indexOf('id="toolbar"')
const toolbar = html.slice(toolbarStart, html.indexOf("</aside>", toolbarStart))
const anchorOf = (tools: string): string => {
  const start = toolbar.indexOf(`data-tools="${tools}"`)
  if (start < 0) return ""
  const next = toolbar.indexOf('class="tool-anchor"', start)
  return toolbar.slice(start, next < 0 ? toolbar.length : next)
}

const initial: LightGroupState = { current: LIGHT_GROUP_DEFAULT, active: "other", panelOpen: false }

describe("инструменты плана", () => {
  it("CL-G1: «Освещение» — сразу после «Натяжной потолок»; по умолчанию по-прежнему «Натяжной потолок»", () => {
    expect(toolsOf("ceiling")).toEqual(["stretchCeiling", "light", "lightLine", "lightSwitch", "exhaust", "callout", "ruler", "notes", "eraser"]) // TCR (change merge-lighting-plans)
    expect(defaultToolOf("ceiling")).toBe("stretchCeiling")
  })

  it("CL-G2: группы нет на других планах", () => {
    for (const p of PLANS) if (p.id !== "ceiling") expect(toolsOf(p.id)).not.toContain("light")
  })
})

describe("кнопка группы «Освещение»", () => {
  it("CL-G3: по умолчанию — «Точечный встроенный светильник»; клик по кнопке группы активирует его и открывает панель", () => {
    expect(LIGHT_GROUP_DEFAULT).toBe("spot")
    expect(groupButtonClick(initial)).toEqual({ current: "spot", active: "spot", panelOpen: true })
  })

  it("CL-G4: выбор люстры в панели — активна люстра, панель открыта", () => {
    expect(groupPick(groupButtonClick(initial), "chandelier")).toEqual({ current: "chandelier", active: "chandelier", panelOpen: true })
  })

  it("CL-G5: кнопка группы помнит последний вид", () => {
    const picked = groupPick(groupButtonClick(initial), "sconce")
    const away: LightGroupState = { ...picked, active: "other", panelOpen: false }
    expect(groupButtonClick(away)).toEqual({ current: "sconce", active: "sconce", panelOpen: true })
  })

  it("CL-G7: повторный клик по кнопке активной группы закрывает панель, инструмент остаётся", () => {
    expect(groupButtonClick(groupButtonClick(initial))).toEqual({ current: "spot", active: "spot", panelOpen: false })
  })
})

describe("разметка группы «Освещение»", () => {
  const anchor = anchorOf("light")

  it("CL-G10: якорь группы — после якоря «Натяжной потолок», кнопка «Освещение» и панель справа", () => {
    expect(anchor).toContain('id="tool-light"')
    expect(anchor).toContain('title="Освещение"')
    expect(toolbar.indexOf('data-tools="stretchCeiling"')).toBeLessThan(toolbar.indexOf('data-tools="light"'))
    expect(anchor.indexOf('id="tool-light"')).toBeLessThan(anchor.indexOf('id="light-panel"'))
  })

  it("CL-G11: значок группы — окружность с крестом", () => {
    const button = anchor.slice(0, anchor.indexOf('id="light-panel"'))
    expect(button).toMatch(/<circle/)
    expect(button).toMatch(/<path[^>]*d="[^"]*M[^"]*h[^"]*"/)
  })

  it("CL-G12: в панели только пять кнопок видов в порядке каталога, без полей", () => {
    const panel = anchor.slice(anchor.indexOf('id="light-panel"'))
    const titles = [...panel.matchAll(/<button[^>]*data-light="([^"]+)"[^>]*title="([^"]+)"/g)].map((m) => [m[1], m[2]])
    expect(titles).toEqual([
      ["spot", "Точечный встроенный светильник"],
      ["smoke-detector", "Датчик пожарной сигнализации потолочный"],
      ["chandelier", "Люстра"],
      ["sconce", "Бра"],
      ["lighting-outlet", "Электровывод для освещения"],
    ])
    for (const tag of ["<input", "<select", "<textarea"]) expect(panel.includes(tag), tag).toBe(false)
  })
})
