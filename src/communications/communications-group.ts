import { groupButtonActive, groupButtonClick, groupPick } from "../doorway/openings-group"
import type { GroupState as GenericGroupState } from "../doorway/openings-group"

// Группа «Коммуникации» на панели инструментов обмерочного плана (change add-communications, design D9): те же
// переходы состояния кнопки группы и её панели, что у группы «Проёмы», для инструментов «Стояк» и «Воздуховод».

export type CommunicationTool = "riser" | "duct"

export type GroupState = GenericGroupState<CommunicationTool>

export { groupButtonActive, groupButtonClick, groupPick }

// после установки коммуникации инструмент группы снимается и панель закрывается; текущий инструмент группы помнится
// (spec canvas-app «Панель группы «Коммуникации»»)
export const afterPlaceCommunication = (g: GroupState): GroupState => ({ current: g.current, active: "other", panelOpen: false })
