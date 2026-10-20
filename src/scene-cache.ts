import type { Wall } from "./types"

// Кэш геометрии уровня сцены (change render-pan-perf, design D1).
// Сцена опознаётся по значениям стен (концы, толщина, тип, порядок), а не по ссылке: массив и сами стены
// правятся на месте. Поэтому кэш не может разойтись с данными: изменилось значение — результат считается заново.
// Результаты копируются и замораживаются: общий результат нельзя испортить записью.

const MAX_SCENES = 3 // сцена, сцена с превью и запас на чередование
const WALL_FIELDS = 5

interface SceneEntry {
  readonly coords: Float64Array // ax, ay, bx, by, толщина — по стене
  readonly types: readonly string[]
}

interface Slot<T> {
  readonly coords: Float64Array // значения самой стены запроса; для запроса по сцене пусто
  readonly type: string
  readonly result: T
}

let scenes: SceneEntry[] = []

function writeWall(coords: Float64Array, at: number, w: Wall): void {
  coords[at] = w.a.x
  coords[at + 1] = w.a.y
  coords[at + 2] = w.b.x
  coords[at + 3] = w.b.y
  coords[at + 4] = w.thicknessCm
}

function sameWall(coords: Float64Array, at: number, w: Wall): boolean {
  return (
    coords[at] === w.a.x && coords[at + 1] === w.a.y && coords[at + 2] === w.b.x && coords[at + 3] === w.b.y && coords[at + 4] === w.thicknessCm
  )
}

function matches(entry: SceneEntry, walls: readonly Wall[]): boolean {
  if (entry.types.length !== walls.length) return false
  for (let i = 0; i < walls.length; i++) {
    if (entry.types[i] !== walls[i].type || !sameWall(entry.coords, i * WALL_FIELDS, walls[i])) return false
  }
  return true
}

function capture(walls: readonly Wall[]): SceneEntry {
  const coords = new Float64Array(walls.length * WALL_FIELDS)
  walls.forEach((w, i) => writeWall(coords, i * WALL_FIELDS, w))
  return { coords, types: walls.map((w) => w.type) }
}

function sceneFor(walls: readonly Wall[]): SceneEntry {
  const found = scenes.findIndex((e) => matches(e, walls))
  if (found >= 0) {
    const [entry] = scenes.splice(found, 1)
    scenes.unshift(entry)
    return entry
  }
  const entry = capture(walls)
  scenes = [entry, ...scenes].slice(0, MAX_SCENES)
  return entry
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

export type SceneMemo<T> = (walls: readonly Wall[], wall: Wall | null, compute: () => T) => T

// Память одного вида вычислений: результат на (сцена, стена); wall = null — результат по всей сцене.
// Стена запроса сверяется по значениям: она может быть вне массива (превью) и меняться на месте.
export function sceneMemo<T>(): SceneMemo<T> {
  const store = new WeakMap<SceneEntry, Map<Wall | null, Slot<T>>>()
  return (walls, wall, compute) => {
    const scene = sceneFor(walls)
    let slots = store.get(scene)
    if (!slots) {
      slots = new Map()
      store.set(scene, slots)
    }
    const slot = slots.get(wall)
    if (slot && (wall === null || (sameWall(slot.coords, 0, wall) && slot.type === wall.type))) return slot.result
    const coords = new Float64Array(wall ? WALL_FIELDS : 0)
    if (wall) writeWall(coords, 0, wall)
    // копия: результат может ссылаться на точки живых стен, их замораживать нельзя
    const result = deepFreeze(structuredClone(compute()))
    slots.set(wall, { coords, type: wall?.type ?? "", result })
    return result
  }
}

// сброс накопленного (проверки и смена документа)
export function clearSceneCache(): void {
  scenes = []
}
