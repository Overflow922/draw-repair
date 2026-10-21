import { describe, expect, it } from "vitest"
import type { Drawing, RightAngleMark } from "../types"
import { createRightAngleTool } from "./right-angle-tool"
import type { RightAngleToolHost } from "./right-angle-tool"
import { roughScene } from "./rough-scene"
import { drawing, idGen, plaster, rectWalls, wall } from "./rough.test-utils"

// change plaster-right-angle: инструмент «Прямой угол» — подсветка, постановка, выделение, удаление, ластик
// (spec rough-works-plan «Инструмент «Прямой угол»», «Выделение и удаление прямого угла», «Ластик на плане «Черновые работы»»)

const NONE: RightAngleMark[] = []
const RADIUS_CM = 5
const ARM_CM = 10

function setup(initial: Drawing) {
  let d = initial
  const log = { records: 0, changes: 0 }
  const host: RightAngleToolHost = {
    scene: () => roughScene(d),
    marks: () => d.roughAngles ?? NONE,
    setMarks: (next) => {
      d = { ...d, roughAngles: next }
    },
    record: () => {
      log.records++
    },
    changed: () => {
      log.changes++
    },
    redraw: () => {},
    radiusCm: () => RADIUS_CM,
    armCm: () => ARM_CM,
    newId: idGen(),
  }
  return { tool: createRightAngleTool(host), log, marks: () => d.roughAngles ?? [], drawing: () => d }
}

// внутренний угол стен A и B: V = (488; 12), плечи знака влево и вниз
const A = wall("A", 0, 0, 500, 0)
const B = wall("B", 500, 0, 500, 400)
const pa = plaster("pa", "A", 1, "a", 0, 500)
const pb = plaster("pb", "B", 1, "a", 0, 400)
const L = (): Drawing => drawing({ walls: [A, B], roughPlaster: [pa, pb] })
const V = { x: 488, y: 12 }

describe("подсветка", () => {
  it("RA-30: курсор в радиусе от вершины — подсвечен этот угол", () => {
    const { tool } = setup(L())
    tool.hover({ x: V.x + 3, y: V.y + 2 })
    const ghost = tool.ghost()
    expect(ghost?.point.x).toBeCloseTo(V.x, 6)
    expect(ghost?.point.y).toBeCloseTo(V.y, 6)
    expect(ghost?.kind).toBe("inner")
  })

  it("RA-30: уход курсора и null снимают подсветку", () => {
    const { tool } = setup(L())
    tool.hover(V)
    tool.hover({ x: 300, y: 300 })
    expect(tool.ghost()).toBeNull()
    tool.hover(V)
    tool.hover(null)
    expect(tool.ghost()).toBeNull()
  })

  it("RA-31: ближайший угол вне радиуса не выбирается", () => {
    const { tool } = setup(L())
    tool.hover({ x: V.x - 30, y: V.y + 30 })
    expect(tool.ghost()).toBeNull()
  })

  it("RA-32: угол без штукатурки с двух сторон не подсвечивается", () => {
    const { tool } = setup(drawing({ walls: [A, B], roughPlaster: [pa] }))
    tool.hover({ x: 490, y: 10 })
    expect(tool.ghost()).toBeNull()
  })

  it("RA-33: Escape (cancel) снимает подсветку", () => {
    const { tool } = setup(L())
    tool.hover(V)
    tool.cancel()
    expect(tool.ghost()).toBeNull()
  })
})

describe("постановка", () => {
  it("RA-34: клик у вершины ставит пометку одним шагом истории; пометка не выделяется", () => {
    const { tool, log, marks } = setup(L())
    expect(tool.place({ x: V.x + 2, y: V.y + 2 })).toBe(true)
    expect(marks()).toEqual([{ id: "n1", corner: [{ markId: "pa", at: "to" }, { markId: "pb", at: "from" }] }])
    expect(log.records).toBe(1)
    expect(log.changes).toBe(1)
    expect(tool.selectedId()).toBeNull()
  })

  it("RA-35: клик вне радиуса, у угла без штукатурки и вне углов ничего не ставит", () => {
    const far = setup(L())
    expect(far.tool.place({ x: 300, y: 300 })).toBe(false)
    const bare = setup(drawing({ walls: [A, B], roughPlaster: [pa] }))
    expect(bare.tool.place({ x: 490, y: 10 })).toBe(false)
    const none = setup(drawing({ walls: [A, B] }))
    expect(none.tool.place({ x: 490, y: 10 })).toBe(false)
    for (const s of [far, bare, none]) {
      expect(s.marks()).toEqual([])
      expect(s.log.records).toBe(0)
    }
  })

  it("RA-36: повторный клик по помеченному углу ничего не меняет, шага истории нет", () => {
    const { tool, log, marks } = setup(L())
    tool.place(V)
    expect(tool.place(V)).toBe(false)
    expect(marks()).toHaveLength(1)
    expect(log.records).toBe(1)
  })

  it("RA-37: серия — два угла комнаты, два шага", () => {
    const room = drawing({
      walls: rectWalls("r", 0, 0, 400, 300),
      roughPlaster: [plaster("p1", "r1", 1, "a", 0, 400), plaster("p2", "r2", 1, "a", 0, 300), plaster("p3", "r3", 1, "a", 0, 400), plaster("p4", "r4", 1, "a", 0, 300)],
    })
    const { tool, log, marks } = setup(room)
    expect(tool.place({ x: 12, y: 12 })).toBe(true)
    expect(tool.place({ x: 388, y: 288 })).toBe(true)
    expect(marks()).toHaveLength(2)
    expect(log.records).toBe(2)
  })

  it("RA-38: в радиус попали два угла — берётся ближайший к курсору", () => {
    // узкая перегородка: два внутренних угла Т-примыкания на расстоянии 4 см друг от друга
    const tee = drawing({
      walls: [wall("A", 0, 0, 500, 0), wall("S", 250, 10, 250, 300, 4)],
      roughPlaster: [plaster("pa", "A", 1, "a", 0, 500), plaster("ps1", "S", 1, "a", 0, 290), plaster("ps2", "S", -1, "a", 0, 290)],
    })
    const { tool, marks } = setup(tee)
    // грани S: x = 248 и 252; полосы 2 см наружу; вершины (246; 12) и (254; 12); от клика 3,6 и 4,6 см — оба в радиусе 5 см
    expect(tool.place({ x: 249.5, y: 13 })).toBe(true)
    expect(marks()).toHaveLength(1)
    expect(marks()[0]?.corner.map((r) => r.markId).sort()).toEqual(["pa", "ps1"])
  })
})

describe("выделение и удаление", () => {
  it("RA-40: клик по знаку выделяет пометку, клик мимо снимает выделение", () => {
    const { tool } = setup(L())
    tool.place(V)
    expect(tool.select({ x: V.x - 6, y: V.y })).toBe(true) // на плече влево
    expect(tool.selectedId()).toBe("n1")
    expect(tool.select({ x: 300, y: 300 })).toBe(false)
    expect(tool.selectedId()).toBeNull()
  })

  it("RA-40: клик по плечу знака, а не только по вершине, выделяет пометку", () => {
    const { tool } = setup(L())
    tool.place(V)
    expect(tool.select({ x: V.x, y: V.y + 8 })).toBe(true) // на плече вниз
  })

  it("RA-41: Delete удаляет выделенную пометку одним шагом; отмена шага — снимок до операции", () => {
    const { tool, log, marks } = setup(L())
    tool.place(V)
    tool.select(V)
    expect(tool.deleteSelected()).toBe(true)
    expect(marks()).toEqual([])
    expect(log.records).toBe(2)
    expect(tool.selectedId()).toBeNull()
  })

  it("RA-41: без выделения Delete ничего не делает", () => {
    const { tool, log } = setup(L())
    tool.place(V)
    expect(tool.deleteSelected()).toBe(false)
    expect(log.records).toBe(1)
  })

  it("RA-42: Escape (clearSelection) снимает выделение, пометка остаётся", () => {
    const { tool, marks } = setup(L())
    tool.place(V)
    tool.select(V)
    tool.clearSelection()
    expect(tool.selectedId()).toBeNull()
    expect(marks()).toHaveLength(1)
  })

  it("RA-43: недействующую пометку не выделить и не удалить кликом", () => {
    const { tool } = setup(drawing({ walls: [A, B], roughPlaster: [pa], roughAngles: [{ id: "r", corner: [{ markId: "pa", at: "to" }, { markId: "pb", at: "from" }] }] }))
    expect(tool.select(V)).toBe(false)
    expect(tool.erase(V)).toBe(false)
  })
})

describe("ластик", () => {
  it("RA-50: клик по знаку удаляет пометку одним шагом; штукатурка остаётся", () => {
    const { tool, log, marks, drawing: d } = setup(L())
    tool.place(V)
    expect(tool.erase({ x: V.x - 4, y: V.y })).toBe(true)
    expect(marks()).toEqual([])
    expect(log.records).toBe(2)
    expect(d().roughPlaster).toEqual([pa, pb])
  })

  it("RA-50: клик мимо знака ничего не удаляет", () => {
    const { tool, log, marks } = setup(L())
    tool.place(V)
    expect(tool.erase({ x: 300, y: 300 })).toBe(false)
    expect(marks()).toHaveLength(1)
    expect(log.records).toBe(1)
  })

  it("RA-51: eraseTarget возвращает идентификатор пометки под курсором для подсветки", () => {
    const { tool } = setup(L())
    tool.place(V)
    expect(tool.eraseTarget(V)).toBe("n1")
    expect(tool.eraseTarget({ x: 300, y: 300 })).toBeNull()
  })

  it("RA-52: ластик сбрасывает выделение удалённой пометки", () => {
    const { tool } = setup(L())
    tool.place(V)
    tool.select(V)
    tool.erase(V)
    expect(tool.selectedId()).toBeNull()
  })
})
