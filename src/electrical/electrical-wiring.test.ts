import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { drawing, rectWalls } from "../rough/rough.test-utils"
import { rulerReading } from "../ruler"
import { rulerObjectsOf } from "../ruler-objects"
import type { Drawing, FurnitureItem, LightSwitch, Point } from "../types"
import { electricalScene } from "./electrical-scene"

// change add-electrical-plan: подключение плана «Электрооборудование»
// (spec electrical-plan «Состав плана «Электрооборудование»» — подложка не правится; «Инструменты плана «Электрооборудование»»;
// design D2, D3)
//
//  вид сверху, схематично, не в масштабе. Комната [0,420]×[0,320], стол T 80 × 160 с центром (200, 160); курсор R — между
//  левой стеной и столом; S — выключатель на стене
//
//   ##########S###############
//   #       +----+           #
//   #  R    | T  |           #
//   #       +----+           #
//   ##########################

const table: FurnitureItem = { id: "t", kind: "table", x: 200, y: 160, widthCm: 80, lengthCm: 160, angleDeg: 0 }
const sw: LightSwitch = { id: "s", at: { x: 100, y: -10 }, angle: -90, keys: [{ lines: ["L1"] }] }
const D = (): Drawing => ({ ...drawing({ walls: rectWalls("k", 0, 0, 420, 320) }), furniture: { items: [table], dimensions: [] }, switching: { switches: [sw] } })

// исходник main.ts без комментариев: упоминание в комментарии не должно удовлетворять проверкам
const main = readFileSync(new URL("../main.ts", import.meta.url), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1")

// блоки `if (onElectrical()) { … }`: от условия до закрывающей скобки на том же отступе
const branches = (): string[] => {
  const text = main.replace(/\r\n/g, "\n")
  const out: string[] = []
  for (let i = text.indexOf("if (onElectrical()) {"); i >= 0; i = text.indexOf("if (onElectrical()) {", i + 1)) {
    const lineStart = text.lastIndexOf("\n", i) + 1
    const indent = text.slice(lineStart, i)
    const close = text.indexOf(`\n${indent}}`, i)
    out.push(text.slice(i, close < 0 ? i + 600 : close + 2 + indent.length))
  }
  return out
}

const FORBIDDEN = ["pressSwitches", "switchTool", "itemTool", "deleteSelection(", "deleteFurnitureSelection(", "pressRough", "selectWall", "lineTool", "lightTool", "exhaustTool", "ceilingTool"]

describe("«Линейка» до мебели", () => {
  it("EW-01: замер между стеной подложки и столом доходит до стола, а не до противоположной стены", () => {
    const s = electricalScene(D())
    const walls = [...s.base.underlay, ...s.base.own]
    const at = (items: readonly FurnitureItem[], p: Point) => rulerReading(p, walls, rulerObjectsOf({ walls, batteries: [], communications: [], items }))
    const p = { x: 80, y: 160 }
    expect(at(s.items, p)).not.toEqual(at([], p))
  })
})

describe("связки в main.ts", () => {
  it("EW-02: блоки плана есть для движения указателя, нажатия и клика", () => {
    expect(branches()).toHaveLength(3)
  })

  it("EW-03: ветки плана не трогают выключатели, мебель, потолки и освещение: подложка не выделяется и не удаляется", () => {
    for (const branch of branches()) for (const word of FORBIDDEN) expect(branch, word).not.toContain(word)
  })

  it("EW-04: открытие плана не создаёт рабочего набора: подложка вся только для чтения", () => {
    const open = main.slice(main.indexOf('activePlanOf(d) === "electrical"'))
    const block = open.slice(0, open.indexOf("return"))
    expect(block).toContain("workspace = null")
    expect(block).toContain("dimensions = []")
  })

  it("EW-05: Delete на плане ничего не удаляет, кроме выделенной выноски (она удаляется выше, на любом плане)", () => {
    const keydown = main.slice(main.indexOf('if (e.key === "Delete")'))
    const branch = keydown.slice(keydown.indexOf("if (onElectrical())"), keydown.indexOf("if (onElectrical())") + 40)
    expect(branch).toContain("return")
  })

  it("EW-06: «Ластик» на плане стирает только выноску, «Выноска» ставится кликом", () => {
    const click = branches().find((b) => b.includes('tool === "eraser"') && b.includes("calloutTool.click"))
    expect(click).toBeDefined()
    expect(click).toContain('else if (tool === "eraser") calloutTool.eraseAt(at)')
  })
})
