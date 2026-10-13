import { describe, expect, it } from "vitest"
import type { Scene } from "./history"
import type { Wall, WallElement } from "./types"
import { jambsT } from "./doorway/doorway-faces"
import { made, sceneF, sceneFa } from "./doorway/opening-reach-body-end.test-utils"
import { w } from "./doorway/doorway.test-utils"
import { win } from "./doorway/window.test-utils"
import { mergeContinuation } from "./wall-merge"

// change fix-opening-reach-body-end (test-plan T-25): элемент на выступе тела опорной стены при удлинении стены
// слиянием остаётся на месте в плане; привязка пересчитывается, смещение может стать отрицательным
// (spec doorway «Элементы остаются на месте при удлинении опорной стены»).
// Сцена F: блочная W (0,0)-(500,0), бетонная C (510,0)-(700,0) раньше; тело W доходит до x = 510.
// Окно на выступе: привязка a, смещение 390, ширина 120 — откосы x 390…510.

describe("слияние: элемент на выступе остаётся на месте", () => {
  const { walls } = sceneF()
  const hostOf = (list: Wall[]): Wall => {
    const found = list.find((x) => x.id === "W")
    if (!found) throw new Error("нет W")
    return found
  }
  const extension = (): Wall => made(w(0, 0, -200, 0, "N"), "blocks")

  it("T-25: удлинение у конца a — окно с привязкой a переходит на привязку b, смещение −10, откосы в плане те же", () => {
    const e = win("W", "a", 390, 120, 150, 85, "e0")
    const scene: Scene = { walls, dimensions: [], doorways: [e] }
    const r = mergeContinuation(scene, extension())
    expect(r.kind).toBe("merged")
    if (r.kind !== "merged") return
    const host = hostOf(r.scene.walls)
    expect(host.a.x).toBeCloseTo(-200, 6)
    const moved = r.scene.doorways?.find((x) => x.id === "e0")
    expect(moved).toBeDefined()
    if (!moved) return
    expect(moved.wallId).toBe("W")
    expect(moved.anchor).toBe("b")
    expect(moved.offsetCm).toBeCloseTo(-10, 6)
    expect(moved.widthCm).toBe(120)
    const [j1, j2] = jambsT(moved, host)
    expect(host.a.x + j1).toBeCloseTo(390, 6)
    expect(host.a.x + j2).toBeCloseTo(510, 6)
  })

  it("T-25c: удлинение у свободного конца b при выступе у конца a — окно со смещением −10 (привязка a) не меняется", () => {
    const fa = sceneFa()
    const e: WallElement = win("W", "a", -10, 120, 150, 85, "e0")
    const scene: Scene = { walls: fa.walls, dimensions: [], doorways: [e] }
    const r = mergeContinuation(scene, made(w(700, 0, 900, 0, "N"), "blocks"))
    expect(r.kind).toBe("merged")
    if (r.kind !== "merged") return
    expect(r.scene.doorways).toEqual([e])
  })

  it("T-25b: элемент с привязкой b и смещением −10 при удлинении у конца a не меняется", () => {
    const e: WallElement = win("W", "b", -10, 120, 150, 85, "e0")
    const scene: Scene = { walls, dimensions: [], doorways: [e] }
    const r = mergeContinuation(scene, extension())
    expect(r.kind).toBe("merged")
    if (r.kind !== "merged") return
    expect(r.scene.doorways).toEqual([e])
  })
})
