# Test change request — add-callout

Статус: ожидает решения (до начала задач 1–6 не требуется; нужен до задачи 7.2 и итогового прогона всего набора).

Правило 5 (`CLAUDE.md`): реализация не меняет одобренные тесты. Новое требование change `add-callout` (`canvas-app` «Кнопка «Выноска»», `drawing-plans` «Выноски — объекты плана») добавляет инструмент `callout` в `toolsOf` каждого плана, а Esc получает действие `cancel-callout-draft`. Это неизбежно ломает 13 одобренных тестов в четырёх файлах, потому что они проверяют точные наборы инструментов, и делает неисчерпывающим `switch` в вспомогательной функции пятого файла. Конфликты подтверждены прогоном всего набора с эталонной реализацией (`test-validation.md`, раунды 1–4): падают ровно эти 13 тестов и одна ошибка `tsc`, других нет.

## Почему тесты больше не представляют спецификацию

| Тест | Что проверяет сейчас | Почему устарело | Что нужно |
|---|---|---|---|
| `src/plan-tools.test.ts` PT-02 (строки 15–18) | `sorted(toolsOf("measure"))` равен набору без «callout» | `canvas-app` «Кнопка «Выноска»»: кнопка на обмере сразу после «Размера» | в ожидаемый набор добавить `"callout"` |
| `src/plan-tools.test.ts` PT-02 (строки 20–22) | `sorted(toolsOf("demolition"))` равен `["demolition","ruler","eraser"]` | то же для «Демонтажа» | `["demolition","callout","ruler","eraser"]` |
| `src/plan-tools.test.ts` PT-02 (строки 24–27) | пересечение наборов обмера и демонтажа — только «Линейка» и «Ластик» | теперь общий и «Выноска» | ожидаемое `["callout","ruler","eraser"]` (отсортированное) |
| `src/plan-tools.test.ts` SZ-70 (строки 33–36) | `toolsOf("demolition")` равен `["demolition","ruler","eraser"]` | то же | `["demolition","callout","ruler","eraser"]`; проверка инструмента по умолчанию прежняя |
| `src/plan-tools.test.ts` SZ-71 (строки 40–43) | точный набор обмера без «callout» (две проверки) | то же | оба ожидаемых списка с `"callout"` после `"dimension"` |
| `src/mounting-plans.test.ts` MP-51 (строки 40–43) | `toolsOf("mounting")` равен списку без «callout» и равен «обмер минус коммуникации» | то же для «Монтажа» | `["wall","doorway","door","window","battery","dimension","callout","ruler","eraser"]`; второе равенство остаётся верным |
| `src/mounting-plans.test.ts` MP-52 (строки 54–58) | `toolsOf("demolition")` равен `["demolition","ruler","eraser"]` | то же | `["demolition","callout","ruler","eraser"]`; остальные проверки теста прежние |
| `src/communications/plans.test.ts` DP-01 (строки 23–25) | точный порядок набора обмера без «callout» | то же | список с `"callout"` после `"dimension"` |
| `src/communications/plans.test.ts` DP-02 (строки 34–37) | набор «Монтажа» без «callout»; равенство «обмер без коммуникаций» | то же | список с `"callout"` после `"dimension"`; равенство остаётся верным |
| `src/communications/plans.test.ts` DP-03 (строки 39–44) | `toolsOf("demolition")` без «callout» | то же | `["demolition","callout","ruler","eraser"]`; проверки инструментов по умолчанию прежние |
| `src/battery/battery-tool.test.ts` B-TOOL-7 (строки 18–20) | `toolsOf("measure")` без «callout» | то же | список с `"callout"` после `"dimension"` |
| `src/battery/battery-tool.test.ts` B-TOOL-7b | `toolsOf("mounting")` без «callout» | то же | список с `"callout"` после `"dimension"` |
| `src/battery/battery-tool.test.ts` B-TOOL-7c | `toolsOf("demolition")` равен прежнему набору и без «battery» | то же | `["demolition","callout","ruler","eraser"]`; проверка отсутствия «battery» остаётся |
| `src/tool-mode.test.ts` `applyEscape` (строки 20–34) | исчерпывающий `switch` по `EscapeAction` без `"cancel-callout-draft"` | `tsc --noEmit`: TS2366 «Function lacks ending return statement» (vitest при этом проходит) | добавить `case "cancel-callout-draft": return { ...s, calloutDraft: false }`; поле `calloutDraft?: boolean` в `EscapeState` необязательное, остальные тесты файла не затрагиваются |

Новые ожидания уже зафиксированы новыми тестами: `src/callout/callout-tool.test.ts` (C-TOOL-1, 2, 3, 3b, 4, 5, 5b, 5c).

## Что менять и кто

Менять только перечисленные ожидания, ничего не ослабляя: смысл тестов (порядок и состав инструментов, пересечение наборов, исчерпывающий разбор действий Esc) сохраняется. Правка выполняется отдельным шагом после ответа пользователя, до задачи 7.2; после правки тесты проходят повторную проверку валидатором (`CLAUDE.md`, Rule 4–5) — достаточно проверить, что diff затрагивает только указанные ожидания, и прогнать весь набор.

## Решение

Принято пользователем (2026-10-14, на запрос в сессии `/opsx:apply`): править ровно перечисленные ожидания, смысл и силу проверок не менять. Выполнено в файлах `src/plan-tools.test.ts` (PT-02 ×3, SZ-70, SZ-71), `src/mounting-plans.test.ts` (MP-51, MP-52), `src/communications/plans.test.ts` (DP-01, DP-02, DP-03), `src/battery/battery-tool.test.ts` (B-TOOL-7, 7b, 7c) и `src/tool-mode.test.ts` (`applyEscape`): в ожидаемые наборы добавлен `"callout"` на указанное место, в `applyEscape` — один `case`. Других строк не затронуто.
