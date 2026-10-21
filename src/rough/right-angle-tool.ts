import type { Point, RightAngleMark } from "../types"
import { add, dist, dot, mul, sub } from "../wall-geometry"
import type { PlasterCorner } from "./plaster-corner"
import { addRightAngle, removeRightAngle } from "./right-angle"
import type { ActiveRightAngle } from "./right-angle"
import type { RoughScene } from "./rough-scene"

// Инструмент «Прямой угол», выделение знака и ластик (change plaster-right-angle, design D4–D5): состояние наведения и выделения
// без DOM. Данные чертежа, история и перерисовка — через явный RightAngleToolHost.

export interface RightAngleToolHost {
  scene(): RoughScene // углы контура штукатурки и действующие пометки на текущий момент
  marks(): RightAngleMark[]
  setMarks(next: RightAngleMark[]): void
  record(): void // одна запись истории (снимок списков до операции) — перед setMarks и только при изменении
  changed(): void
  redraw(): void
  radiusCm(): number // радиус выбора, как у инструмента «Штукатурка»
  armCm(): number // длина плеча знака в сантиметрах чертежа (постоянная в пикселях)
  newId(): string
}

export interface RightAngleTool {
  hover(p: Point | null): void // наведение: подсвечивается угол в радиусе выбора; null — курсор ушёл с плана
  ghost(): PlasterCorner | null // подсвеченный угол
  place(p: Point): boolean // клик инструментом: поставить пометку на угол в радиусе; false — ничего не изменилось
  cancel(): void // Escape: снять подсветку
  select(p: Point): boolean // без инструмента: выделить пометку по знаку под точкой; false — выделение снято
  selectedId(): string | null
  clearSelection(): void
  deleteSelected(): boolean
  erase(p: Point): boolean // ластик: знак под точкой
  eraseTarget(p: Point): string | null
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const d = sub(b, a)
  const len2 = dot(d, d)
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, dot(sub(p, a), d) / len2))
  return dist(p, add(a, mul(d, t)))
}

export function createRightAngleTool(host: RightAngleToolHost): RightAngleTool {
  let target: PlasterCorner | null = null
  let selected: string | null = null

  const commit = (next: RightAngleMark[]): boolean => {
    if (next === host.marks()) return false
    host.record()
    host.setMarks(next)
    host.changed()
    host.redraw()
    return true
  }

  // угол, чья вершина в радиусе выбора и ближе всех к точке
  const cornerAt = (p: Point): PlasterCorner | null => {
    const reach = host.radiusCm()
    let best: PlasterCorner | null = null
    let bestDist = Infinity
    for (const c of host.scene().corners) {
      const d = dist(c.point, p)
      if (d <= reach && d < bestDist) {
        best = c
        bestDist = d
      }
    }
    return best
  }

  // действующая пометка, знак (два плеча от вершины) которой в радиусе выбора от точки; ближайшая к точке
  const signAt = (p: Point): ActiveRightAngle | null => {
    const reach = host.radiusCm()
    const arm = host.armCm()
    let best: ActiveRightAngle | null = null
    let bestDist = Infinity
    for (const a of host.scene().rightAngles) {
      const { point, arms } = a.corner
      const d = Math.min(...arms.map((dir) => distanceToSegment(p, point, add(point, mul(dir, arm)))))
      if (d <= reach && d < bestDist) {
        best = a
        bestDist = d
      }
    }
    return best
  }

  return {
    hover(p) {
      const next = p === null ? null : cornerAt(p)
      if (next === target) return
      target = next
      host.redraw()
    },
    ghost: () => target,
    place(p) {
      const corner = cornerAt(p)
      return corner ? commit(addRightAngle(host.marks(), corner, host.newId)) : false
    },
    cancel() {
      if (target === null) return
      target = null
      host.redraw()
    },
    select(p) {
      const hit = signAt(p)
      selected = hit ? hit.mark.id : null
      host.redraw()
      return hit !== null
    },
    selectedId: () => selected,
    clearSelection() {
      selected = null
      host.redraw()
    },
    deleteSelected() {
      if (selected === null) return false
      const id = selected
      selected = null
      return commit(removeRightAngle(host.marks(), id))
    },
    erase(p) {
      const hit = signAt(p)
      if (!hit) return false
      if (hit.mark.id === selected) selected = null
      return commit(removeRightAngle(host.marks(), hit.mark.id))
    },
    eraseTarget: (p) => signAt(p)?.mark.id ?? null,
  }
}
