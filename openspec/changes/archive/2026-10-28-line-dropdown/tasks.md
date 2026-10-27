## 1. Тесты по спеке

- [x] 1.1 `src/switching/line-menu.test.ts`: `lineMenu` — пункты `L1`–`L10` без групп, дополнительный пункт для имени вне списка (`L12`, `LV1` из старого чертежа), недоступный «—» без имени
- [x] 1.2 `src/switching/light-switch.test.ts` и `switch-tool.test.ts`: `newSwitch` с линией; `switchLineField` — одна линия, без линии, несколько клавиш и несколько линий (недоступно); постановка с линией из панели; `setSelectedLine` — один шаг, та же линия без шага, не для нескольких клавиш
- [x] 1.3 `src/ceiling/light-tool.test.ts`: постановка светильника сообщает хосту о поставленном светильнике (метка ставится вызывающим); при отказе не вызывается
- [x] 1.4 `src/switching/exhaust-tool.test.ts`: постановка вытяжки ставит метку `L<n>` текущей линии в том же шаге истории
- [x] 1.5 `src/switching/light-line-panel.test.ts` и `light-switch-panel.test.ts`: в панелях меню «Линия» (`<select>`), других полей нет

## 2. Реализация

- [x] 2.1 `src/switching/line-menu.ts`: чистая функция пунктов меню
- [x] 2.2 `src/switching/light-switch.ts`, `switch-tool.ts`: `newSwitch` принимает имя линии; `keyLines()` заменён на `keyLine()`; `setSelectedLines` — на `setSelectedLine`; `switchLineField` — по D5
- [x] 2.3 `src/ceiling/light-tool.ts`: обратный вызов постановки; `src/switching/exhaust-tool.ts`: метка вытяжки в том же шаге
- [x] 2.4 `index.html`, `src/style.css`, `src/main.ts`: поля `#light-line-number` и `#light-switch-line` — `<select>`; одно значение `lineNumberCurrent`; метка светильника при постановке; показ линии выделенного; обработчики `change`

## 3. Проверка

- [x] 3.1 Typecheck, полный прогон тестов (`--exclude ".claude/**" --exclude "node_modules/**"`), `openspec validate line-dropdown`
- [x] 3.2 Проверка в браузере: поставить светильник, вытяжку и выключатель — у каждого сразу `L1`; выбрать в меню `L3` и поставить ещё; выделить объект и сменить линию; отмена постановки убирает объект с линией; выделить светильник — подсвечен только выключатель той же линии

