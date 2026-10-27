import type { LightFixture, LightLine, SwitchingContent } from "../types"

// Метки линий освещения плана «Группы включения» (change add-light-lines, design D1–D3): имя вида «L3» и правки списка меток.
// Чистые функции, входы не мутируются; при отсутствии изменений возвращается тот же массив.

const NAME = /^L[1-9]\d*$/
const INPUT = /^[Ll]?([1-9]\d*)$/

// каноническое имя из числа: 3 → «L3»
export const lineLabel = (n: number): string => "L" + String(n)

// имя в хранимом виде «L<n>», n — целое больше нуля (при загрузке допускается только оно)
export const isLineName = (v: unknown): v is string => typeof v === "string" && NAME.test(v)

// ввод пользователя «3», «L3», «l3» (пробелы по краям игнорируются) → «L3»; иначе null
export function parseLineName(text: string): string | null {
  const digits = INPUT.exec(text.trim())?.[1]
  return digits === undefined ? null : "L" + digits
}

// число линии из имени «L3» → 3 (для поля панели)
export const lineNumber = (name: string): number => Number(name.slice(1))

// датчик пожарной сигнализации не коммутируется выключателем — метку не несёт (design D3)
export const canCarryLine = (light: LightFixture): boolean => light.kind !== "smoke-detector"

// у светильника одна метка: есть — меняется имя (id и место в порядке сохраняются), нет — добавляется в конец
export function setLine(lines: LightLine[], targetId: string, name: string, newId: () => string): LightLine[] {
  const existing = lines.find((l) => l.targetId === targetId)
  if (!existing) return [...lines, { id: newId(), targetId, name }]
  if (existing.name === name) return lines
  return lines.map((l) => (l.targetId === targetId ? { ...l, name } : l))
}

// смена имени метки по её id (правка в панели и на месте)
export function renameLine(lines: LightLine[], id: string, name: string): LightLine[] {
  const existing = lines.find((l) => l.id === id)
  if (!existing || existing.name === name) return lines
  return lines.map((l) => (l.id === id ? { ...l, name } : l))
}

export function removeLine(lines: LightLine[], id: string): LightLine[] {
  return lines.some((l) => l.id === id) ? lines.filter((l) => l.id !== id) : lines
}

// поле плана после правки меток: пустой список не пишется, остальные объекты плана сохраняются; поле, которое было бы пустым и не
// существовало, не появляется (undefined)
export function storedLines(prev: SwitchingContent | undefined, lines: LightLine[]): SwitchingContent | undefined {
  const { lines: _old, ...rest } = prev ?? {}
  if (lines.length === 0) return prev === undefined ? undefined : rest
  return { lines, ...rest }
}

export interface VisibleLine {
  line: LightLine
  light: LightFixture
}

// метки существующих светильников; метка светильника, которого нет, хранится, но не показывается
export function visibleLines(lines: readonly LightLine[], lights: readonly LightFixture[]): VisibleLine[] {
  return lines.flatMap((line) => {
    const light = lights.find((l) => l.id === line.targetId)
    return light ? [{ line, light }] : []
  })
}
