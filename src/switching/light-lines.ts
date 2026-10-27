import type { ExhaustFan, LightFixture, LightLine, SwitchingContent } from "../types"

// Метки линий освещения плана «Группы включения» (change add-light-lines, design D1–D3): имя вида «L3» и правки списка меток.
// Чистые функции, входы не мутируются; при отсутствии изменений возвращается тот же массив.

const NAME = /^(?:L|LV)[1-9]\d*$/

// префикс имени: у светильника «L», у вытяжки (change add-exhaust-fan, design D2) «LV»
export type LinePrefix = "L" | "LV"

// каноническое имя из числа: 3 → «L3», с префиксом «LV» → «LV3»
export const lineLabel = (n: number, prefix: LinePrefix = "L"): string => prefix + String(n)

// имя в хранимом виде «L<n>» или «LV<n>», n — целое больше нуля (при загрузке допускается только оно)
export const isLineName = (v: unknown): v is string => typeof v === "string" && NAME.test(v)

// ввод пользователя «3», «L3», «l3» (для «LV» — «3», «LV3», «lv3»; пробелы по краям игнорируются) → «L3»; иначе null
export function parseLineName(text: string, prefix: LinePrefix = "L"): string | null {
  const t = text.trim().toUpperCase()
  const digits = t.startsWith(prefix) ? t.slice(prefix.length) : t
  return /^[1-9]\d*$/.test(digits) ? prefix + digits : null
}

// число линии из имени «L3» или «LV3» → 3 (для поля панели)
export const lineNumber = (name: string): number => Number(name.replace(/^[A-Z]+/, ""))

// префикс имени метки
export const prefixOfName = (name: string): LinePrefix => (name.startsWith("LV") ? "LV" : "L")

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

// носитель метки: светильник или вытяжка (идентификаторы уникальны во всех списках чертежа)
export type LineCarrier = LightFixture | ExhaustFan

export interface VisibleLine {
  line: LightLine
  light: LineCarrier
}

// метки существующих носителей; метка носителя, которого нет, и метка с именем не по виду носителя хранятся, но не показываются
export function visibleLines(lines: readonly LightLine[], lights: readonly LightFixture[], exhausts: readonly ExhaustFan[] = []): VisibleLine[] {
  return lines.flatMap((line) => {
    const light = lights.find((l) => l.id === line.targetId)
    if (light) return prefixOfName(line.name) === "L" ? [{ line, light }] : []
    const fan = exhausts.find((f) => f.id === line.targetId)
    return fan && prefixOfName(line.name) === "LV" ? [{ line, light: fan }] : []
  })
}
