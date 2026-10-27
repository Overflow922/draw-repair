import type { ExhaustFan, LightFixture, LightLine, LightSwitch } from "../types"
import { visibleLines } from "./light-lines"

// Связь выделенного объекта с остальными по имени линии (change line-edit-and-highlight, design D1): чистая функция, данные плана
// не меняются и не хранятся. Подсвечиваются только показанные метки (см. visibleLines); сам выделенный объект в результат не входит.

export type LinkSelection = { kind: "switch"; id: string } | { kind: "carrier"; id: string } | { kind: "label"; id: string }

export interface LinkedObjects {
  carrierIds: ReadonlySet<string> // светильники и вытяжки (идентификаторы уникальны во всех списках чертежа)
  lineIds: ReadonlySet<string> // метки этих носителей
  switchIds: ReadonlySet<string>
}

const NONE: LinkedObjects = { carrierIds: new Set(), lineIds: new Set(), switchIds: new Set() }

export function linkedObjects(
  selection: LinkSelection | null,
  lines: readonly LightLine[],
  switches: readonly LightSwitch[],
  lights: readonly LightFixture[],
  exhausts: readonly ExhaustFan[],
): LinkedObjects {
  if (!selection) return NONE
  const shown = visibleLines(lines, lights, exhausts)

  const selectedSwitch = selection.kind === "switch" ? switches.find((s) => s.id === selection.id) : undefined
  const selectedLine = shown.find((v) => (selection.kind === "label" ? v.line.id === selection.id : v.light.id === selection.id))
  const names = new Set<string>(selectedSwitch ? selectedSwitch.keys.flatMap((k) => k.lines) : selectedLine ? [selectedLine.line.name] : [])
  if (names.size === 0) return NONE

  const others = shown.filter((v) => names.has(v.line.name) && v.line.id !== selectedLine?.line.id)
  return {
    carrierIds: new Set(others.map((v) => v.light.id)),
    lineIds: new Set(others.map((v) => v.line.id)),
    switchIds: selectedSwitch ? new Set() : new Set(switches.filter((s) => s.keys.some((k) => k.lines.some((n) => names.has(n)))).map((s) => s.id)),
  }
}
