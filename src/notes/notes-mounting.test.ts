import { describe, expect, it } from "vitest"
import { drawing, wall } from "../mounting/mounting.test-utils"
import { openWorkspace, storedContent } from "../mounting/mounting-workspace"

// change add-plan-notes: запись рабочего набора «Монтажа» в чертёж не теряет примечания плана (design D1).

describe("storedContent и примечания «Монтажа»", () => {
  it("примечания, записанные в содержимом «Монтажа», сохраняются при записи рабочего набора", () => {
    const d = drawing({ walls: [wall("A", 0, 0, 300, 0)], mounting: { walls: [wall("M", 0, 100, 300, 100)], dimensions: [], notes: ["а", "б"] } })
    const { scene, workspace } = openWorkspace(d)
    expect(storedContent(scene, workspace, d).notes).toEqual(["а", "б"])
  })

  it("без примечаний поле не появляется", () => {
    const d = drawing({ walls: [wall("A", 0, 0, 300, 0)], mounting: { walls: [wall("M", 0, 100, 300, 100)], dimensions: [] } })
    const { scene, workspace } = openWorkspace(d)
    expect("notes" in storedContent(scene, workspace, d)).toBe(false)
  })

  it("пустой список примечаний, записанный в чертёж, остаётся пустым списком", () => {
    const d = drawing({ walls: [wall("A", 0, 0, 300, 0)], mounting: { walls: [], dimensions: [], notes: [] } })
    const { scene, workspace } = openWorkspace(d)
    expect(storedContent(scene, workspace, d).notes).toEqual([])
  })
})
