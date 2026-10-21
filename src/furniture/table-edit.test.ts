import { describe, expect, it } from "vitest"
import type { Table } from "../types"
import { nudgeTables, removeTables, replaceTable, shiftTables, tableAt, tablesInRect } from "./table-edit"

// change furniture-plan-table: правка столов (spec furniture-plan «Выделение, перемещение и правка столов»)

const table = (id: string, x: number, y: number, angleDeg = 0, widthCm = 80, lengthCm = 160): Table => ({ id, x, y, widthCm, lengthCm, angleDeg })
const ids = (...v: string[]): ReadonlySet<string> => new Set(v)

describe("перемещение", () => {
  it("FP-130: выделенные столы смещаются на вектор свободно, остальные и размеры не меняются", () => {
    const next = shiftTables([table("a", 0, 0), table("b", 500, 0)], ids("a"), 150, -20)
    expect(next).toEqual([table("a", 150, -20), table("b", 500, 0)])
  })

  it("FP-130: вход не мутируется", () => {
    const a = table("a", 0, 0)
    shiftTables([a], ids("a"), 10, 10)
    expect(a).toEqual(table("a", 0, 0))
  })

  it("FP-131: нулевое смещение и пустое выделение изменений не дают (шага истории нет)", () => {
    expect(shiftTables([table("a", 0, 0)], ids("a"), 0, 0)).toBeNull()
    expect(shiftTables([table("a", 0, 0)], ids("zz"), 10, 0)).toBeNull()
  })

  it("FP-132: стрелка сдвигает на 10 см, с Shift — на 1 см; направления вправо/влево/вниз/вверх", () => {
    const t = [table("a", 200, 100)]
    expect(nudgeTables(t, ids("a"), "right", false)?.[0]).toMatchObject({ x: 210, y: 100 })
    expect(nudgeTables(t, ids("a"), "left", false)?.[0]).toMatchObject({ x: 190, y: 100 })
    expect(nudgeTables(t, ids("a"), "down", true)?.[0]).toMatchObject({ x: 200, y: 101 })
    expect(nudgeTables(t, ids("a"), "up", true)?.[0]).toMatchObject({ x: 200, y: 99 })
  })

  it("FP-132: стрелка без выделенных столов ничего не меняет", () => {
    expect(nudgeTables([table("a", 0, 0)], ids(), "right", false)).toBeNull()
  })
})

describe("удаление и замена", () => {
  it("FP-133: удаление убирает только выделенные", () => {
    expect(removeTables([table("a", 0, 0), table("b", 1, 1)], ids("a"))).toEqual([table("b", 1, 1)])
  })

  it("FP-133: замена правит стол с тем же идентификатором, порядок сохраняется", () => {
    const next = replaceTable([table("a", 0, 0), table("b", 1, 1)], table("a", 5, 5))
    expect(next).toEqual([table("a", 5, 5), table("b", 1, 1)])
  })
})

describe("стол под точкой", () => {
  it("FP-134: попадание по телу стола; мимо — null", () => {
    expect(tableAt([table("a", 200, 100)], { x: 200, y: 100 }, 0)?.id).toBe("a")
    expect(tableAt([table("a", 200, 100)], { x: 500, y: 500 }, 0)).toBeNull()
  })

  it("FP-134: при наложении столов выбирается поставленный позже", () => {
    expect(tableAt([table("a", 200, 100), table("b", 200, 100)], { x: 200, y: 100 }, 0)?.id).toBe("b")
  })
})

describe("рамка", () => {
  it("FP-135: рамка захватывает столы, чьё тело её пересекает, и пропускает остальные", () => {
    const tables = [table("in", 100, 100), table("out", 1000, 1000)]
    expect(tablesInRect(tables, { x: 0, y: 0 }, { x: 300, y: 300 }).map((t) => t.id)).toEqual(["in"])
  })

  it("FP-135: рамка, задевающая край стола, его захватывает; рамка рядом — нет", () => {
    const t = [table("a", 200, 100)] // x 160–240, y 20–180
    expect(tablesInRect(t, { x: 230, y: 0 }, { x: 400, y: 10 })).toHaveLength(0)
    expect(tablesInRect(t, { x: 230, y: 170 }, { x: 400, y: 400 })).toHaveLength(1)
  })

  it("FP-135: повёрнутый стол не захватывается рамкой в пустом углу описанного прямоугольника", () => {
    // квадрат 100×100 под 45° с центром (0, 0): ромб |x|+|y| ≤ 70.7; рамка (50, 50)–(80, 80) лежит за его гранью
    const diamond = [table("d", 0, 0, 45, 100, 100)]
    expect(tablesInRect(diamond, { x: 50, y: 50 }, { x: 80, y: 80 })).toHaveLength(0)
    expect(tablesInRect(diamond, { x: 30, y: 30 }, { x: 80, y: 80 })).toHaveLength(1)
  })
})
