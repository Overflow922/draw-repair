import { describe, expect, it } from "vitest"
import { markDimensions } from "../demolition/mark-dimensions"
import { isPlasterMark } from "../storage"
import type { Drawing, PlasterMark, Point } from "../types"
import { plasterPieces, plasterStrip } from "./plaster"
import { plasterDimensions } from "./plaster-dimensions"
import { endDimension, openEndRuns } from "./plaster-end"
import { addPlasterEnd } from "./plaster-marks"
import { createPlasterTool } from "./plaster-tool"
import type { PlasterToolHost } from "./plaster-tool"
import { roughScene } from "./rough-scene"
import { boxOf, demolitionMark, drawing, idGen, plaster, wall } from "./rough.test-utils"
import { mergeAllPlaster } from "./plaster-marks"

// change plaster-wall-end-face: торец стены как грань штукатурки — полоса, открытость, срез сноса, слияние, постановка,
// следование за концом (spec rough-works-plan «Пометка штукатурки», «Участки штукатурки одной грани не пересекаются»,
// «Участок штукатурки следует за стеной», «Выделение штукатурки и правка на месте»)

const endMark = (id: string, wallId: string, anchor: "a" | "b", thicknessMm = 20): PlasterMark => ({ id, wallId, face: "end", anchor, thicknessMm })
const W = () => wall("W", 0, 0, 500, 0)

describe("полоса торца", () => {
  it("PE-1: торец b — прямоугольник x 500…502, y −10…10; боковые полосы не меняются", () => {
    const d = drawing({ roughPlaster: [endMark("e", "W", "b")] })
    const [piece] = plasterPieces(d)
    const box = piece && boxOf([plasterStrip(piece)])
    expect(box && [box.minX, box.maxX, box.minY, box.maxY]).toEqual([500, 502, -12, 12])
  })

  it("PE-1a: внешний угол выступа — полоса торца перекрывает угловые квадраты у обеих боковых полос", () => {
    const S = wall("S", 0, -10, 0, -30)
    const d = drawing({
      walls: [wall("W", -100, 0, 100, 0), S],
      roughPlaster: [endMark("e", "S", "b"), plaster("l", "S", 1, "a", 0, 20), plaster("r", "S", -1, "a", 0, 20)],
    })
    const end = plasterPieces(d).find((p) => p.mark.id === "e")
    const box = end && boxOf([plasterStrip(end)])
    // ось S идёт вверх (−y): поперёк x, торец на y = −30…−32; ширина 20 + 2·2 см
    expect(box && [box.minX, box.maxX, box.minY, box.maxY]).toEqual([-12, 12, -32, -30])
  })

  it("PE-1b: у закрытого края торца расширения нет, у открытого — есть", () => {
    const abut = wall("V", 500, 4, 600, 4) // тело y −6…14 закрывает торец b стены W, открыто только −10…−6
    const d = drawing({ walls: [W(), abut], roughPlaster: [endMark("e", "W", "b")] })
    const [piece] = plasterPieces(d)
    const box = piece && boxOf([plasterStrip(piece)])
    expect(box && [box.minY, box.maxY]).toEqual([-12, -6])
  })

  it("PE-2: торец a — вне тела с другой стороны, x −2…0", () => {
    const d = drawing({ roughPlaster: [endMark("e", "W", "a")] })
    const [piece] = plasterPieces(d)
    const box = piece && boxOf([plasterStrip(piece)])
    expect(box && [box.minX, box.maxX, box.minY, box.maxY]).toEqual([-2, 0, -12, 12])
  })

  it("PE-3: торец, закрытый примыканием, не действует; когда стена исчезает — снова действует", () => {
    const abut = wall("V", 500, -50, 500, 50)
    const closed = drawing({ walls: [W(), abut], roughPlaster: [endMark("e", "W", "b")] })
    expect(plasterPieces(closed)).toEqual([])
    expect(plasterPieces({ ...closed, walls: [W()] })).toHaveLength(1)
  })

  it("PE-4: срез сноса торцом не является: у остатков торцы только у концов исходной стены", () => {
    const d = drawing({
      demolition: [demolitionMark("m", "W", "a", 200, 300)],
      roughPlaster: [endMark("ea", "W", "a"), endMark("eb", "W", "b")],
    })
    // остатки W~0 (0–200 см) и W~3000 (300–500 см): торец a — у W~0, торец b — у второго; срез 200/300 торцов не получает
    const pieces = plasterPieces(d)
    expect(pieces.map((p) => [p.mark.id, p.wall.id])).toEqual([
      ["ea", "W~0"],
      ["eb", "W~3000"],
    ])
    expect(pieces.map((p) => [p.wall.a.x, p.wall.b.x])).toEqual([
      [0, 200],
      [300, 500],
    ])
  })

  it("PE-5: торец едет со своим концом: конец b перетащен в (700, 0) — полоса у x = 700", () => {
    const d = drawing({ walls: [wall("W", 0, 0, 700, 0)], roughPlaster: [endMark("e", "W", "b")] })
    const [piece] = plasterPieces(d)
    const box = piece && boxOf([plasterStrip(piece)])
    expect(box && [box.minX, box.maxX]).toEqual([700, 702])
  })

  it("PE-6: открытые части торца — вся толщина стены у свободного конца, пусто у закрытого", () => {
    const S = wall("S", 0, -10, 0, -30)
    expect(openEndRuns(S, [wall("W", -100, 0, 100, 0), S], "b")).toEqual([[-10, 10]])
    expect(openEndRuns(S, [wall("W", -100, 0, 100, 0), S], "a")).toEqual([])
  })

  it("PE-7: размер торца — от внешнего края полосы до внешнего, линия размера за полосой", () => {
    const dim = endDimension(W(), "b", -10, 10, 20, "cm", 2, 14)
    expect(dim?.text).toBe("24")
    expect(dim && Math.min(dim.geom.p1.x, dim.geom.p2.x)).toBeGreaterThan(502)
  })
})

describe("размер боковой полосы", () => {
  it("PE-15: размер отсчитывается от внешней стороны полосы и лежит дальше неё", () => {
    const piece = plasterPieces(drawing({ roughPlaster: [plaster("p", "W", 1, "a", 100, 300)] }))[0]
    const dims = piece ? markDimensions(piece, [W()], "chain", "cm", 2, 14, 2) : []
    const width = dims.find((d) => d.target === "width")
    expect(width && [width.geom.a.y, width.geom.p1.y > 12]).toEqual([12, true])
  })
})

describe("размер у внутреннего угла", () => {
  const corner = (marks: PlasterMark[]) =>
    drawing({ walls: [wall("A", 0, 0, 500, 0), wall("B", 500, 0, 500, 400)], roughPlaster: marks })
  const widthOf = (marks: PlasterMark[], id: string): number | undefined => {
    const d = corner(marks)
    const pieces = plasterPieces(d)
    const piece = pieces.find((p) => p.mark.id === id)
    return piece && plasterDimensions(piece, pieces, d.walls, "cm", 2, 14).find((x) => x.target === "width")?.valueCm
  }

  it("PE-16: соседняя штукатурка в углу укорачивает размер на её толщину; без неё размер идёт до угла стены", () => {
    const alone = widthOf([plaster("p", "A", 1, "a", 0, 500)], "p")
    const both = widthOf([plaster("p", "A", 1, "a", 0, 500), plaster("q", "B", 1, "a", 0, 400)], "p")
    expect(alone && both && alone - both).toBeCloseTo(2)
  })

  it("PE-17: правка числа укороченного размера прибавляет укорочение", () => {
    const marks = [plaster("p", "A", 1, "a", 0, 500), plaster("q", "B", 1, "a", 0, 400)]
    const d = corner(marks)
    const piece = plasterPieces(d).find((p) => p.mark.id === "p")
    const dim = piece && plasterDimensions(piece, plasterPieces(d), d.walls, "cm", 2, 14).find((x) => x.target === "width")
    expect(dim?.spot.trimCm).toBeCloseTo(2)
  })
})

describe("пометка торца", () => {
  it("PE-8: торец не сливается с продольной гранью", () => {
    const marks = mergeAllPlaster([plaster("p", "W", 1, "a", 0, 500), endMark("e", "W", "b")], [W()])
    expect(marks.map((m) => m.id)).toEqual(["p", "e"])
  })

  it("PE-9: один торец — одна пометка (повтор, в том числе другой толщины, ничего не меняет)", () => {
    const first = addPlasterEnd([], [W()], "W", "b", 20, idGen())
    expect(first).toHaveLength(1)
    expect(addPlasterEnd(first, [W()], "W", "b", 30, idGen())).toBe(first)
    expect(addPlasterEnd(first, [W()], "W", "a", 20, idGen())).toHaveLength(2)
  })
})

describe("хранилище: торец", () => {
  it("PE-14: пометка торца допустима без участка; старые пометки и недопустимые виды читаются как раньше", () => {
    expect(isPlasterMark(endMark("e", "W", "b"))).toBe(true)
    expect(isPlasterMark(plaster("p", "W", 1, "a", 0, 100))).toBe(true)
    expect(isPlasterMark({ id: "e", wallId: "W", face: "end", anchor: "c", thicknessMm: 20 })).toBe(false)
    expect(isPlasterMark({ id: "e", wallId: "W", face: "end", anchor: "a", thicknessMm: 0 })).toBe(false)
    expect(isPlasterMark({ id: "e", wallId: "W", face: "side", anchor: "a", fromCm: 0, toCm: 10, thicknessMm: 20 })).toBe(false)
  })
})

describe("инструмент: торец", () => {
  const NONE: PlasterMark[] = []
  function setup(initial: Drawing, thicknessMm = 20) {
    let d = initial
    const log = { records: 0 }
    const host: PlasterToolHost = {
      drawing: () => d,
      scene: () => roughScene(d),
      marks: () => d.roughPlaster ?? NONE,
      setMarks: (next) => {
        d = { ...d, roughPlaster: next }
      },
      record: () => {
        log.records++
      },
      changed: () => undefined,
      redraw: () => undefined,
      radiusCm: () => 5,
      newId: idGen(),
      newThicknessMm: () => thicknessMm,
    }
    return { tool: createPlasterTool(host), log, marks: () => d.roughPlaster ?? NONE }
  }
  const px = (x: number, y = 0): Point => ({ x, y })
  const click = (s: ReturnType<typeof setup>, x: number, y: number): string | null => {
    s.tool.down(px(0))
    return s.tool.up(px(x, y), px(1))
  }

  it("PE-10: клик за свободным торцом ставит пометку торца толщиной из панели одним шагом; повторный клик ничего не меняет", () => {
    const s = setup(drawing(), 30)
    expect(click(s, 503, 0)).toBe("n1")
    expect(s.marks()).toEqual([endMark("n1", "W", "b", 30)])
    expect(s.log.records).toBe(1)
    expect(s.tool.selectedId()).toBe("n1")
    expect(click(s, 503, 0)).toBeNull()
    expect(s.log.records).toBe(1)
  })

  it("PE-11: клик за концом оси, но правее тела, ставит боковую грань, а не торец", () => {
    const s = setup(drawing())
    click(s, 503, 14)
    expect(s.marks()[0]?.face).toBe(1)
  })

  it("PE-12: размер торца не редактируется; Delete и правка толщины работают", () => {
    const s = setup(drawing(), 20)
    click(s, 503, 0)
    expect(s.tool.numberAt(px(500, 0), "cm", 2, 14, 100)).toBeNull()
    expect(s.tool.setSelectedThickness(40)).toBe(true)
    expect(s.marks()[0]?.thicknessMm).toBe(40)
    expect(s.tool.deleteSelected()).toBe(true)
    expect(s.marks()).toEqual([])
  })

  it("PE-13: у конца остатка на срезе сноса торца нет — ставится боковая грань", () => {
    const s = setup(drawing({ demolition: [demolitionMark("m", "W", "a", 200, 300)] }))
    click(s, 203, 0)
    const [mark] = s.marks()
    expect(mark === undefined || mark.face !== "end").toBe(true)
  })
})
