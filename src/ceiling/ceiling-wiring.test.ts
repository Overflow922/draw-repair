import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { openFurniture } from "../furniture/furniture-workspace"
import { drawing, rectWalls } from "../rough/rough.test-utils"
import { rulerReading } from "../ruler"
import { rulerObjectsOf } from "../ruler-objects"
import type { Drawing, FurnitureItem, Point } from "../types"
import { openCeiling } from "./ceiling-workspace"

// change add-ceiling-plan: подключение плана «Потолки и освещение» (spec ceiling-plan «Линейка до мебели»; drawing-plans
// «Правка подписи потолка при переключении», «Delete на «Потолках и освещении» не удаляет мебель»; design D4, D5)
//
//  вид сверху, схематично, не в масштабе. Комната [10,410]×[10,310], стол T 80 × 160 с центром (200, 160); курсор R — между
//  левой стеной и столом
//
//   ##########################
//   #       +----+           #
//   #  R    | T  |           #
//   #       +----+           #
//   ##########################

const table: FurnitureItem = { id: "t", kind: "table", x: 200, y: 160, widthCm: 80, lengthCm: 160, angleDeg: 0 }
const D = (): Drawing => ({ ...drawing({ walls: rectWalls("k", 0, 0, 420, 320) }), furniture: { items: [table], dimensions: [] } })

const reading = (walls: Parameters<typeof rulerReading>[1], items: readonly FurnitureItem[], p: Point) =>
  rulerReading(p, walls, rulerObjectsOf({ walls, batteries: [], communications: [], items }))

// исходник main.ts без комментариев: упоминание в комментарии не должно удовлетворять проверкам
const main = readFileSync(new URL("../main.ts", import.meta.url), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1")
const body = (start: string): string => {
  const i = main.indexOf(start)
  return i < 0 ? "" : main.slice(i, main.indexOf("\n}", i))
}

describe("«Линейка» до мебели", () => {
  it("CP-130: замер между стеной подложки и столом тот же, что на плане «Мебель»", () => {
    const d = D()
    const ceiling = openCeiling(d).scene
    const furniture = openFurniture(d).scene
    const p = { x: 80, y: 160 }
    const got = reading(ceiling.walls, ceiling.items, p)
    expect(got).toEqual(reading(furniture.walls, furniture.items, p))
    // замер доходит до стола, а не до противоположной стены
    expect(got).not.toEqual(reading(ceiling.walls, [], p))
  })
})

describe("связки в main.ts", () => {
  it("CP-131: при смене плана поле подписи потолка применяется до смены плана — шаг истории на «Потолках и освещении»", () => {
    const setPlan = body("function setPlan(")
    const commit = setPlan.indexOf("commitCeilingEditor()")
    expect(commit).toBeGreaterThan(0)
    expect(commit).toBeLessThan(setPlan.indexOf("activePlan = id"))
    // смена вкладки тоже применяет поле до переключения
    const activate = body("function activate(")
    expect(activate.indexOf("commitCeilingEditor()")).toBeGreaterThan(0)
    expect(activate.indexOf("commitCeilingEditor()")).toBeLessThan(activate.indexOf("store.activeId = id"))
  })

  it("CP-132: Delete на плане удаляет только выделенный потолок — без удаления выделения других объектов", () => {
    const keydown = main.slice(main.indexOf('if (e.key === "Delete")'))
    const branch = keydown.slice(keydown.indexOf("if (onCeiling())"), keydown.indexOf("if (onDemolition())"))
    expect(branch).toContain("ceilingTool.deleteSelected()")
    expect(branch).not.toContain("deleteSelection(")
    expect(branch).not.toContain("deleteFurnitureSelection(")
    expect(branch).toContain("return")
  })
})
