import type { Shape } from "../communications/shape"
import { numberAt } from "../doorway/editable-numbers"
import type { SizeMetrics } from "../furniture/item-size-layout"
import type { LightFixture, LightKind, Point, Unit, View } from "../types"
import { PX_PER_CM } from "../types"
import { applyLightDistance, lightNumberLayout } from "./light-numbers"
import type { LightNumber } from "./light-numbers"
import { insideBodies, snapSconce } from "./light-reach"
import type { LightAxis } from "./light-reach"
import { lightHitRadiusPx } from "./light-symbol"
import { addLight, moveLight, newLight, removeLight } from "./lights"
import type { LightPlacement } from "./lights"

// Инструмент «Освещение» и правка объектов освещения без инструмента (change add-ceiling-lighting, design D5–D7): постановка с
// призраком, выделение по знаку и по числу, перетаскивание, Delete, ластик, ввод расстояния. Состояние выделения и
// перетаскивания без DOM; данные чертежа, история и перерисовка — через явный хост (по образцу инструмента «Натяжной потолок»).

export interface LightToolHost {
  bodies(): readonly Shape[] // чистовые грани подложки (furnitureReachBodies)
  lights(): LightFixture[]
  setLights(next: LightFixture[]): void
  record(): void // одна запись истории (снимок плана до операции) — перед setLights и только при изменении
  changed(): void
  redraw(): void
  placed?(light: LightFixture): void // после постановки: вызывающий ставит светильнику линию (change line-dropdown, design D2)
  newId(): string
  kind(): LightKind // текущий вид группы «Освещение» — для новых объектов
  view(): View
  unit(): Unit
  metrics: SizeMetrics // кегль чисел и зазор до линии на холсте
}

export type LightPress = { kind: "number"; number: LightNumber; wasSelected: boolean } | { kind: "symbol"; light: LightFixture } | null

export interface LightTool {
  ghost(p: Point): LightFixture | null
  place(p: Point): boolean
  symbolAt(p: Point): LightFixture | null
  numberAt(p: Point): LightNumber | null // число любого объекта под точкой (ластик по числу ничего не стирает)
  numbers(): LightNumber[] // числа всех объектов (с учётом перетаскиваемого)
  displayed(): LightFixture[] // объекты как нарисованы: перетаскиваемый — в текущем положении
  press(p: Point): LightPress // без инструмента: число главнее знака; выделяет объект
  select(p: Point): boolean
  selectedId(): string | null
  clearSelection(): void
  deleteSelected(): boolean
  beginDrag(p: Point): boolean
  dragTo(p: Point): void
  endDrag(): boolean
  dragging(): boolean
  setDistance(id: string, axis: LightAxis, valueCm: number): boolean
  erase(p: Point): boolean
  eraseTarget(p: Point): string | null
}

const SCONCE_SNAP_PX = 40
const NUMBER_HIT_PX = 4 // допуск попадания в число, как у чисел проёма и предмета мебели

export function createLightTool(host: LightToolHost): LightTool {
  let selected: string | null = null
  let drag: { id: string; offset: Point; place: LightPlacement | null } | null = null

  const k = (): number => PX_PER_CM * host.view().zoom

  const commit = (next: LightFixture[]): boolean => {
    if (next === host.lights()) return false
    host.record()
    host.setLights(next)
    host.changed()
    host.redraw()
    return true
  }

  // положение объекта вида kind у точки p: точка — округлённая, вне тел; бра — на ближайшей грани в 40 px; null — нельзя
  const placementAt = (kind: LightKind, p: Point): LightPlacement | null => {
    const bodies = host.bodies()
    if (kind === "sconce") return snapSconce(p, bodies, SCONCE_SNAP_PX / k())
    const at = { x: Math.round(p.x), y: Math.round(p.y) }
    return insideBodies(at, bodies) ? null : { at }
  }

  const displayed = (): LightFixture[] => {
    const lights = host.lights()
    if (!drag?.place) return lights
    const { id, place } = drag
    return moveLight(lights, id, place)
  }

  const numbers = (): LightNumber[] => {
    const bodies = host.bodies()
    return displayed().flatMap((l) => lightNumberLayout(l, bodies, host.unit(), k(), host.metrics))
  }

  const symbolAt = (p: Point): LightFixture | null => {
    const lights = displayed()
    for (let i = lights.length - 1; i >= 0; i--) {
      const l = lights[i]
      if (l && Math.hypot(p.x - l.x, p.y - l.y) <= lightHitRadiusPx(l.kind) / k()) return l
    }
    return null
  }

  const numberUnder = (p: Point): LightNumber | null => numberAt(p, numbers(), NUMBER_HIT_PX / k())

  return {
    ghost(p) {
      const kind = host.kind()
      const place = placementAt(kind, p)
      return place ? newLight(kind, place, "ghost") : null
    },
    place(p) {
      const kind = host.kind()
      const place = placementAt(kind, p)
      if (!place) return false
      const light = newLight(kind, place, host.newId())
      const done = commit(addLight(host.lights(), light))
      if (done) host.placed?.(light)
      return done
    },
    symbolAt,
    numberAt: numberUnder,
    numbers,
    displayed,
    press(p) {
      const n = numberUnder(p)
      if (n) {
        const wasSelected = selected === n.lightId
        selected = n.lightId
        host.redraw()
        return { kind: "number", number: n, wasSelected }
      }
      const light = symbolAt(p)
      selected = light?.id ?? null
      host.redraw()
      return light ? { kind: "symbol", light } : null
    },
    select(p) {
      const light = numberUnder(p)?.lightId ?? symbolAt(p)?.id ?? null
      selected = light
      host.redraw()
      return light !== null
    },
    selectedId: () => selected,
    clearSelection() {
      selected = null
      drag = null
      host.redraw()
    },
    deleteSelected() {
      if (selected === null) return false
      const id = selected
      selected = null
      return commit(removeLight(host.lights(), id))
    },
    beginDrag(p) {
      const light = symbolAt(p)
      if (!light) return false
      selected = light.id
      drag = { id: light.id, offset: { x: light.x - p.x, y: light.y - p.y }, place: null }
      return true
    },
    dragTo(p) {
      if (!drag) return
      const light = host.lights().find((l) => l.id === drag?.id)
      if (!light) return
      drag = { ...drag, place: placementAt(light.kind, { x: p.x + drag.offset.x, y: p.y + drag.offset.y }) }
      host.redraw()
    },
    endDrag() {
      const d = drag
      drag = null
      if (!d?.place) {
        host.redraw()
        return false
      }
      const moved = commit(moveLight(host.lights(), d.id, d.place))
      if (!moved) host.redraw()
      return moved
    },
    dragging: () => drag !== null,
    setDistance: (id, axis, valueCm) => commit(applyLightDistance(host.lights(), id, axis, valueCm, host.bodies())),
    erase(p) {
      const hit = symbolAt(p)
      if (!hit) return false
      if (hit.id === selected) selected = null
      return commit(removeLight(host.lights(), hit.id))
    },
    eraseTarget: (p) => symbolAt(p)?.id ?? null,
  }
}
