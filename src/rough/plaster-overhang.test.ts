import { describe, expect, it } from "vitest"
import { markDimensions } from "../demolition/mark-dimensions"
import { plasterPieces, plasterStrip } from "./plaster"
import { roughScene } from "./rough-scene"
import { areaOf, boxOf, drawing, plaster, rectWalls, wall } from "./rough.test-utils"

// change plaster-face-to-corners: пометка в пределах оси, дошедшая до конца оси, действует до края грани (выступ тела)
// (spec rough-works-plan «Пометка штукатурки»; design D2–D4)

const span = (d: ReturnType<typeof drawing>) => plasterPieces(d).map((p) => [p.mark.wallId,Math.round(p.from * 10) / 10, Math.round(p.to * 10) / 10])

describe("выступ тела за ось", () => {
  it("PO-1: внешняя грань комнаты 0…500 действует от внешнего угла до внешнего угла (−10…510)", () => {
    const d = drawing({ walls: rectWalls("R", 0, 0, 500, 300), roughPlaster: [plaster("p", "R1", -1, "a", 0, 500)] })
    expect(span(d)).toEqual([["R1", -10, 510]])
  })

  it("PO-2: внешний угол с одной стороны — выступ только у этого конца, длина полосы 510 см", () => {
    const d = drawing({ walls: [wall("W", 0, 0, 500, 0), wall("V", 0, -300, 0, 0)], roughPlaster: [plaster("p", "W", 1, "a", 0, 500)] })
    expect(span(d)).toEqual([["W", -10, 500]])
    const piece = plasterPieces(d)[0]
    const box = piece && boxOf([plasterStrip(piece)])
    expect(box && box.maxX - box.minX).toBeCloseTo(510, 6)
  })

  it("PO-2b: ширина в размерной цепочке и площадь сцены равны длине полосы 510 см", () => {
    const d = drawing({ walls: [wall("W", 0, 0, 500, 0), wall("V", 0, -300, 0, 0)], roughPlaster: [plaster("p", "W", 1, "a", 0, 500, 20)] })
    const scene = roughScene(d)
    const piece = scene.pieces[0]
    const width = piece && markDimensions(piece, scene.base.walls, "chain", "cm", 2, 14).find((x) => x.side === 1 && x.target === "width")
    expect(width && width.valueCm).toBeCloseTo(510, 6)
    expect(areaOf(scene.strips)).toBeCloseTo(510 * 2, 6)
  })

  it("PO-3: участок внутри оси не продлевается", () => {
    const d = drawing({ walls: rectWalls("R", 0, 0, 500, 300), roughPlaster: [plaster("p", "R1", -1, "a", 100, 300)] })
    expect(span(d)).toEqual([["R1", 100, 300]])
  })

  it("PO-4: внутренняя грань комнаты выступа не имеет", () => {
    const d = drawing({ walls: rectWalls("R", 0, 0, 500, 300), roughPlaster: [plaster("p", "R1", 1, "a", 0, 500)] })
    expect(span(d)).toEqual([["R1", 0, 500]])
  })

  it("PO-5: привязка к концу b даёт тот же участок", () => {
    const d = drawing({ walls: rectWalls("R", 0, 0, 500, 300), roughPlaster: [plaster("p", "R1", -1, "b", 0, 500)] })
    expect(span(d)).toEqual([["R1", -10, 510]])
  })

  it("PO-6: на стыке коллинеарных стен выступа нет — стык закрывает кусок соседа", () => {
    const d = drawing({
      walls: [wall("W1", 0, 0, 300, 0, 20, "brick"), wall("W2", 300, 0, 600, 0, 20, "gkl")],
      roughPlaster: [plaster("p1", "W1", 1, "a", 0, 300), plaster("p2", "W2", 1, "a", 0, 300)],
    })
    expect(span(d)).toEqual([
      ["W1", 0, 300],
      ["W2", 0, 300],
    ])
  })

  it("PO-7: выступ исчезает вместе с углом и возвращается", () => {
    const base = { roughPlaster: [plaster("p", "W", 1, "a", 0, 500)] }
    expect(span(drawing({ ...base, walls: [wall("W", 0, 0, 500, 0), wall("V", 0, -300, 0, 0)] }))).toEqual([["W", -10, 500]])
    expect(span(drawing({ ...base, walls: [wall("W", 0, 0, 500, 0)] }))).toEqual([["W", 0, 500]])
  })
})
