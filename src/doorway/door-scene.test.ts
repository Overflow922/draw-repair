import { describe, expect, it } from "vitest"
import { cloneScene, record, undoEntry } from "../history"
import type { DrawingHistory, Scene } from "../history"
import type { WallElement } from "../types"
import { deleteObjects, doorwaysInRect, erasePick, hitDoorway } from "./doorway-scene"
import { D0, sceneF } from "./doorway.test-utils"
import { win } from "./window.test-utils"
import { DR, dr } from "./door.test-utils"

// change add-door: дверь в попадании, рамке, ластике и каскаде наравне с другими элементами; полотно и дуга
// на попадание не влияют (spec door «Отображение двери»; doorway «Элементы стены»).

describe("попадание по двери", () => {
  it("DC-01: клик внутри прямоугольника полотна вне стены не выделяет дверь; на участке — дверь", () => {
    const { walls } = sceneF()
    const d = DR("a", "left")
    // полотно a/left: от (100, −10) к (92.16, −99.66), толщина 4 см в сторону x меньше — (94, −60) внутри
    expect(hitDoorway({ x: 94, y: -60 }, walls, [d], 3)).toBeNull()
    // на дуге открывания (100, −100)
    expect(hitDoorway({ x: 100, y: -100 }, walls, [d], 3)).toBeNull()
    expect(hitDoorway({ x: 150, y: 0 }, walls, [d], 3)).toBe(d)
  })

  it("DC-01b: ластик над полотном вне стены дверь не выбирает", () => {
    const { walls } = sceneF()
    const d = DR("a", "left")
    const pick = erasePick({ x: 94, y: -60 }, { walls, dimensions: [], doorways: [d] }, 3, 1)
    expect(pick === null || (pick.kind !== "doorway")).toBe(true)
  })
})

describe("дверь в удалении и рамке", () => {
  it("DC-02: ластик внутри участка двери выбирает дверь; удаление оставляет стену", () => {
    const { walls } = sceneF()
    const d = DR()
    expect(erasePick({ x: 150, y: 0 }, { walls, dimensions: [], doorways: [d] }, 3, 1)).toEqual({ kind: "doorway", doorway: d })
    const after = deleteObjects({ walls, dimensions: [], doorways: [d] }, { walls: [], dimensions: [], doorways: [d] })
    expect(after.walls).toEqual(walls)
    expect(after.doorways).toEqual([])
  })

  it("DC-03: рамка находит проём, окно и дверь; удаление стены удаляет все три, undo возвращает", () => {
    const { walls, W } = sceneF()
    const p = D0()
    const x = win("W", "a", 200, 100)
    const d = dr("W", "a", 320)
    const list: WallElement[] = [p, x, d]
    expect(doorwaysInRect({ x: 50, y: -30 }, { x: 450, y: 30 }, walls, list).map((e) => e.id)).toEqual(["d0", "w0", "dr0"])
    const s: Scene = { walls, dimensions: [], doorways: list }
    const after = deleteObjects(s, { walls: [W], dimensions: [], doorways: [] })
    expect(after.doorways).toEqual([])
    const h: DrawingHistory = { past: [], future: [] }
    record(h, cloneScene(s))
    const undone = undoEntry(h, after)
    expect(undone?.kind).toBe("walls")
    if (undone?.kind === "walls") expect(undone.doorways).toEqual([p, x, d])
  })
})
