import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

// change add-ceiling-lighting: подключение инструмента «Освещение» в main.ts (spec ceiling-lighting «Выделение, перемещение и
// удаление объектов освещения»; ceiling-plan «Ластик на плане «Потолки и освещение»»; drawing-plans «Инструмент освещения
// сбрасывается при смене плана», «Delete на «Потолках и освещении» удаляет светильник»; canvas-app «Панель группы «Освещение»»)

// исходник main.ts без комментариев: упоминание в комментарии не должно удовлетворять проверкам
const main = readFileSync(new URL("../main.ts", import.meta.url), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1")
const body = (start: string): string => {
  const i = main.indexOf(start)
  return i < 0 ? "" : main.slice(i, main.indexOf("\n}", i))
}
// порядок фрагментов в тексте: каждый найден и стоит после предыдущего
const inOrder = (text: string, parts: readonly string[]): boolean => {
  let at = -1
  for (const p of parts) {
    const i = text.indexOf(p, at + 1)
    if (i <= at) return false
    at = i
  }
  return true
}

describe("связки освещения в main.ts", () => {
  it("CL-W1: смена плана и вкладки закрывает панель группы «Освещение» и снимает выделение объекта освещения", () => {
    const activate = body("function activate(")
    expect(activate).toContain("closeLightPanel()")
    expect(activate).toContain("resetCeiling()")
    expect(body("const resetCeiling")).toContain("lightTool.clearSelection()")
    expect(body("function setTool(")).toContain("closeLightPanel()")
  })

  it("CL-W2: Delete на плане удаляет выделенный объект освещения, иначе потолок; не во время перетаскивания", () => {
    const keydown = main.slice(main.indexOf('if (e.key === "Delete")'))
    const branch = keydown.slice(keydown.indexOf("if (onCeiling())"), keydown.indexOf("if (onDemolition())"))
    expect(inOrder(branch, ["lightTool.dragging()", "lightTool.deleteSelected()", "ceilingTool.deleteSelected()"])).toBe(true)
    expect(branch).not.toContain("deleteSelection(")
  })

  it("CL-W3: ластик — выноска, затем объект освещения; по числу объекта освещения потолок не стирается", () => {
    const click = main.slice(main.indexOf('canvas.addEventListener("click"'))
    const ceiling = click.slice(click.indexOf("if (onCeiling())"), click.indexOf("if (onDemolition())"))
    expect(inOrder(ceiling, ["calloutTool.eraseAt(at)", "lightTool.erase(at)", "lightTool.numberAt(at)", "ceilingTool.erase(at)"])).toBe(true)
    expect(ceiling).toContain('tool === "light") lightTool.place(at)')
    // подсветка ластика — с тем же порядком
    const draw = body("function drawCeilingPlan(")
    expect(inOrder(draw, ["calloutTool.pick(cursor)", "lightTool.eraseTarget(cursor)", "lightTool.numberAt(cursor)", "ceilingTool.eraseTarget(cursor)"])).toBe(true)
  })

  it("CL-W4: без инструмента нажатие — выноска, затем число или знак объекта освещения, затем подпись потолка", () => {
    const down = main.slice(main.indexOf('canvas.addEventListener("pointerdown"'))
    const ceiling = down.slice(down.indexOf("if (onCeiling())"), down.indexOf("if (onDemolition())"))
    expect(inOrder(ceiling, ["selectionAllowed(tool)", "calloutTool.press(p)", "lightTool.press(p)", "pressCeiling(p)"])).toBe(true)
    // выделение объекта освещения не открывает панель потолка
    expect(ceiling).toContain("ceilingPanelOpen = false")
  })
})
