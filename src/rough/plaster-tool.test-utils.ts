import type { Drawing, PlasterMark, Point } from "../types"
import { createPlasterTool } from "./plaster-tool"
import type { PlasterToolHost } from "./plaster-tool"
import { roughScene } from "./rough-scene"
import { idGen } from "./rough.test-utils"

// Хост инструмента «Штукатурка» для тестов жестов: данные чертежа в замыкании, счётчики записей истории, сохранений и перерисовок.

const NONE: PlasterMark[] = []

export function setup(initial: Drawing, thicknessMm = 20) {
  let d = initial
  const log = { records: 0, changes: 0, redraws: 0 }
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
    changed: () => {
      log.changes++
    },
    redraw: () => {
      log.redraws++
    },
    radiusCm: () => 5,
    newId: idGen(),
    newThicknessMm: () => thicknessMm,
  }
  return { tool: createPlasterTool(host), log, marks: () => d.roughPlaster ?? [], drawing: () => d }
}

export type Setup = ReturnType<typeof setup>

export const px = (x: number, y = 0): Point => ({ x, y })
