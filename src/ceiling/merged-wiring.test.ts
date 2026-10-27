import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

// change merge-lighting-plans: подключение меток линий, выключателей и вытяжек к плану «Потолки и освещение» в main.ts
// (spec ceiling-plan «Выделение и приоритет объектов…», «Ластик на плане «Потолки и освещение»»; drawing-plans «Delete…», «Escape…»;
// design D3, D4)

const main = readFileSync(new URL("../main.ts", import.meta.url), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1")
const inOrder = (text: string, parts: readonly string[]): boolean => {
  let at = -1
  for (const p of parts) {
    const i = text.indexOf(p, at + 1)
    if (i <= at) return false
    at = i
  }
  return true
}
// ветка плана «Потолки и освещение» внутри обработчика: от onCeiling() до начала следующей ветки
const branch = (handler: string, from: string, to: string): string => {
  const h = main.slice(main.indexOf(handler))
  const start = h.indexOf(from)
  return h.slice(start, h.indexOf(to, start))
}

describe("связки единого плана в main.ts", () => {
  it("MW-1: плана «Группы включения» в main.ts больше нет", () => {
    expect(main).not.toContain("onSwitching")
    expect(main).not.toContain("switchingNow")
    expect(main).not.toContain("drawSwitchingPlan")
  })

  it("MW-2: без инструмента нажатие — выноска, метка, выключатель, вытяжка, светильник, потолок", () => {
    const down = branch('canvas.addEventListener("pointerdown"', "if (onCeiling())", "if (onDemolition())")
    expect(inOrder(down, ["calloutTool.press(p)", "lineTool.labelAt(p)", "pressSwitches(p, e)", "pressExhausts(p, e)", "lightTool.press(p)", "pressCeiling(p)"])).toBe(true)
  })

  it("MW-3: клик ставит объект по инструменту на плане", () => {
    const click = branch('canvas.addEventListener("click"', "if (onCeiling())", "if (onDemolition())")
    for (const place of ["ceilingTool.place(at)", "lightTool.place(at)", "lineTool.place(at)", "switchTool.place(at)", "exhaustTool.place(at)", "calloutTool.click(at)"]) expect(click).toContain(place)
  })

  it("MW-4: Delete — метка, выключатель, вытяжка, светильник, потолок; не во время перетаскивания", () => {
    const del = branch('if (e.key === "Delete")', "if (onCeiling())", "if (onDemolition())")
    expect(inOrder(del, ["lightTool.dragging()", "switchTool.dragging()", "exhaustTool.dragging()"])).toBe(true)
    expect(inOrder(del, ["lineTool.deleteSelected()", "switchTool.deleteSelected()", "exhaustTool.deleteSelected()", "lightTool.deleteSelected()", "ceilingTool.deleteSelected()"])).toBe(true)
  })

  it("MW-5: Escape снимает выделение всех объектов плана и прерывает перетаскивание светильника, выключателя, вытяжки", () => {
    const esc = branch('if (e.key === "Escape" && onCeiling())', 'if (e.key === "Escape" && onCeiling())', 'if (e.key === "Escape" && onDemolition())')
    for (const part of ["lightTool.dragging()", "switchTool.dragging()", "exhaustTool.dragging()", "lineTool.selectedId()", "switchTool.selectedId()", "exhaustTool.selectedId()", "resetLines()", "resetSwitches()", "resetExhausts()"]) {
      expect(esc).toContain(part)
    }
  })

  it("MW-6: перетаскивание и отпускание — светильник, выключатель, вытяжка", () => {
    const move = branch('canvas.addEventListener("pointermove"', "lightTool.dragging()", "if (onDemolition())")
    expect(inOrder(move, ["lightTool.dragTo(", "switchTool.dragTo(", "exhaustTool.dragTo("])).toBe(true)
    const up = branch('canvas.addEventListener("pointerup"', "if (onCeiling() && e.button === 0)", "return\n  }")
    for (const end of ["lightTool.endDrag()", "releaseSwitch()", "exhaustTool.endDrag()"]) expect(up).toContain(end)
  })
})
