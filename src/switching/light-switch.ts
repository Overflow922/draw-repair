import type { LightSwitch, Point, SwitchingContent } from "../types"

// Выключатель плана «Группы включения» (change add-light-switch, design D1–D2): имена линий клавиш и правки списка выключателей.
// Чистые функции, входы не мутируются; при отсутствии изменений возвращается тот же массив.

export const MAX_KEYS = 6

const KEY_NAME = /^(?:L|LV)[1-9]\d*$/

// имя в клавише: «L<n>» или «LV<n>», n — целое больше нуля (при загрузке допускается только оно)
export const isKeyLineName = (v: unknown): v is string => typeof v === "string" && KEY_NAME.test(v)

// допустимое число клавиш: целое от 1 до 6
export const isKeyCount = (n: number): boolean => Number.isInteger(n) && n >= 1 && n <= MAX_KEYS

// ввод поля «Клавиш»: целое от 1 до 6 (пробелы по краям игнорируются); иначе null — прежнее значение остаётся
export function parseKeyCount(text: string): number | null {
  const t = text.trim()
  return /^\d+$/.test(t) && isKeyCount(Number(t)) ? Number(t) : null
}

// ввод «L2,LV1», «l2, lv1», «L2;LV1» → имена в верхнем регистре без повторов в порядке ввода; пустая строка — пустой список;
// любой недопустимый токен — null (ввод не применяется целиком)
export function parseKeyLines(text: string): string[] | null {
  if (text.trim() === "") return []
  const names: string[] = []
  for (const token of text.split(/[,;]/)) {
    const name = token.trim().toUpperCase()
    if (!KEY_NAME.test(name)) return null
    if (!names.includes(name)) names.push(name)
  }
  return names
}

// подпись клавиши: имена через запятую без пробелов; у клавиши без линий — пустая строка
export const keyLabel = (lines: readonly string[]): string => lines.join(",")

// положение выключателя на грани: центр блока и угол наружной нормали в градусах
export interface SwitchPlacement {
  at: Point
  angle: number
}

export const newSwitch = (id: string, place: SwitchPlacement, keyCount: number): LightSwitch => ({
  id,
  at: place.at,
  angle: place.angle,
  keys: Array.from({ length: keyCount }, () => ({ lines: [] })),
})

export const addSwitch = (switches: LightSwitch[], s: LightSwitch): LightSwitch[] => [...switches, s]

const sameLines = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((n, i) => n === b[i])

export function setKeyLines(switches: LightSwitch[], id: string, keyIndex: number, lines: string[]): LightSwitch[] {
  const target = switches.find((s) => s.id === id)
  const key = target?.keys[keyIndex]
  if (!target || !key || sameLines(key.lines, lines)) return switches
  return switches.map((s) => (s.id === id ? { ...s, keys: s.keys.map((k, i) => (i === keyIndex ? { lines } : k)) } : s))
}

// уменьшение отбрасывает последние клавиши вместе с их линиями, увеличение добавляет пустые в конец
export function setKeyCount(switches: LightSwitch[], id: string, count: number): LightSwitch[] {
  const target = switches.find((s) => s.id === id)
  if (!target || !isKeyCount(count) || target.keys.length === count) return switches
  const keys = Array.from({ length: count }, (_, i) => target.keys[i] ?? { lines: [] })
  return switches.map((s) => (s.id === id ? { ...s, keys } : s))
}

export function moveSwitch(switches: LightSwitch[], id: string, place: SwitchPlacement): LightSwitch[] {
  const target = switches.find((s) => s.id === id)
  if (!target || (target.at.x === place.at.x && target.at.y === place.at.y && target.angle === place.angle)) return switches
  return switches.map((s) => (s.id === id ? { ...s, at: place.at, angle: place.angle } : s))
}

export const removeSwitch = (switches: LightSwitch[], id: string): LightSwitch[] =>
  switches.some((s) => s.id === id) ? switches.filter((s) => s.id !== id) : switches

// поле плана после правки выключателей: пустой список не пишется, остальные объекты плана сохраняются; поле, которое было бы
// пустым и не существовало, не появляется (undefined)
export function storedSwitches(prev: SwitchingContent | undefined, switches: LightSwitch[]): SwitchingContent | undefined {
  const { switches: _old, ...rest } = prev ?? {}
  if (switches.length === 0) return prev === undefined ? undefined : rest
  return { ...rest, switches }
}
