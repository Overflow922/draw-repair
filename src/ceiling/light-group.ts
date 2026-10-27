import { groupButtonActive, groupButtonClick, groupPick } from "../doorway/openings-group"
import type { GroupState } from "../doorway/openings-group"
import type { LightKind } from "../types"

// Группа «Освещение» на панели инструментов плана «Потолки и освещение» (change add-ceiling-lighting, design D7): те же
// переходы кнопки группы и панели, что у групп «Проёмы» и «Коммуникации», для пяти видов освещения. Инструмент плана —
// один («light»), вид ставимого объекта — текущий инструмент группы.

export type LightGroupState = GroupState<LightKind>

export const LIGHT_GROUP_DEFAULT: LightKind = "spot"

// постановка, в отличие от группы «Коммуникации», состояние группы не меняет: серия постановок (spec canvas-app «Панель группы
// «Освещение»»)
export { groupButtonActive, groupButtonClick, groupPick }
