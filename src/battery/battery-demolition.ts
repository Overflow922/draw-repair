import type { Battery, BatteryMark, Point, Wall } from "../types"
import { hitBattery } from "./battery-pick"

// Снос батареи (change add-battery, design D8; spec demolition-plan «Снос батареи»): пометка целиком со ссылкой на батарею.
// Входы не мутируются; если операция ничего не изменила, возвращается тот же массив — по нему решают, писать ли шаг истории.

// пометить батарею; уже помеченная остаётся с одной пометкой
export function addBatteryMark(marks: BatteryMark[], batteryId: string, id: string): BatteryMark[] {
  return marks.some((m) => m.batteryId === batteryId) ? marks : [...marks, { id, batteryId }]
}

// снять пометку по идентификатору; нет такой — без изменений
export function removeBatteryMark(marks: BatteryMark[], id: string): BatteryMark[] {
  return marks.some((m) => m.id === id) ? marks.filter((m) => m.id !== id) : marks
}

// помеченные батареи в порядке списка батарей; пометки на отсутствующие батареи вида не дают
export function demolishedBatteries(marks: readonly BatteryMark[], batteries: readonly Battery[]): Battery[] {
  const marked = new Set(marks.map((m) => m.batteryId))
  return batteries.filter((b) => marked.has(b.id))
}

// пометка помеченной батареи, в прямоугольнике которой (с радиусом tolCm) находится точка
export function batteryMarkAt(p: Point, marks: readonly BatteryMark[], batteries: readonly Battery[], walls: readonly Wall[], tolCm: number): BatteryMark | null {
  const hit = hitBattery(p, walls, demolishedBatteries(marks, batteries), tolCm)
  return hit ? (marks.find((m) => m.batteryId === hit.id) ?? null) : null
}

// пометки на существующие батареи
export const liveBatteryMarks = (marks: readonly BatteryMark[], batteries: readonly Battery[]): BatteryMark[] => {
  const ids = new Set(batteries.map((b) => b.id))
  return marks.filter((m) => ids.has(m.batteryId))
}
