import { lightHitRadiusPx } from "../ceiling/light-symbol"
import type { LightFixture, LightLine, Point, View } from "../types"
import { PX_PER_CM } from "../types"
import { lineLabelAt } from "./light-line-label"
import { canCarryLine, removeLine, renameLine, setLine, visibleLines } from "./light-lines"

// Инструмент «Линия освещения», выделение метки по тексту и правка (change add-light-lines, design D4): состояние выделения без
// DOM. Данные плана, история и перерисовка — через явный хост (по образцу инструмента «Натяжной потолок»).

export interface LightLineToolHost {
  lines(): LightLine[]
  setLines(next: LightLine[]): void
  lights(): readonly LightFixture[] // все объекты освещения плана «Потолки и освещение»
  record(): void // одна запись истории (снимок меток до операции) — перед setLines и только при изменении
  changed(): void
  redraw(): void
  newId(): string
  newName(): string // имя из панели инструмента — для новых меток
  view(): View
  unitsPerMm: number // пикселей холста на мм бумаги (размер текста метки и знака)
}

export interface LightLineTool {
  place(p: Point): boolean // клик инструментом: поставить или заменить метку у светильника под точкой; false — ничего не изменилось
  hoverTarget(p: Point): string | null // светильник под курсором, который может нести метку
  select(p: Point): boolean // без инструмента: выделить метку по тексту под точкой; false — выделение снято
  selectedId(): string | null
  selected(): LightLine | null
  clearSelection(): void
  deleteSelected(): boolean
  setSelectedName(name: string): boolean // правка в панели
  setNameOf(id: string, name: string): boolean // правка на месте
  labelAt(p: Point): LightLine | null
  erase(p: Point): boolean // ластик: метка под текстом
  eraseTarget(p: Point): string | null
}

export function createLightLineTool(host: LightLineToolHost): LightLineTool {
  let selectedLine: string | null = null

  const k = (): number => PX_PER_CM * host.view().zoom

  const commit = (next: LightLine[]): boolean => {
    if (next === host.lines()) return false
    host.record()
    host.setLines(next)
    host.changed()
    host.redraw()
    return true
  }

  // светильник под точкой: из совпавших зон побеждает позже поставленный
  const lightAt = (p: Point): LightFixture | null => {
    const lights = host.lights()
    for (let i = lights.length - 1; i >= 0; i--) {
      const l = lights[i]
      if (l && Math.hypot(p.x - l.x, p.y - l.y) <= lightHitRadiusPx(l.kind) / k()) return l
    }
    return null
  }

  // видимые метки с точкой привязки (центр светильника) и именем — для попадания по тексту
  const anchors = (): { at: Point; name: string; line: LightLine }[] =>
    visibleLines(host.lines(), host.lights()).map(({ line, light }) => ({ at: { x: light.x, y: light.y }, name: line.name, line }))

  const labelAt = (p: Point): LightLine | null => lineLabelAt(p, anchors(), host.view(), host.unitsPerMm)?.line ?? null

  return {
    place(p) {
      const light = lightAt(p)
      if (!light || !canCarryLine(light)) return false
      return commit(setLine(host.lines(), light.id, host.newName(), host.newId))
    },
    hoverTarget(p) {
      const light = lightAt(p)
      return light && canCarryLine(light) ? light.id : null
    },
    select(p) {
      const hit = labelAt(p)
      selectedLine = hit ? hit.id : null
      host.redraw()
      return hit !== null
    },
    selectedId: () => selectedLine,
    selected: () => host.lines().find((l) => l.id === selectedLine) ?? null,
    clearSelection() {
      selectedLine = null
      host.redraw()
    },
    deleteSelected() {
      if (selectedLine === null) return false
      const id = selectedLine
      selectedLine = null
      return commit(removeLine(host.lines(), id))
    },
    setSelectedName: (name) => (selectedLine === null ? false : commit(renameLine(host.lines(), selectedLine, name))),
    setNameOf: (id, name) => commit(renameLine(host.lines(), id, name)),
    labelAt,
    erase(p) {
      const hit = labelAt(p)
      if (!hit) return false
      if (hit.id === selectedLine) selectedLine = null
      return commit(removeLine(host.lines(), hit.id))
    },
    eraseTarget: (p) => labelAt(p)?.id ?? null,
  }
}
