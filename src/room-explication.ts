import { AREA_EPS, EXPLICATION_MIN_AREA_CM2 } from "./room-area"
import type { Room } from "./room-area"
import type { RoomRecord } from "./types"
import { pointInPolygon } from "./wall-geometry"

// Экспликация помещений (change add-room-explication, design D1–D3, D7): помещения вычисляются по стенам, пользовательские
// данные (номер, название, высота) хранятся записями с опорной точкой внутри помещения. Чистые функции без DOM.

export const DEFAULT_ROOM_NAME = "Комната"
export const DEFAULT_ROOM_HEIGHT_MM = 3000
export const MAX_ROOM_HEIGHT_MM = 99999

// помещение экспликации вместе с данными, привязанными к нему
export interface ExplicatedRoom {
  room: Room
  record: RoomRecord
}

const inRoom = (p: RoomRecord["anchor"], room: Room): boolean =>
  pointInPolygon(p, room.outline) && !room.holes.some((h) => pointInPolygon(p, h))

// порядок новых помещений детерминирован: по точке подписи сверху вниз, затем слева направо
const byLabel = (a: Room, b: Room): number => a.labelAt.y - b.labelAt.y || a.labelAt.x - b.labelAt.x

const smallestFree = (taken: ReadonlySet<number>): number => {
  let n = 1
  while (taken.has(n)) n++
  return n
}

// Привязка записей к помещениям экспликации (spec room-explication «Привязка данных к помещению»):
//  - записью владеет помещение, в контуре которого (вне островов) лежит её опорная точка; из нескольких записей в одном
//    помещении остаётся запись с меньшим номером, остальные пропадают вместе с номерами;
//  - запись исчезнувшего помещения пропадает, номер освобождается;
//  - помещение без записи получает наименьший свободный номер, название «» (выводится «Комната») и высоту по умолчанию;
//  - опорная точка уцелевшей записи обновляется на точку подписи помещения.
// Помещения меньше порога экспликации не участвуют. Результат — по возрастанию номера; входные данные не меняются.
export function reconcileRooms(rooms: readonly Room[], records: readonly RoomRecord[]): ExplicatedRoom[] {
  const eligible = rooms.filter((r) => r.areaCm2 >= EXPLICATION_MIN_AREA_CM2 - AREA_EPS).sort(byLabel)
  const owned = eligible.map((room) => {
    const mine = records.filter((r) => inRoom(r.anchor, room))
    return mine.length === 0 ? null : mine.reduce((a, b) => (b.number < a.number ? b : a))
  })
  const taken = new Set(owned.flatMap((r) => (r ? [r.number] : [])))
  const result = eligible.map((room, i): ExplicatedRoom => {
    const own = owned[i]
    if (own) return { room, record: { number: own.number, name: own.name, heightMm: own.heightMm, anchor: { ...room.labelAt } } }
    const number = smallestFree(taken)
    taken.add(number)
    return { room, record: { number, name: "", heightMm: DEFAULT_ROOM_HEIGHT_MM, anchor: { ...room.labelAt } } }
  })
  return result.sort((a, b) => a.record.number - b.record.number)
}

// название для показа: пустое (после обрезки пробелов) — «Комната»
export const displayName = (record: RoomRecord): string => record.name.trim() || DEFAULT_ROOM_NAME

// «H=3000»: целые миллиметры
export const formatRoomHeight = (heightMm: number): string => `H=${heightMm}`

// высота из поля ввода: целое число миллиметров 1–99999, иначе null (ввод не применяется)
export function parseRoomHeight(text: string): number | null {
  const t = text.trim()
  if (!/^\d+$/.test(t)) return null
  const n = Number(t)
  return n >= 1 && n <= MAX_ROOM_HEIGHT_MM ? n : null
}

// площадь таблицы экспликации: м² с одним знаком и запятой («10,8»); для сумм берётся точное значение в см²
export function formatExplicationArea(areaCm2: number): string {
  const tenths = Math.round(areaCm2 / 1000)
  return `${Math.floor(tenths / 10)},${tenths % 10}`
}

// строки таблицы экспликации и суммарная площадь по точным площадям помещений
export interface ExplicationTable {
  rows: { number: string; name: string; area: string }[]
  total: string
}

export function explicationTable(items: readonly ExplicatedRoom[]): ExplicationTable {
  const sorted = [...items].sort((a, b) => a.record.number - b.record.number)
  return {
    rows: sorted.map((i) => ({ number: String(i.record.number), name: displayName(i.record), area: formatExplicationArea(i.room.areaCm2) })),
    total: formatExplicationArea(sorted.reduce((s, i) => s + i.room.areaCm2, 0)),
  }
}
