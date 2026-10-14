import type { Scene } from "../history"
import type { Battery, Communication, Point, Wall, WallElement } from "../types"
import { createBatteryTool } from "./battery-tool"
import type { BatteryToolAdapter, BatteryToolHost } from "./battery-tool"

// change fix-battery-centering-and-numbers: хост адаптера «Батарея» для тестов — списки чертежа в памяти, радиусы задаются
// отдельно (радиус попадания и радиус центровки независимы, design D1).

export interface HostOptions {
  walls: Wall[]
  batteries?: Battery[]
  elements?: WallElement[]
  communications?: Communication[]
  radiusCm?: number // попадание и поиск стены под курсором
  centerRadiusCm?: number // центровка по окну
  zoom?: number
}

export interface HostHandle {
  tool: BatteryToolAdapter
  batteries(): readonly Battery[]
  selected(): readonly Battery[]
}

export function batteryToolOf(o: HostOptions): HostHandle {
  let batteries = [...(o.batteries ?? [])]
  let selected: Battery[] = []
  const scene = (): Scene => ({ walls: o.walls, dimensions: [], doorways: o.elements ?? [], communications: [...(o.communications ?? [])], batteries: [...batteries] })
  const host: BatteryToolHost = {
    walls: () => o.walls,
    batteries: () => batteries,
    communications: () => o.communications ?? [],
    elements: () => o.elements ?? [],
    selectedBatteries: () => selected,
    editable: () => true,
    view: () => ({ zoom: o.zoom ?? 1, pan: { x: 0, y: 0 } }),
    unit: () => "cm",
    radiusCm: () => o.radiusCm ?? 6,
    centerRadiusCm: () => o.centerRadiusCm ?? 17.5,
    formatCm: (cm) => String(cm),
    parseCm: (text) => parseFloat(text),
    editorParent: { append: () => {} } as unknown as HTMLElement,
    snapshot: scene,
    record: () => {},
    recordSnapshot: () => {},
    recordNudge: () => {},
    add: (b) => {
      batteries = [...batteries, b]
    },
    replace: (prev, next) => {
      batteries = batteries.map((b) => (b === prev ? next : b))
      selected = selected.map((b) => (b === prev ? next : b))
    },
    select: (b) => {
      selected = [b]
    },
    changed: () => {},
    redraw: () => {},
  }
  return { tool: createBatteryTool(host), batteries: () => batteries, selected: () => selected }
}

export type { Point }
