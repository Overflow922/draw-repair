import { describe, expect, it } from "vitest"
import { mountingScene } from "../mounting/mounting-scene"
import { plasterPieces, plasterStrip } from "./plaster"
import { roughScene } from "./rough-scene"
import { areaOf, boxOf, demolitionMark, doorOn, drawing, openingOn, plaster, r6, reveal, wall, windowOn } from "./rough.test-utils"

// change plaster-opening-reveals: куски и полоса откоса
// (spec rough-works-plan «Штукатурка откосов проёма»)

const WIN = windowOn("win", "W", 100, 120) // откосы x = 100 и x = 220 на стене W (0,0)-(500,0), 20 см

const boxOfDrawing = (d: ReturnType<typeof drawing>) => boxOf(plasterPieces(d, mountingScene(d)).map(plasterStrip))
const xs = (b: ReturnType<typeof boxOf>) => [r6(b.minX), r6(b.maxX), r6(b.minY), r6(b.maxY)]

describe("откос окна", () => {
  it("RV-1: откос a толщиной 20 мм — прямоугольник x 100…102, y −10…10", () => {
    const d = drawing({ doorways: [WIN], roughPlaster: [reveal("r", "win", "a", 20)] })
    expect(plasterPieces(d, mountingScene(d))).toHaveLength(1)
    expect(xs(boxOfDrawing(d))).toEqual([100, 102, -10, 10])
  })

  it("RV-1: откос b — прямоугольник x 218…220", () => {
    const d = drawing({ doorways: [WIN], roughPlaster: [reveal("r", "win", "b", 20)] })
    expect(xs(boxOfDrawing(d))).toEqual([218, 220, -10, 10])
  })

  it("RV-1: площадь полосы откоса = глубина × толщина стены", () => {
    const d = drawing({ doorways: [WIN], roughPlaster: [reveal("r", "win", "a", 30)] })
    expect(r6(areaOf(plasterPieces(d, mountingScene(d)).map(plasterStrip)))).toBe(60)
  })

  it("RV-1: откос на стене, привязанной к концу b, остаётся ближним к концу a или b по оси", () => {
    // та же геометрия окна, заданная от конца b: откосы x = 100 и x = 220
    const d = drawing({ doorways: [windowOn("win", "W", 280, 120, "b")], roughPlaster: [reveal("r", "win", "a", 20)] })
    expect(xs(boxOfDrawing(d))).toEqual([100, 102, -10, 10])
  })
})

describe("другие виды элементов", () => {
  it("RV-2: у проёма и двери откос такой же", () => {
    const d = drawing({
      doorways: [openingOn("op", "W", 100, 90), doorOn("dr", "W", 300, 90)],
      roughPlaster: [reveal("r1", "op", "b", 20), reveal("r2", "dr", "a", 20)],
    })
    const boxes = plasterPieces(d, mountingScene(d)).map((p) => xs(boxOf([plasterStrip(p)])))
    expect(boxes).toEqual([
      [188, 190, -10, 10],
      [300, 302, -10, 10],
    ])
  })
})

describe("откос и грани", () => {
  it("RV-3: полоса откоса лежит между гранями, полоса грани через окно — снаружи", () => {
    const d = drawing({ doorways: [WIN], roughPlaster: [plaster("p", "W", 1, "a", 0, 500, 20), reveal("r", "win", "a", 20)] })
    const [face, rev] = plasterPieces(d, mountingScene(d))
    if (!face || !rev) throw new Error("ожидались два куска")
    expect(r6(boxOf([plasterStrip(face)]).minY)).toBe(10)
    expect(r6(boxOf([plasterStrip(rev)]).maxY)).toBe(10)
  })

  it("RV-3: откос не меняет куски граней и торцов", () => {
    const without = drawing({ doorways: [WIN], roughPlaster: [plaster("p", "W", 1, "a", 0, 500, 20)] })
    const withReveal = drawing({ doorways: [WIN], roughPlaster: [plaster("p", "W", 1, "a", 0, 500, 20), reveal("r", "win", "a", 20)] })
    const a = plasterPieces(without, mountingScene(without)).map((p) => [p.from, p.to])
    const b = plasterPieces(withReveal, mountingScene(withReveal)).filter((p) => p.mark.face === 1).map((p) => [p.from, p.to])
    expect(b).toEqual(a)
  })
})

describe("узкий проём", () => {
  it("RV-4: проём 3 см, 20 мм — каждая полоса не шире 1,5 см, полосы не перекрываются", () => {
    const d = drawing({ doorways: [openingOn("op", "W", 100, 3)], roughPlaster: [reveal("r1", "op", "a", 20), reveal("r2", "op", "b", 20)] })
    const [a, b] = plasterPieces(d, mountingScene(d)).map((p) => boxOf([plasterStrip(p)]))
    if (!a || !b) throw new Error("ожидались два куска")
    expect([r6(a.minX), r6(a.maxX)]).toEqual([100, 101.5])
    expect([r6(b.minX), r6(b.maxX)]).toEqual([101.5, 103])
  })
})

describe("откос следует за элементом", () => {
  it("RV-5: окно сдвинуто на 30 см — полоса сдвинулась на 30 см", () => {
    const d = drawing({ doorways: [windowOn("win", "W", 130, 120)], roughPlaster: [reveal("r", "win", "a", 20)] })
    expect(xs(boxOfDrawing(d))).toEqual([130, 132, -10, 10])
  })

  it("RV-5: стена перемещена на (0, 100) — полоса y 90…110", () => {
    const d = drawing({ walls: [wall("W", 0, 100, 500, 100)], doorways: [WIN], roughPlaster: [reveal("r", "win", "a", 20)] })
    expect(xs(boxOfDrawing(d))).toEqual([100, 102, 90, 110])
  })

  it("RV-5: окно на собственной стене «Монтажа» — откос действует", () => {
    const own = wall("N", 0, 300, 400, 300)
    const d = drawing({
      mounting: { walls: [own], dimensions: [], doorways: [windowOn("mw", "N", 50, 100)] },
      roughPlaster: [reveal("r", "mw", "a", 20)],
    })
    expect(xs(boxOfDrawing(d))).toEqual([50, 52, 290, 310])
  })
})

describe("откос и пропавший элемент", () => {
  it("RV-6: элемента нет — откос не показан; элемент вернулся — действует с прежней толщиной", () => {
    const marks = [reveal("r", "win", "a", 35)]
    const absent = drawing({ roughPlaster: marks })
    expect(plasterPieces(absent, mountingScene(absent))).toHaveLength(0)
    expect(absent.roughPlaster).toEqual(marks)
    const back = drawing({ doorways: [WIN], roughPlaster: marks })
    expect(xs(boxOfDrawing(back))).toEqual([100, 103.5, -10, 10])
  })

  it("RV-6: участок стены под проёмом снесён (окно снос блокирует) — откос не показан", () => {
    const d = drawing({ doorways: [openingOn("op", "W", 100, 120)], demolition: [demolitionMark("m", "W", "a", 90, 230)], roughPlaster: [reveal("r", "op", "a", 20)] })
    expect(plasterPieces(d, mountingScene(d))).toHaveLength(0)
  })

  it("RV-6: снос в другом месте стены откос не трогает", () => {
    const d = drawing({ doorways: [WIN], demolition: [demolitionMark("m", "W", "a", 300, 400)], roughPlaster: [reveal("r", "win", "a", 20)] })
    expect(xs(boxOfDrawing(d))).toEqual([100, 102, -10, 10])
  })
})

describe("площадь после штукатурки", () => {
  it("RV-7: откосы окна в стене комнаты площадь помещения после штукатурки не меняют", () => {
    const walls = [wall("A", 0, 0, 500, 0), wall("B", 500, 0, 500, 400), wall("C", 500, 400, 0, 400), wall("D", 0, 400, 0, 0)]
    const onA = windowOn("win", "A", 100, 120)
    const bare = drawing({ walls, doorways: [onA] })
    const revealed = drawing({ walls, doorways: [onA], roughPlaster: [reveal("r1", "win", "a", 50), reveal("r2", "win", "b", 50)] })
    const [before] = roughScene(bare).netItems
    const [after] = roughScene(revealed).netItems
    expect(after?.room.areaCm2).toBe(before?.room.areaCm2)
    expect(roughScene(revealed).pieces).toHaveLength(2)
  })
})
