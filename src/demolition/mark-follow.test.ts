import { describe, expect, it } from "vitest"
import type { Scene } from "../history"
import type { DemolitionMark, Wall } from "../types"
import { moveEndpointBounded, moveWallsBounded } from "../wall-edit"
import { mergeContinuation } from "../wall-merge"
import { W, boxOf, deepFreeze, mk, wall } from "./demolition.test-utils"
import { markRegion } from "./mark-region"
import { reanchorMarks } from "./mark-follow"
import { effectiveMarks } from "./marks"

// change demolition-plan: участок следует за стеной (spec demolition-plan «Участок следует за стеной»;
// design D6). Стена W — (0,0)-(500,0), кирпич, 20 см; метки — от конца привязки.

const FREE = { ortho: false } as const

const regionBox = (marks: DemolitionMark[], walls: Wall[], id = "m") => {
  const r = effectiveMarks(marks, walls).find((x) => x.mark.id === id)
  if (!r) throw new Error("пометка не действует")
  return boxOf(markRegion(r, walls))
}

const sceneOf = (walls: Wall[]): Scene => ({ walls, dimensions: [], doorways: [] })

function merged(walls: Wall[], extension: Wall): Wall[] {
  const r = mergeContinuation(sceneOf(walls), extension)
  if (r.kind !== "merged") throw new Error(`ожидалось слияние, получено ${r.kind}`)
  return r.scene.walls
}

describe("следование за перемещением стены (реальные операции wall-edit)", () => {
  it("FL-01: перемещение стены на (0, 100) переносит участок: область x 100–190, y 90–110", () => {
    const walls = [W()]
    moveWallsBounded(walls, [walls[0]!], { x: 0, y: 100 }, FREE)
    const box = regionBox([mk("m", "W", "a", 100, 190)], walls)
    expect(box.minX).toBeCloseTo(100, 6)
    expect(box.maxX).toBeCloseTo(190, 6)
    expect(box.minY).toBeCloseTo(90, 6)
    expect(box.maxY).toBeCloseTo(110, 6)
  })

  it("FL-02: перемещение конца привязки a с (0,0) в (−50,0) смещает участок вместе с ним: x 50–140", () => {
    const walls = [W()]
    moveEndpointBounded(walls, walls[0]!, "a", { x: -50, y: 0 }, FREE)
    const box = regionBox([mk("m", "W", "a", 100, 190)], walls)
    expect(box.minX).toBeCloseTo(50, 6)
    expect(box.maxX).toBeCloseTo(140, 6)
  })

  it("FL-03: перемещение второго конца b с (500,0) в (600,0) не смещает участок: x 100–190", () => {
    const walls = [W()]
    moveEndpointBounded(walls, walls[0]!, "b", { x: 600, y: 0 }, FREE)
    const box = regionBox([mk("m", "W", "a", 100, 190)], walls)
    expect(box.minX).toBeCloseTo(100, 6)
    expect(box.maxX).toBeCloseTo(190, 6)
  })

  it("FL-03: участок с привязкой b следует за концом b и не следует за концом a", () => {
    const walls = [W()]
    moveEndpointBounded(walls, walls[0]!, "a", { x: -50, y: 0 }, FREE)
    // b 50…140 = расстояния от b (x = 500): область x 360–450
    const box = regionBox([mk("m", "W", "b", 50, 140)], walls)
    expect(box.minX).toBeCloseTo(360, 6)
    expect(box.maxX).toBeCloseTo(450, 6)
  })
})

describe("reanchorMarks после слияния стен (реальный mergeContinuation)", () => {
  it("FL-04: удлинение у конца a до (−400,0): пометка привязки a 100–190 → привязка b, from 310, to 400; область прежняя x 100–190", () => {
    const before = [W()]
    const after = merged(before, wall(0, 0, -400, 0, "N"))
    const out = reanchorMarks([mk("m", "W", "a", 100, 190)], before, after)
    expect(out).toEqual([mk("m", "W", "b", 310, 400)])
    const box = regionBox(out, after)
    expect(box.minX).toBeCloseTo(100, 6)
    expect(box.maxX).toBeCloseTo(190, 6)
  })

  it("FL-04: пометка, уже привязанная к неподвижному концу b, не меняется", () => {
    const before = [W()]
    const after = merged(before, wall(0, 0, -400, 0, "N"))
    const list = [mk("m", "W", "b", 50, 140)]
    expect(reanchorMarks(list, before, after)).toEqual(list)
  })

  it("FL-05: удлинение у конца b до (900,0): пометка привязки a остаётся, область прежняя", () => {
    const before = [W()]
    const after = merged(before, wall(500, 0, 900, 0, "N"))
    const list = [mk("m", "W", "a", 100, 190)]
    expect(reanchorMarks(list, before, after)).toEqual(list)
    const box = regionBox(list, after)
    expect(box.minX).toBeCloseTo(100, 6)
    expect(box.maxX).toBeCloseTo(190, 6)
  })

  it("FL-05: у конца b пометка привязки b переходит на a: 50…140 (360–450) → a 360…450; область прежняя", () => {
    const before = [W()]
    const after = merged(before, wall(500, 0, 900, 0, "N"))
    const out = reanchorMarks([mk("m", "W", "b", 50, 140)], before, after)
    expect(out).toEqual([mk("m", "W", "a", 360, 450)])
    const box = regionBox(out, after)
    expect(box.minX).toBeCloseTo(360, 6)
    expect(box.maxX).toBeCloseTo(450, 6)
  })

  it("FL-06: пометки других стен и пометки на отсутствующие стены не меняются, порядок сохраняется", () => {
    const other = wall(0, 300, 500, 300, "V")
    const before = [W(), other]
    const after = merged(before, wall(0, 0, -400, 0, "N"))
    const list = [mk("v", "V", "a", 10, 60), mk("m", "W", "a", 100, 190), mk("g", "gone", "a", 5, 50)]
    expect(reanchorMarks(list, before, after)).toEqual([mk("v", "V", "a", 10, 60), mk("m", "W", "b", 310, 400), mk("g", "gone", "a", 5, 50)])
  })

  it("FL-06: несколько пометок одной стены переносятся все", () => {
    const before = [W()]
    const after = merged(before, wall(0, 0, -400, 0, "N"))
    const out = reanchorMarks([mk("m1", "W", "a", 10, 60), mk("m2", "W", "a", 100, 190)], before, after)
    expect(out).toEqual([mk("m1", "W", "b", 440, 490), mk("m2", "W", "b", 310, 400)])
  })

  it("FL-07: стены без изменений — пометки без изменений (тот же массив допустим)", () => {
    const list = [mk("m", "W", "a", 100, 190)]
    expect(reanchorMarks(list, [W()], [W()])).toEqual(list)
  })

  it("FL-07: изменились обе вершины — пометки без изменений", () => {
    const list = [mk("m", "W", "a", 100, 190)]
    expect(reanchorMarks(list, [W()], [wall(-100, 0, 600, 0, "W")])).toEqual(list)
  })

  it("FL-07: конец сместился внутрь (стена укорочена) — пометки без изменений", () => {
    const list = [mk("m", "W", "a", 100, 190)]
    expect(reanchorMarks(list, [W()], [wall(0, 0, 300, 0, "W")])).toEqual(list)
  })

  it("FL-07: конец сместился в сторону с поворотом — пометки без изменений", () => {
    const list = [mk("m", "W", "a", 100, 190)]
    expect(reanchorMarks(list, [W()], [wall(0, 0, 500, 40, "W")])).toEqual(list)
  })

  // пометки, привязанные именно к сдвинутому концу b: только слияние (удлинение на том же луче) переносит привязку
  it("FL-07: конец b сместился внутрь — пометка привязки b (к сдвинутому концу) без изменений", () => {
    const list = [mk("m", "W", "b", 50, 140)]
    expect(reanchorMarks(list, [W()], [wall(0, 0, 300, 0, "W")])).toEqual(list)
  })

  it("FL-07: конец b сместился в сторону — пометка привязки b без изменений", () => {
    const list = [mk("m", "W", "b", 50, 140)]
    expect(reanchorMarks(list, [W()], [wall(0, 0, 500, 40, "W")])).toEqual(list)
  })

  it("FL-07: конец b сместился наружу и в сторону (не на том же луче) — пометка привязки b без изменений, привязки a тоже", () => {
    const list = [mk("m1", "W", "a", 100, 190), mk("m2", "W", "b", 50, 140)]
    expect(reanchorMarks(list, [W()], [wall(0, 0, 600, 40, "W")])).toEqual(list)
  })

  it("FL-07: конец a сместился внутрь и в сторону — пометка привязки a (к сдвинутому концу) без изменений", () => {
    const list = [mk("m", "W", "a", 100, 190)]
    expect(reanchorMarks(list, [W()], [wall(100, 0, 500, 0, "W")])).toEqual(list)
    expect(reanchorMarks(list, [W()], [wall(0, 40, 500, 0, "W")])).toEqual(list)
  })

  it("FL-07: изменились обе вершины — пометки обеих привязок без изменений", () => {
    const list = [mk("m1", "W", "a", 100, 190), mk("m2", "W", "b", 50, 140)]
    expect(reanchorMarks(list, [W()], [wall(-100, 0, 600, 0, "W")])).toEqual(list)
  })

  it("FL-08: вход не мутируется", () => {
    const before = deepFreeze([W()])
    const after = deepFreeze(merged([W()], wall(0, 0, -400, 0, "N")))
    expect(() => reanchorMarks(deepFreeze([mk("m", "W", "a", 100, 190)]), before, after)).not.toThrow()
  })

  it("FL-09: инвариант — область каждой пометки в мире не меняется при слиянии у любого конца и любой привязке", () => {
    const marks = [mk("a1", "W", "a", 20, 80), mk("a2", "W", "a", 300, 360), mk("b1", "W", "b", 30, 90), mk("b2", "W", "b", 200, 260)]
    for (const ext of [wall(0, 0, -400, 0, "N"), wall(500, 0, 900, 0, "N")]) {
      const before = [W()]
      const after = merged(before, ext)
      const out = reanchorMarks(marks, before, after)
      for (const m of marks) {
        const was = regionBox(marks, before, m.id)
        const now = regionBox(out, after, m.id)
        expect(now.minX).toBeCloseTo(was.minX, 6)
        expect(now.maxX).toBeCloseTo(was.maxX, 6)
        expect(now.minY).toBeCloseTo(was.minY, 6)
        expect(now.maxY).toBeCloseTo(was.maxY, 6)
      }
    }
  })
})
