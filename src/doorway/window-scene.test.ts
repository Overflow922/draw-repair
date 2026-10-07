import { describe, expect, it } from "vitest"
import { cloneScene, record, undoEntry } from "../history"
import type { DrawingHistory, Scene } from "../history"
import type { WallElement } from "../types"
import { deleteObjects, doorwaysInRect, erasePick, hitDoorway, wallsInRect } from "./doorway-scene"
import { w } from "./doorway.test-utils"
import { sceneRN, win } from "./window.test-utils"

// change add-window: окна в попадании, рамке, ластике и каскаде удаления наравне с проёмами
// (spec doorway «Элементы стены»; wall-deletion, multi-selection через «Элементы стены»; design D3, D9).

const scene = (): { s: Scene; ids: (e: readonly WallElement[] | undefined) => string[] } & ReturnType<typeof sceneRN> => {
  const r = sceneRN()
  return { ...r, s: { walls: r.walls, dimensions: [], doorways: r.elements }, ids: (e) => (e ?? []).map((x) => x.id) }
}

describe("окно в выборе и удалении", () => {
  it("WC-01: ластик внутри окна выбирает окно; удаление оставляет стену", () => {
    const { walls, wn, d, s } = scene()
    expect(erasePick({ x: 340, y: 0 }, { walls, dimensions: [], doorways: [d, wn] }, 3, 1)).toEqual({ kind: "doorway", doorway: wn })
    const after = deleteObjects(s, { walls: [], dimensions: [], doorways: [wn] })
    expect(after.walls).toEqual(walls)
    expect(after.doorways).toEqual([d])
  })

  it("WC-02: рамка выделяет и проём, и окно; Delete удаляет оба, стены остаются", () => {
    const { walls, d, wn, s, ids } = scene()
    const picked = doorwaysInRect({ x: 150, y: -30 }, { x: 350, y: 30 }, walls, [d, wn])
    expect(ids(picked)).toEqual(["d0", "w0"])
    const after = deleteObjects(s, { walls: [], dimensions: [], doorways: picked })
    expect(after.walls).toHaveLength(4)
    expect(after.doorways).toEqual([])
  })

  it("WC-03: удаление стены удаляет её проём и окно, элементы других стен остаются; undo возвращает оба", () => {
    const { walls, W, d, wn, s } = scene()
    const onB = win("B", "a", 100, 120, 150, 85, "wb")
    const full: Scene = { ...s, doorways: [d, wn, onB] }
    const after = deleteObjects(full, { walls: [W], dimensions: [], doorways: [] })
    expect(after.walls).toEqual(walls.filter((x) => x !== W))
    expect(after.doorways).toEqual([onB])
    const h: DrawingHistory = { past: [], future: [] }
    record(h, cloneScene(full))
    const undone = undoEntry(h, after)
    expect(undone?.kind).toBe("walls")
    if (undone?.kind === "walls") expect(undone.doorways).toEqual([d, wn, onB])
  })

  it("WC-04: клик по окну — окно; по стене между элементами — не элемент", () => {
    const { walls, d, wn } = scene()
    expect(hitDoorway({ x: 340, y: 5 }, walls, [d, wn], 3)).toBe(wn)
    expect(hitDoorway({ x: 235, y: 0 }, walls, [d, wn], 3)).toBeNull()
  })

  it("WC-05: рамка через ось только на участке окна не выделяет стену; через ось вне элементов — выделяет", () => {
    const { walls, W, d, wn } = scene()
    expect(wallsInRect({ x: 300, y: -30 }, { x: 380, y: 30 }, walls, [d, wn])).not.toContain(W)
    expect(wallsInRect({ x: 220, y: -30 }, { x: 250, y: 30 }, walls, [d, wn])).toContain(W)
  })

  it("WC-06: удаление выделенных элементов на разных стенах одним вызовом", () => {
    const V = w(0, 300, 500, 300, "V")
    const a = win("V", "a", 50, 120, 150, 85, "va")
    const { walls, d, wn } = sceneRN()
    const s: Scene = { walls: [...walls, V], dimensions: [], doorways: [d, wn, a] }
    const after = deleteObjects(s, { walls: [], dimensions: [], doorways: [d, a] })
    expect(after.doorways).toEqual([wn])
  })
})
