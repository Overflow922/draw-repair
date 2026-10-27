import { lightHitRadiusPx } from "../ceiling/light-symbol"
import type { ExhaustFan, LightFixture, LightLine, Point, View } from "../types"
import { PX_PER_CM } from "../types"
import { exhaustHitRadiusPx } from "./exhaust-symbol"
import { lineLabelAt } from "./light-line-label"
import { canCarryLine, lineLabel, removeLine, renameLine, setLine, visibleLines } from "./light-lines"
import type { LineCarrier } from "./light-lines"

// Инструмент «Линия освещения», выделение метки по тексту и правка (change add-light-lines, design D4): состояние выделения без
// DOM. Данные плана, история и перерисовка — через явный хост (по образцу инструмента «Натяжной потолок»).

export interface LightLineToolHost {
  lines(): LightLine[]
  setLines(next: LightLine[]): void
  lights(): readonly LightFixture[] // все объекты освещения плана «Потолки и освещение»
  exhausts?(): readonly ExhaustFan[] // вытяжки плана (change add-exhaust-fan): носители меток вида «LV<n>»; нет — вытяжек нет
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
  setLineOf(carrierId: string, n: number): boolean // поле панели у выделенного светильника или вытяжки: поставить или сменить метку
  canCarry(carrierId: string): boolean // светильник или вытяжка, который может нести метку
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

  const exhausts = (): readonly ExhaustFan[] => host.exhausts?.() ?? []

  // носитель под точкой: вытяжка (слой выше), иначе светильник; из совпавших зон побеждает позже поставленный
  const carrierAt = (p: Point): LineCarrier | null => {
    const fans = exhausts()
    for (let i = fans.length - 1; i >= 0; i--) {
      const f = fans[i]
      if (f && Math.hypot(p.x - f.x, p.y - f.y) <= exhaustHitRadiusPx() / k()) return f
    }
    const lights = host.lights()
    for (let i = lights.length - 1; i >= 0; i--) {
      const l = lights[i]
      if (l && Math.hypot(p.x - l.x, p.y - l.y) <= lightHitRadiusPx(l.kind) / k()) return l
    }
    return null
  }

  const isFan = (c: LineCarrier): c is ExhaustFan => !("kind" in c)

  const carries = (c: LineCarrier): boolean => isFan(c) || canCarryLine(c)

  // видимые метки с точкой привязки (центр носителя) и именем — для попадания по тексту
  const anchors = (): { at: Point; name: string; line: LightLine }[] =>
    visibleLines(host.lines(), host.lights(), exhausts()).map(({ line, light }) => ({ at: { x: light.x, y: light.y }, name: line.name, line }))

  const carrierById = (id: string): LineCarrier | undefined => exhausts().find((f) => f.id === id) ?? host.lights().find((l) => l.id === id)

  const labelAt = (p: Point): LightLine | null => lineLabelAt(p, anchors(), host.view(), host.unitsPerMm)?.line ?? null

  return {
    place(p) {
      const carrier = carrierAt(p)
      if (!carrier || !carries(carrier)) return false
      return commit(setLine(host.lines(), carrier.id, host.newName(), host.newId))
    },
    hoverTarget(p) {
      const carrier = carrierAt(p)
      return carrier && carries(carrier) ? carrier.id : null
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
    setLineOf(carrierId, n) {
      const carrier = carrierById(carrierId)
      if (!carrier || !carries(carrier)) return false
      return commit(setLine(host.lines(), carrier.id, lineLabel(n), host.newId))
    },
    canCarry(carrierId) {
      const carrier = carrierById(carrierId)
      return carrier !== undefined && carries(carrier)
    },
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
