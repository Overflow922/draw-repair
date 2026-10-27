## 1. Связь по имени (чистая логика)

- [x] 1.1 `src/switching/line-links.ts`: `linkedObjects` по design D1; тесты по сценариям `line-highlight` (выключатель, светильник, метка, без метки, датчик, линии нет на плане, скрытая метка)
- [x] 1.2 `lineTool.setLineOf(carrierId, n)` и `canCarry(carrierId)` в `light-line-tool.ts` (`setLine`, префикс по виду носителя, датчик не несёт метку); тесты: постановка, смена, то же имя без шага, датчик

## 2. Подсветка в рендере

- [x] 2.1 `CeilingView.linkedLightIds` и кольцо `palette.selection` в `ceiling-render.ts`; тест рендера
- [x] 2.2 `SwitchingView.linkedExhaustIds / linkedLineIds / linkedSwitchIds` в `switching-render.ts` (порядок: erasing → selected → linked); тест рендера; проверка, что PDF подсветку не получает

## 3. Панель «Линия освещения» у выделенного светильника или вытяжки

- [x] 3.1 `main.ts`: выделение светильника/вытяжки открывает панель, поле пустое без метки, снятие выделения закрывает; `change` ставит метку одним шагом истории, значение для новых меток не меняется; датчик панель не открывает
- [x] 3.2 `main.ts`: передать `linked*` в `SwitchingView` по единственному выделению (design D4)

## 4. Проверка

- [x] 4.1 Ручная проверка в браузере: сценарии `line-highlight` и `light-lines` (память: подмена чертежа в localStorage, перезапуск dev-сервера)
- [x] 4.2 Формат, lint (в проекте их нет), typecheck, весь набор тестов (`--exclude ".claude/**" --exclude "node_modules/**"`), `openspec validate`, обзор diff
- [x] 4.3 Дописать в `TODO.md` оставленное (например, `main.ts`-связка без автотеста), если появится
