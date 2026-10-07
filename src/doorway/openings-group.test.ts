import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { groupButtonActive, groupButtonClick, groupPick, groupSelect } from "./openings-group"
import type { GroupState } from "./openings-group"

// change add-door: группа «Проёмы» — переходы состояния кнопки группы и её панели
// (spec canvas-app «Группа «Проёмы»», «Группы инструментов»; doorway «Инструмент «Проём»», «Выделение проёма»;
// door «Инструмент «Дверь»», «Панель выделенной двери»; window «Инструмент «Окно»»; design D6).

const initial: GroupState = { current: "doorway", active: "other", panelOpen: false }

describe("кнопка группы", () => {
  it("GR-01: клик при другом инструменте активирует текущий инструмент группы и открывает панель", () => {
    expect(groupButtonClick(initial)).toEqual({ current: "doorway", active: "doorway", panelOpen: true })
    expect(groupButtonClick({ ...initial, panelOpen: true })).toEqual({ current: "doorway", active: "doorway", panelOpen: true })
  })

  it("GR-02: повторные клики при активном инструменте группы переключают панель, инструмент не меняется", () => {
    let s = groupButtonClick({ current: "door", active: "other", panelOpen: false })
    expect(s).toEqual({ current: "door", active: "door", panelOpen: true })
    s = groupButtonClick(s)
    expect(s).toEqual({ current: "door", active: "door", panelOpen: false })
    s = groupButtonClick(s)
    expect(s).toEqual({ current: "door", active: "door", panelOpen: true })
  })

  it("GR-02b: активен другой инструмент группы, чем текущий — клик активирует текущий и открывает панель", () => {
    expect(groupButtonClick({ current: "door", active: "doorway", panelOpen: false })).toEqual({ current: "door", active: "door", panelOpen: true })
  })
})

describe("кнопки инструментов в панели", () => {
  it("GR-03: выбор «Дверь» делает её текущей и активной, панель открыта", () => {
    const open = groupButtonClick(initial)
    expect(groupPick(open, "door")).toEqual({ current: "door", active: "door", panelOpen: true })
    expect(groupPick({ ...initial, panelOpen: false }, "door")).toEqual({ current: "door", active: "door", panelOpen: true })
    expect(groupPick({ current: "door", active: "door", panelOpen: true }, "doorway")).toEqual({ current: "doorway", active: "doorway", panelOpen: true })
  })

  it("GR-04: кнопка группы помнит последний выбранный инструмент", () => {
    let s = groupPick(groupButtonClick(initial), "door")
    // выбран инструмент «Стена»: активен инструмент вне группы
    s = { ...s, active: "other" }
    s = groupButtonClick(s)
    expect(s.active).toBe("door")
    expect(s.panelOpen).toBe(true)
  })
})

describe("выделение элемента", () => {
  it("GR-05: выделение двери делает «Дверь» текущей и открывает панель, активный инструмент не меняется", () => {
    expect(groupSelect(initial, "door")).toEqual({ current: "door", active: "other", panelOpen: true })
    expect(groupSelect({ current: "doorway", active: "doorway", panelOpen: false }, "door")).toEqual({
      current: "door",
      active: "doorway",
      panelOpen: true,
    })
  })

  it("GR-06: выделение проёма при текущей «Дверь» возвращает «Проём»", () => {
    expect(groupSelect({ current: "door", active: "other", panelOpen: false }, "doorway")).toEqual({
      current: "doorway",
      active: "other",
      panelOpen: true,
    })
  })
})

describe("состояние кнопки группы", () => {
  it("GR-07: кнопка группы активна при любом инструменте группы", () => {
    expect(groupButtonActive({ current: "doorway", active: "doorway", panelOpen: false })).toBe(true)
    expect(groupButtonActive({ current: "doorway", active: "door", panelOpen: false })).toBe(true)
    expect(groupButtonActive({ current: "door", active: "other", panelOpen: true })).toBe(false)
  })

  it("GR-08: переходы не мутируют входное состояние", () => {
    const s: GroupState = { current: "doorway", active: "other", panelOpen: false }
    const copy = { ...s }
    groupButtonClick(s)
    groupPick(s, "door")
    groupSelect(s, "door")
    groupButtonActive(s)
    expect(s).toEqual(copy)
  })
})

describe("разметка панели инструментов", () => {
  const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8")
  const start = html.indexOf('id="toolbar"')
  const end = html.indexOf("</aside>", start)
  const toolbar = html.slice(start, end)
  const at = (needle: string): number => toolbar.indexOf(needle)

  it("GR-09: порядок «Стена», «Проёмы», «Окно», разделитель, «Размер», «Линейка», разделитель, «Ластик»", () => {
    expect(start).toBeGreaterThanOrEqual(0)
    const marks = ['id="tool-wall"', 'id="tool-openings"', 'id="tool-window"', 'id="tool-dimension"', 'id="tool-ruler"', 'id="tool-eraser"']
    const pos = marks.map(at)
    for (const p of pos) expect(p).toBeGreaterThanOrEqual(0)
    expect([...pos].sort((p, q) => p - q)).toEqual(pos)
    const seps = [...toolbar.matchAll(/class="tool-separator"/g)].map((m) => m.index ?? -1)
    expect(seps).toHaveLength(2)
    expect(seps[0]).toBeGreaterThan(pos[2])
    expect(seps[0]).toBeLessThan(pos[3])
    expect(seps[1]).toBeGreaterThan(pos[4])
    expect(seps[1]).toBeLessThan(pos[5])
  })

  it("GR-09b: у кнопки группы своя иконка — SVG, отличная от иконок «Проём» и «Дверь»", () => {
    const svgAfter = (id: string): string => {
      const i = at(`id="${id}"`)
      const s = toolbar.indexOf("<svg", i)
      return toolbar.slice(s, toolbar.indexOf("</svg>", s))
    }
    const group = svgAfter("tool-openings")
    expect(group.length).toBeGreaterThan(0)
    expect(group).not.toEqual(svgAfter("tool-doorway"))
    expect(group).not.toEqual(svgAfter("tool-door"))
    expect(svgAfter("tool-door")).not.toEqual(svgAfter("tool-doorway"))
  })

  it("GR-10: кнопки «Проём» и «Дверь» — в панели группы в этом порядке, а не на панели инструментов", () => {
    const panel = at('id="openings-panel"')
    const doorway = at('id="tool-doorway"')
    const door = at('id="tool-door"')
    expect(panel).toBeGreaterThan(at('id="tool-openings"'))
    expect(doorway).toBeGreaterThan(panel)
    expect(door).toBeGreaterThan(doorway)
    // обе — до кнопки «Окно», то есть внутри якоря группы
    expect(door).toBeLessThan(at('id="tool-window"'))
    // кнопка поворота двери — в панели группы
    const rotate = at('id="door-rotate"')
    expect(rotate).toBeGreaterThan(panel)
    expect(rotate).toBeLessThan(at('id="tool-window"'))
  })
})
