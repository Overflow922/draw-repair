import type { LightFixture, LightKind, Point } from "../types"

// Объекты освещения плана «Потолки и освещение» (change add-ceiling-lighting, design D1): каталог видов и правки списка.
// Центр — целые сантиметры. Чистые функции, входы не мутируются; при отсутствии изменений возвращается тот же массив.

export interface LightKindInfo {
  kind: LightKind
  title: string
}

// порядок каталога: панель группы «Освещение» и легенда PDF
export const LIGHT_KINDS: readonly LightKindInfo[] = [
  { kind: "spot", title: "Точечный встроенный светильник" },
  { kind: "smoke-detector", title: "Датчик пожарной сигнализации потолочный" },
  { kind: "chandelier", title: "Люстра" },
  { kind: "sconce", title: "Бра" },
  { kind: "lighting-outlet", title: "Электровывод для освещения" },
]

export const LIGHT_KIND_IDS: readonly LightKind[] = LIGHT_KINDS.map((k) => k.kind)

export const isLightKind = (v: unknown): v is LightKind => typeof v === "string" && (LIGHT_KIND_IDS as readonly string[]).includes(v)

export const lightTitle = (kind: LightKind): string => LIGHT_KINDS.find((k) => k.kind === kind)?.title ?? kind

// положение нового или сдвинутого объекта: центр и у бра — направление в помещение. Центр точки освещения округляется до целого
// сантиметра; центр бра — точка грани, уже округлённая вдоль грани прилипанием (light-reach snapSconce), берётся как есть
export interface LightPlacement {
  at: Point
  angleDeg?: number
}

const centerOf = (kind: LightKind, p: Point): Point => (kind === "sconce" ? { x: p.x, y: p.y } : { x: Math.round(p.x), y: Math.round(p.y) })

export function newLight(kind: LightKind, place: LightPlacement, id: string): LightFixture {
  const { x, y } = centerOf(kind, place.at)
  return kind === "sconce" ? { id, kind, x, y, angleDeg: place.angleDeg ?? 0 } : { id, kind, x, y }
}

export const addLight = (lights: readonly LightFixture[], light: LightFixture): LightFixture[] => [...lights, light]

export function moveLight(lights: LightFixture[], id: string, place: LightPlacement): LightFixture[] {
  const target = lights.find((l) => l.id === id)
  if (!target) return lights
  const { x, y } = centerOf(target.kind, place.at)
  const angleDeg = target.kind === "sconce" ? (place.angleDeg ?? target.angleDeg) : undefined
  if (target.x === x && target.y === y && (target.kind !== "sconce" || target.angleDeg === angleDeg)) return lights
  return lights.map((l): LightFixture => {
    if (l.id !== id) return l
    return l.kind === "sconce" ? { ...l, x, y, angleDeg: angleDeg ?? l.angleDeg } : { ...l, x, y }
  })
}

export function removeLight(lights: LightFixture[], id: string): LightFixture[] {
  return lights.some((l) => l.id === id) ? lights.filter((l) => l.id !== id) : lights
}

export const lightCenter = (l: LightFixture): Point => ({ x: l.x, y: l.y })
