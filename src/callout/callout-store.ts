import type { PlanId } from "../plans"
import type { Callout, Drawing } from "../types"

// Выноски по планам (change add-callout, design D1, D2): единственное место, знающее, где какой план хранит свой список

export const calloutsOf = (drawing: Drawing, plan: PlanId): Callout[] => {
  if (plan === "measure") return drawing.callouts ?? []
  if (plan === "demolition") return drawing.demolitionCallouts ?? []
  if (plan === "rough") return drawing.roughCallouts ?? []
  return drawing.mounting?.callouts ?? []
}

// новый чертёж с заменённым списком выносок плана; остальные поля и списки других планов те же
export function withCallouts(drawing: Drawing, plan: PlanId, list: Callout[]): Drawing {
  if (plan === "measure") return { ...drawing, callouts: list }
  if (plan === "demolition") return { ...drawing, demolitionCallouts: list }
  if (plan === "rough") return { ...drawing, roughCallouts: list }
  const mounting = drawing.mounting ?? { walls: [], dimensions: [] }
  return { ...drawing, mounting: { ...mounting, callouts: list } }
}
