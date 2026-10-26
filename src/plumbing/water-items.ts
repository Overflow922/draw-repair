import { kindEntry } from "../furniture/furniture-kinds"
import type { FurnitureKind } from "../furniture/furniture-kinds"
import type { FurnitureItem } from "../types"

// Приборы плана «Сантехника» (change add-plumbing-plan, design D2): предметы «Мебели», чей вид в каталоге помечен как
// подключаемый к воде. Чистые функции, входы не мутируются.

export const isWaterKind = (kind: FurnitureKind): boolean => kindEntry(kind).water === true

export const waterItems = (items: readonly FurnitureItem[]): FurnitureItem[] => items.filter((t) => isWaterKind(t.kind))
