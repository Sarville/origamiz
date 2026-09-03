# Достижения и система исследований — разбор легаси-модов и предложение

Источники: `mods/achievements.mod.js` (326 КБ, минифицирован) и
`mods/shapez-industries@1.1.6.js` (6.2 МБ, минифицирован). Оба — старые бандлы
модов под движок shapez.io (предок текущего движка), код не выполняется в
проекте, используются только как справочный материал. Ниже — результат
разбора минифицированного кода (через grep/regex по строкам, без выполнения).

**Юридическая заметка**: копировать код модов напрямую не планируется — ниже
описана логика/структура данных, а имплементация в CE будет с нуля на наших
сигналах (`root.signals`) и наших classes. Лицензии самих модов не проверялись,
т.к. это не требуется — переиспользуется только *идея*, не текст кода.

---

## Часть A. Система достижений

### A.1. Что внутри `achievements.mod.js`

Файл — это **два** мода в одном бандле:

1. **"Achievements Library" (framework)** — общий движок для ачивок:
   реестр `this.registry[modId] = { achievements: [...], init, disabled }`,
   HUD-стейт `AchievementsState`, всплывающее уведомление
   (`showAchievement`), кэширование прогресса при сериализации сейва.
   Хранит список выполненных ачивок в **глобальных настройках мода**
   (`this.settings.completedAchievements`, массив вида `"modId:achievId"`) —
   то есть ачивки *не* привязаны к конкретному сейву, они как в Steam:
   на уровне профиля игрока.
2. **"Achievements Patch" (контент)** — реализация оригинальных 65 ачивок
   Steam-версии shapez.io поверх библиотеки (для тех, у кого игра не из Steam).

Формат одной ачивки:
```js
{ id: "throughputBp25", name: "Efficiency 1",
  description: "Deliver 25 blueprints per second",
  icon: <dataURL из спрайт-атласа 64×64>,
  getProgress: root => ({ percentage, text }) // необязательно
}
```

Два вида ачивок:
- **С прогресс-баром** (`getProgress` считает текущее/нужное значение —
  плейтайм, пропускная способность, накопленные блюпринты и т.п.), значение
  пересчитывается на лету и **кэшируется в сейв** при сериализации.
- **Булевы** (без `getProgress`) — выполняются один раз по событию и
  записываются как `completed = true`.

Для булевых ачивок мод заводит один **сериализуемый объект статистики за
сейв** (`AchievementPatchModStats extends BasicSerializableObject`) со
счётчиками: `placedTrash, placedTunnel, destroyedBuilding, placedBelts,
placedBalancer, placedDoublePainter, purchasedUpgrade, placedWires,
placedBlueprints, storedItemsTotal, placedInverseRotator,
purchasedBeltUpgrade, trashedItems, longestBeltPath` — нужен, чтобы отвечать
на вопросы вида *"дошёл до уровня 12, ни разу не купив апгрейд"*.

**Триггеры** — событийные, не поллинг по кадрам. Примеры хуков:
- `root.signals.itemProduced` → проверка кода фигуры → `bird`, `notRocket`,
  `scissors`, `produceLogo`, `produceRocket`, `produceMsLogo`, `oldLevel17`,
  `rocketBeforeLogo` (сравнение по exact shape-коду).
- `root.signals.storyGoalCompleted(level)` → пороговые ачивки
  (`unlockWires` на 20, `completeLvl26` / `mam` / speedrun-ачивки на >26,
  `level50`, `level100`), и здесь же читаются флаги "за этот уровень ничего
  плохого не сделал" (нет трэша/апгрейдов/разрушений на 12-м, нет тоннелей на
  7-м, нет балансеров на 6-м, нет проводов на 27-м).
- `root.signals.entityManuallyPlaced` → выставление флагов
  (`placedTrash=true`, `placedBalancer=true` и т.д. — по `getMetaBuilding().getId()`
  и варианту).
- Патч метода `HubGoals.takeShapeByKey` (аналог нашего `root.signals`/метода
  расходования фигур) → счётчик потраченных блюпринтов → `place1mBps`.

Всё это **напрямую переносимо на наш движок без обёрток**: в
`src/js/game/root.js` уже есть ровно те же сигналы (`itemProduced`,
`storyGoalCompleted`, `entityManuallyPlaced`, `entityDestroyed`,
`upgradePurchased`, `gameSaved`) — мод в 2023 хукался через
`modInterface.runAfterMethod`, потому что не мог трогать движок; нам это не
нужно, подписка на сигнал — одна строчка.

### A.2. Полный список 65 ачивок (извлечён из бандла)

| Категория | Примеры | Кол-во |
|---|---|---|
| Плейтайм | `play1h`, `play10h`, `play20h` | 3 |
| Пропускная способность (шт/сек) | blueprints 25/50, logo 25/50, rocket 10/20 | 6 |
| Разовые действия | вырезать/повернуть/покрасить/сложить/сохранить фигуру, разместить блюпринт, открыть слой проводов, включить тёмную тему | 8 |
| Накопление ресурсов | 100k/1m блюпринтов в хабе, 200k фигур в хранилищах, 100 уникальных фигур, 10k конвейеров, 5000 проводов, 1000 в мусорку | 7 |
| Уровни/сюжет | `level50`, `level100`, `unlockWires`(20), `completeLvl26`(фриплей) | 4 |
| Апгрейды | все тир 5 / все тир 8, апгрейды белтов до 15 | 3 |
| Спидран | пройти 12-й уровень за 120/60/30 минут | 3 |
| Фриплей-челленджи | пустая фабрика после 26, уровень фриплея за 30/60/120 сек | 4 |
| Самоограничения ("без X до уровня Y") | без балансеров(6), без апгрейдов(12), без разрушений(12), без мусорки(12), без тоннелей(7), без проводов(27), без обратного поворота(14), без двойного покрасчика(20) | 8 |
| **Секретные** (описание "secret" пока не открыта) | пасхалки: произвести фигуру-птицу/ножницы/старое MS-лого, 500 плиток конвейера подряд, 15 маркеров на карте, стек 5-го слоя, фигура до её "официального" открытия, легаси-фигура старого 17-го уровня | 8+ |
| Прочее/уникальные механики | `mam` (Make Anything Machine — пройти уровень >26 без изменения фабрики) | 1 |

Полный id/название/описание — см. приложение в конце файла.

### A.3. Что берём как есть / адаптируем / выбрасываем

- **Берём как есть (архитектурно)**: событийная модель триггеров,
  разделение "прогресс-бар" vs "булево", отдельный сериализуемый объект
  статистики за сейв для "без X" ачивок, хранение выполненных ачивок
  **глобально** (не в сейве) — иначе достижение "открой блюпринты" будет
  сбрасываться в новых играх.
- **Адаптируем**: у нас уже ровно те же 26 уровней и тот же набор построек
  (cutter/trash, balancer, rotator, tunnel, painter, mixer, stacker, storage,
  wires, filter, constant signal, display, logic gates, virtual processing,
  freeplay) — поэтому ~90% ачивок из списка переносятся 1:1 по порогам
  (например `unlockWires` = дошёл до 20 уровня, `completeLvl26` — как есть).
- **Выбрасываем/переосмысливаем**:
  - Ачивки, завязанные на конкретные легаси-фигуры прошлых версий
    (`oldLevel17`, `logoBefore18`, `produceMsLogo`) — это пасхалки про
    историю самого shapez.io, нам чужие; заменим на свои секретки.
  - Steam-специфичные формулировки не нужны, но сам факт "иконка + название +
    описание, некоторые скрыты" — да, это и просит пользователь.

### A.4. Предложение по нашей системе ачивок

Простая модель, как и просили — **список, без деревьев/тиров сложности**:

```ts
type Achievement = {
  id: string;
  name: string;
  description: string;       // если hidden=true и не выполнено — не показываем
  hidden?: boolean;           // "секретная" — не спойлерим условие
  icon: string;                // путь к PNG
  unlockedByLevel?: number;    // если задано — авто-триггер на storyGoalCompleted
  check: (root) => boolean;    // для остальных — событийная проверка
};
```

Предлагаемые категории для MVP (можно взять почти всё из §A.2 1-в-1, заменив
секретки на свои):
1. Прогресс по уровням (level10/20/26/50/100-эквивалент нашей шкалы).
2. Первые действия (первый блюпринт, первое хранилище, первая проводная
   схема, первый вырез/покраска/поворот).
3. Накопительные счётчики (конвейеры, провода, фигуры в хранилище).
4. Челленджи "без X" — используют статистику за сейв, сбрасываются с
   сейвом, но флаг выполнения — глобальный, навсегда.
5. Скрытые пасхалки — 5–8 штук под наши собственные фигуры/шутки (не
   переносим чужие).

### A.5. Хранение и интеграция в движок

- Новый глобальный стор рядом с `ApplicationSettings`
  (`src/js/profile/application_settings.js`) — по образцу мода: массив
  `unlockedAchievementIds` + счётчики, живущие **вне** сейва (глобальный
  профиль, не per-save). Не смешивать с `savegame.currentData.stats` — те
  живут только внутри одного сейва и нужны лишь для "без X"-условий текущей
  партии.
- Новый `GameState` `AchievementsState` — по образцу уже существующего
  `ShapeViewerToolState` (`src/js/states/shape_viewer_tool.js`): отдельный
  стейт, список ачивок гридом, скрытые — как заблокированные силуэты.
- **Точки входа в UI** (обе уже используют один и тот же паттерн
  `moveToStateAddGoBack`, см. `src/js/states/settings.js:181` для примера):
  1. Кнопка в `src/js/states/settings.js` — новый `categoryButton
     achievementsButton`, рядом с `manageMods`/`shapeViewerTool`.
  2. Кнопка на главном экране — в `src/js/states/main_menu.js` в блоке
     `.topButtons` (сейчас там `settingsButton` и `exitAppButton`) — добавить
     `achievementsButton` туда же, той же стилистики.
- **Иконка входа** (не самих 65 ачивок, а самой кнопки "Достижения" на
  главном экране/в настройках): нужна одна PNG в нашем ориgami-стиле,
  однозначно читаемая как "достижения" — кубок/пьедестал/медаль. Кладётся
  рядом с существующими `res/ui/icons/main_menu_settings.png` и
  `res/ui/icons/settings.png` (простые плоские PNG, не через атлас-пайплайн
  `res_raw/`). **Это отдельная задача на генерацию арта**, не блокирует
  остальную реализацию — оставляю как action item ниже.

---

## Часть B. Система исследований (research)

### B.1. Как устроено в Shapez Industries

Это отдельный "мета-слой" поверх обычного левел-апа. Ключевые куски кода
бандла (переменные восстановлены по контексту):

**Объект вариантов-под-исследование** (`Sw` в минификации) — плоский список,
без графа зависимостей, просто "к какому тиру относится":
```js
Sw = {
  balancerSmartMerger:  { building: Balancer, reward: reward_merger,        shape: "RbRbRb--",             tier: 1 },
  minerChainable:       { building: Miner,    reward: reward_miner_chainable, shape: "WbWbWbWb",           tier: 1 },
  quadCutter:           { building: Cutter,   reward: reward_cutter_quad,   shape: "Sb--Sb--",             tier: 1 },
  ccwRotator:           { building: Rotator,  reward: reward_rotator_ccw,   shape: "--SbSb--:--SbSb--",    tier: 1 },
  doublePainter:        { building: Painter,  reward: reward_painter_double,shape: "RbRbRbRb:...",         tier: 1 },
  balancerSmartSplitter:{ building: Balancer, reward: reward_splitter,      shape: "CcCcCc--:1b1b1b1b",    tier: 2 },
  tunnelTier2:          { building: Tunnel,   reward: reward_underground_belt_tier_2, shape: "4b4b4b4b:...", tier: 2 },
  rotator180:           { building: Rotator,  reward: reward_rotator_180,   shape: "6b6c6b6c:...",         tier: 2 },
  // + tier 3: quadStacker, cornerCrossing, lineCrossing, tunnelSmart,
  //   quadPainter, miniStorage, laserCutter, minerDeep — новые постройки,
  //   которых у нас пока нет
};
```

**Стоимость покупки одного варианта** — не индивидуальная, а по тиру:
```js
Vw = { 1: 500, 2: 1500, 3: 3000 };  // тир-валюта
// при покупке варианта C тира Q:
takeShapeByKey(tierCurrencyShape[Q-1], Vw[Q]);  // N штук общей валюты тира
takeShapeByKey(variantSpecificShape,   30);      // + 30 штук "своей" фигуры варианта
```

**Тир-валюта — это переиспользованная фигура уровня.** Самое элегантное в
дизайне мода: когда игрок доставляет в хаб фигуру для очередного уровня и
получает награду `reward_research` / `reward_research_t2` / `reward_research_t3`,
**эта же фигура** становится расходуемой валютой вкладки "Исследования" на
дальнейшую игру (текст подсказки в игре буквально говорит об этом:
*"a unique shape that is required to research it, starting with the shape
you just delivered!"*). Ничего изобретать не нужно — фигура уже существует и
уже производится игроком.

**Разблокировка тиров** — обычные `storyGoalCompleted`-триггеры на
конкретных уровнях модифицированной левел-шкалы (у мода — своя,
перестроенная под 26 уровней последовательность, привожу как есть):

| Уровень (мод) | Что даёт |
|---|---|
| 1–8 | Базовые постройки: cutter+trash, balancer, rotator, tunnel, painter, mixer, stacker |
| **9** | `reward_research` — открывается вкладка "Исследования" **Тир 1** |
| 10–15 | Блюпринты, апгрейд-тиры, слой проводов+покрасчик/рычаги, хранилище |
| **16** | `reward_research_t2` — **Тир 2** |
| 17–20 | Новые постройки (belt/line crossing и т.п.), апгрейд-тиры |
| **21** | `reward_research_t3` — **Тир 3** |
| 22–26 | Display, filter, фриплей |

Важно: **все 7 вариантов, что у нас сейчас даются левел-апом напрямую**
(ccw-rotator, rotator180, chainable-miner, tunnel-tier2, quad-cutter,
double-painter, splitter/merger), в моде **убраны из левел-шкалы целиком** и
целиком перенесены в исследования — ровно то, о чём просит пользователь
("с ростом уровня открываются только базовые постройки").

**HUD**: отдельная вкладка `ingame_HUD_Research`, кнопка в игровом меню
(`root.hud.parts.gameMenu`) появляется при `hubGoals.level > 9`, с
бейджем-счётчиком доступных для покупки исследований
(`getAvailableResearch()` — считает те, где все требования уже выполнены и
кнопка не скрыта). Карточка одного варианта: иконка, тир-плашка (цвет по
тиру), описание, 1-2 требования с прогресс-баром (текущее/нужное количество
фигуры), кнопка "Исследовать" (активна только когда всё накоплено). Уже
исследованные варианты сортируются в конец списка и подписываются
"COMPLETED"; варианты тира выше текущего — "LOCKED (Research Tier N
Required)". Прогресс сохраняется в сейве как список id исследованных
вариантов + флаг `gainedRewards[reward] = 1` (те же реворды, что и обычные
левел-апы, просто выданные не через уровень, а через покупку).

### B.2. Наша текущая система (для сравнения)

`src/js/game/modes/levels.js` — 26 уровней, каждый = `{shape, required,
reward}`. `src/js/game/tutorial_goals.js` — список `enumHubGoalRewards`.
`src/js/game/tutorial_goals_mappings.js` — таблица reward → какая
пара `(MetaBuilding, variant)` открывается. Сейчас **все** реворды даются
строго левел-апом, никакого исследования нет — то есть структура данных под
"базовые постройки по уровню" уже готова 1:1, нужно только:
1. Убрать реворды-варианты из `levels.js` (заменить на `no_reward` или сдвинуть
   другие реворды на освободившиеся уровни).
2. Добавить 3 новых `enumHubGoalRewards`: `reward_research`,
   `reward_research_t2`, `reward_research_t3`.
3. Завести аналог `Sw` — таблицу вариантов под исследование со стоимостью.
4. Завести HUD-часть по образцу `src/js/game/hud/parts/shop.js` (апгрейды уже
   есть в похожей форме — вкладка со списком, прогресс-барами и кнопкой
   покупки; это ближайший референс в нашем коде, не с нуля).

### B.3. Предложение: базовые постройки vs исследования

**Остаются на уровне (без изменений, это костяк игры):**

| Уровень (наш) | Постройка/механика |
|---|---|
| 1 | Cutter + Trash |
| 3 | Balancer |
| 4 | Rotator |
| 5 | Tunnel |
| 6 | Painter |
| 8 | Mixer |
| 10 | Stacker |
| 12 | Blueprints |
| 15 | Storage |
| 20 | Wires layer + painter/levers |
| 21 | Filter |
| 22 | Constant signal |
| 23 | Display |
| 24 | Logic gates |
| 25 | Virtual processing |
| 26 | Freeplay |

**Переносятся в исследования (уже существуют у нас как варианты, арт не
нужен — только перевесить триггер):**

| Вариант | Текущий уровень | Предлагаемый тир исследований |
|---|---|---|
| Rotator CCW | 7 | Тир 1 |
| Balancer Merger | 9 | Тир 1 |
| Miner Chainable | 11 | Тир 1 |
| Cutter Quad | 16 | Тир 1 |
| Tunnel Tier 2 | 13 | Тир 2 |
| Painter Double | 17 | Тир 2 |
| Balancer Splitter | 19 | Тир 2 |
| Rotator 180 | 18 | Тир 2 |

Освободившиеся 8 уровней (2, 7, 9, 11, 13, 16, 17, 18, 19 — с учётом что
некоторые уже "пустые"/`no_reward`) — предлагаю использовать так: три из них
отдают `reward_research` / `_t2` / `_t3` (открытие тиров), остальные —
`no_reward` (просто прогресс без нового контента, как уже есть уровень 2
сейчас) либо небольшое ускорение подачи следующей базовой постройки, если
темп левел-апа покажется пустым при плейтесте.

**Тиры исследований — предлагаемая привязка к уровню:**
- Тир 1: открывается на уровне **9** (сразу после Mixer) — доступны 4 QoL-варианта.
- Тир 2: открывается на уровне **16** (после Storage) — доступны 4 варианта посложнее.
- Тир 3: **не обязателен для MVP** — резервируется под будущие *новые*
  постройки, которых сейчас нет в игре (см. §B.5), открывать на уровне 21+,
  когда появится арт.

### B.4. Ресурсы (валюта) для исследований

Следуя находке из мода — **не изобретаем новые фигуры**:

- **Валюта тира** = фигура уровня, на котором открылся этот тир
  (уровень 9 и уровень 16 из таблицы выше). Она уже производится игроком в
  это время, требование естественно продолжает добычу той же цепочки.
  Ориентировочные объёмы по аналогии с модом (500 / 1500 масштабированные
  под наши `required` в `levels.js`, которые у нас уже растут похожей
  прогрессией — можно взять `required` этого уровня × 3–5 как стоимость
  одной покупки).
- **Своя фигура варианта** = фигура, которая **сейчас** назначена этому
  варианту в `levels.js` (см. таблицу выше, столбец "текущий уровень") — она
  и становится "форма-доказательство" при покупке, ровно как `shape` в
  объекте `Sw` мода. Тоже ничего изобретать не надо.
- **Про зависимость "ресурсы через другие исследования"** (то, что просил
  пользователь и чего в моде нет буквально, но легко добавить): фигуру для
  Тир-2-варианта можно **сделать так, чтобы её было ощутимо выгоднее
  собирать, имея уже купленный Тир-1-вариант** — например, фигура для
  "Rotator 180" (Тир 2) специально требует CCW-поворота на одном из шагов её
  формы. Это не жёсткая блокировка (можно собрать и без исследования, просто
  на обычном повороте дольше/криво), а мягкий стимул исследовать по порядку
  — тот же принцип, каким наши текущие уровни уже используют "unused"-фигуры
  для тренировки будущей механики (см. комментарии `// unused` в
  `levels.js`, там уже заложен этот приём).

### B.5. На будущее (не в MVP, требует нового арта/логики)

В моде за Тир 3 идут полностью новые постройки, которых у нас нет:
`quadStacker`, `laserCutter` (режет по проводному сигналу), `minerDeep`
(добывает больше обычного), `cornerCrossing`/`lineCrossing` (два конвейера
на одной клетке), `tunnelSmart` (принимает вход/выход сбоку),
`quadPainter` (красит слои по отдельности), `miniStorage`. Список — задел на
будущее расширение контента, отдельная задача (нужны спрайты и логика
компонентов), не блокирует MVP исследований на существующих 8 вариантах.

### B.6. Технические точки интеграции (файлы, без кода)

- `src/js/game/tutorial_goals.js` — добавить 3 реворда.
- `src/js/game/tutorial_goals_mappings.js` — семантика не меняется для
  оставшихся, для перенесённых в research реворды остаются теми же (просто
  выдаются из другого места).
- `src/js/game/modes/levels.js` — убрать 8 rewards из уровней (см. §B.3).
- `src/js/game/hub_goals.js` — сюда же, где сейчас живёт логика
  `takeShapeByKey`/`isRewardUnlocked`, добавить учёт выполненных исследований
  (аналог `gainedRewards`, поле уже существует в движке — переиспользуется).
- **Решение (обсуждение с пользователем): research НЕ отдельная вкладка.**
  Механика остаётся раздельной (shop — бесконечные тиры скорости за
  preparement/final shape; research — конечный список из 8 вариантов за
  фигуру уровня), но в HUD они делят один экран/одну кнопку меню — так же,
  как сейчас `game_menu.js:16-19` открывает `hud.parts.shop.show()` одной
  кнопкой `id: "shop"`. Значит:
  - `src/js/game/hud/parts/shop.js` расширяется секцией исследований внутри
    того же оверлея (например второй блок карточек под апгрейдами, с
    тир-плашкой и статусом LOCKED/COMPLETED из §B.1), а не заводится
    отдельный `research.js` + вторая кнопка в `game_menu.js`.
  - Видимость секции исследований внутри этого экрана управляется тем же
    условием, что было бы у отдельной кнопки (`hubGoals.level > 9` для
    Тира 1), просто это condition на блок внутри `shop.js`, а не на новый
    пункт меню.

---

## Итог / что дальше

Это отчёт для обсуждения, код не менялся. Следующие шаги на выбор:
1. Подтвердить/поправить распределение вариантов по тирам в §B.3.
2. Сгенерировать иконку "Достижения" для главного меню/настроек (оригами-
   стиль, кубок/пьедестал/медаль) — отдельный маленький арт-таск.
3. Начать имплементацию: сперва ачивки (проще, чище влияет на баланс),
   потом исследования (требует правки прогрессии уровней).

---

## Реализация ачивок — статус (эта сессия)

Часть A (ачивки) реализована целиком, часть B (исследования) — только этот
отчёт, код не трогали.

### Что сделано

- **65 ачивок**, все переведены (en+ru): `translations/base-en.yaml` /
  `base-ru.yaml`, раздел `achievements:`. Секретных — 6 (`belt500Tiles`,
  `logoBefore18`, `mapMarkers15`, `irrelevantShape`, `notRocket`,
  `stack5thLayer`) — им описание скрыто до открытия. Список условий:
  `src/js/game/achievements/achievement_defs.js`.
- **По просьбе адаптированы 3 секретки:**
  - `oldLevel17` → переименована в `whoKnows` ("Кто знает, тот знает"),
    описание теперь **не скрыто** (просто ничего не объясняет), триггер —
    произвести **старый ванильный логотип shapez.io** (`RuCw--Cw:----Ru--`,
    это же значение — константа `finalGameShape` в `modes/levels.js`) —
    скрытый привет к тому, откуда выросла эта игра.
  - `produceMsLogo` → id `msLogo`, описание тоже не скрыто = `"Hello, Bill!"`,
    условие (фигура `RgRyRbRr`) осталось секретом.
  - `logoBefore18` — осталась секретной как была, но триггер переключен на
    **наш новый логотип** `RwCu--Wu:----Rw--` вместо старого. Этот же новый
    шейп теперь и есть условие обычной (не секретной) ачивки `produceLogo`
    ("Вот он, логотип!"). Проверено шейп-вьювером — валидный шейп, по
    силуэту явно читается как логотип (см. скриншот в сессии).
- **Движок**: 3 новых сигнала (`itemStored`, `itemsTrashed`,
  `blueprintPlaced`) в `root.js` + точки диспатча в `belt_path.js`,
  `item_ejector.js`, `item_processor.js`, `blueprint.ts` — минимальные,
  по образцу уже существующих сигналов, не трогают игровую логику.
- **Трекер прогресса**: `src/js/game/hud/parts/achievement_tracker.js` —
  HUD-part по образцу `HUDWaypoints`/`HUDPinnedShapes` (те же
  serialize/deserialize в `savegame_serializer.js`, тот же паттерн
  подписки на `root.signals`). Статистика "без X до уровня Y" и счётчики
  живут в сейве, сам факт разблокировки — глобально, навсегда (как в Steam),
  в новом `src/js/profile/achievements_storage.js` (`achievements.bin`,
  тот же `ReadWriteProxy`, что и `ApplicationSettings`).
- **UI**: новый стейт `AchievementsState` (`src/js/states/achievements.js`,
  простой список, разблокированные — сверху), точки входа — кнопка в
  `SettingsState` (как `shapeViewerTool`) и кнопка на главном экране рядом
  с шестерёнкой настроек, с иконкой-трофеем (пока временная inline-SVG,
  тёплая кремово-золотая палитра под цвет шестерёнки настроек — см. арт-
  brief ниже для финальной версии).
- **Проверено** сборкой (`gulp build.web.code` + `gulp css.dev`, оба без
  ошибок) и живым прогоном в браузере (Playwright): кнопка на главном
  экране и в настройках открывают список из 65 записей, оба логотипа-шейпа
  валидны в шейп-вьювере, консоль без ошибок.

### Не сделано (осознанно, малый риск/цена)

- Иконки для каждой из 65 ачивок — вместо них общий кружок-бейдж
  (золотой = разблокировано, серый = нет). Отдельные иконки — по желанию,
  не просили.
- Ретроактивная выдача "без X"-ачивок для уже существующих старых сейвов
  (только уровневые пороги и апгрейды подхватываются при загрузке старого
  сейва — `onPostLoadHook`).

### Иконка "Достижения" — готова

Сгенерирована через `codex exec` (промпт ниже), провалидирована рендером
(`rsvg-convert`) и живым прогоном в браузере на реальной кнопке — и уже
вставлена в `src/js/states/main_menu.js` (`.achievementsButton`), заменив
временную заглушку. Кубок с двумя ручками, складка-"галочка" на чаше и на
постаменте (бумажные грани), та же тёплая кремово-золотая палитра, что и у
шестерёнки настроек. Промпт ниже оставлен как есть — пригодится, если
понадобится перегенерировать или сделать вариацию.

Референсы стиля (два, как просили):
1. `res/logo.png` — знак игры: сложенная бумага, плоские грани, чёткие
   сгибы/складки, никакой фотореалистичной текстуры.
2. Любая из `res_raw/sprites/buildings/*.png` (например `cutter.png` или
   `hub.png`) — та же плоская flat-icon эстетика с обводкой, но БЕЗ бумажных
   складок (это стиль построек, не икон бренда) — ориентир на то, "что
   именно НЕ повторять" (не плоский холодный серый индастриал, а тёплая
   кремово-золотая бумага, как в §7 REBRANDING_PLAN.md).

Промпт-заготовка:

```
Flat vector icon of a trophy cup on a small pedestal (or a medal on a
ribbon - pick whichever reads clearer at 32px), built as if cut and folded
from a single sheet of paper - origami-style flat geometric facets with
crisp fold-crease lines, not a smooth realistic trophy render.

Palette: warm cream and gold tones (#f7efdc to #d8c48f gradient, dark
warm-brown outline ~#6b5636), matching the game's existing paper-craft
brand mark (see res/logo.png for the exact material language: folded
paper, flat triangular facets, no gradients beyond the one paper-fold
shading step).

Style: bold simple shapes, must stay legible and recognizable when scaled
down to 32x32px (used as a small circular button icon). No photorealism,
no drop shadow beyond a single soft one under the whole silhouette, no
text/lettering, no background - transparent, square canvas with even
padding, centered.

Output as clean SVG (paths/shapes, not embedded raster), so it can be
pasted inline into the game's UI like its existing settings-gear icon.
```

---

## Приложение: полный список 65 ачивок из `achievements.mod.js`

`id — название — описание` (`secret` = скрытая, условие не показывается до выполнения):

- blueprint100k — Blueprints are the future — Have 100k blueprints stored in the hub
- play10h — It's been a long time — Play for 10 hours
- play1h — Getting into it — Play for 1 hour
- blueprint1m — I'll use it later — Have 1 million blueprints stored in the hub
- play20h — Addicted — Play for 20 hours
- throughputBp25 — Efficiency 1 — Deliver 25 blueprints per second
- belt500Tiles — I need trains — secret
- throughputBp50 — Efficiency 2 — Deliver 50 blueprints per second
- place5000Wires — Computer Guy — Place 5000 wires
- placeBlueprint — Now it's easy — Place a blueprint
- noBeltUpgradesUntilBp — It's so slow — Complete level 12 without any belt upgrades
- throughputLogo25 — Branding Specialist 1 — Deliver 25 logos per second
- throughputLogo50 — Branding Specialist 2 — Deliver 50 logos per second
- placeBp1000 — Copypasta — Place 1000 buildings at once
- cutShape — Cutter — Cut a shape
- darkMode — My eyes no longer hurt — Enable dark mode
- destroy1000 — Perfectionist — Destroy 1000 buildings at once
- logoBefore18 — A bit early? — secret
- mapMarkers15 — GPS — secret
- throughputRocket10 — Preparing to launch — Deliver 10 rockets per second
- produceLogo — The logo! — Produce the logo
- level100 — Is this the end? — Reach level 100
- unlockWires — Wires — Beat level 20, unlocking wires
- completeLvl26 — Freedom! — Complete level 26, unlocking freeplay
- upgradesTier5 — Faster — Have all upgrades at tier 5
- level50 — Can't Stop — Reach level 50
- upgradesTier8 — Even faster — Have all upgrades at tier 8
- mam — Make Anything Machine — Beat any level after level 26 without modifying your factory
- oldLevel17 — Memories from the past — secret
- noInverseRotater — King of Inefficiency — Use no inverse rotater until level 14
- irrelevantShape — Oops — secret
- openWires — The next dimension — Open the wires layer
- paintShape — Painter — Paint a shape
- produceRocket — To the moon! — Produce the rocket shape
- rotateShape — Rotater — Rotate a shape
- speedrunBp120 — Not an idle game — Reach and complete level 12 in under 120 minutes
- speedrunBp60 — Speedrun Novice — Reach and complete level 12 in under 60 minutes
- speedrunBp30 — Speedrun Master — Reach and complete level 12 in under 30 minutes
- produceMsLogo — I've seen that before... — secret
- throughputRocket20 — SpaceY — Deliver 20 rockets per second
- stackShape — Wait, they stack? — Stack a shape
- stack4Layers — Stack Overflow — Produce a shape with 4 layers
- storeShape — I'm a hoarder — Store a shape
- store100Unique — It's a mess — Store 100 unique shapes in the hub
- trash1000 — Get rid of them — Trash 1000 shapes
- 10kbelts — Belts go brrr — Place 10k belts
- freeplayLevel120s — It's an improvement — Beat a freeplay level in under 120 seconds
- place1mBps — I've finally used it — Spend 1 million blueprints
- store200k — True hoarder — Store 200k shapes in storages
- freeplayLevel30s — Automation master — Beat a freeplay level in under 30 seconds
- stack5thLayer — The forbidden layer — secret
- freeplayLevel60s — I am speed — Beat a freeplay level in under 60 seconds
- beltsLvl15 — Belts go brrrrrrrrrrrrrrrrrrr — Upgrade belts to level 15
- bird — Flappy Bird — Produce the bird shape (secret, joke)
- lvl6NoBalancers — Unbalanced — Complete level 6 without using any balancers
- lvl12NoDestroying — Environmentalist — Complete level 12 without destroying any buildings
- lvl20NoDoublePainter — Emperor of inefficiency — Complete level 20 without using any double painters
- noFactoryFreeplay — True perfectionist — Have a completely empty factory at any point after beating level 26
- lvl12NoTrash — Reduce, reuse, recycle — Complete level 12 without using any trash
- notRocket — You will not go to space today — secret
- lvl7NoTunnels — Do you enjoy pain? — Complete level 7 without using any tunnels
- lvl12NoUpgrades — It's even slower — Complete level 12 without buying any upgrades
- lvl27NoWires — DIY — Complete level 27 manually, without using any wires
- rocketBeforeLogo — A lot early? — Produce the rocket shape before producing the logo shape
- scissors — The other cutter — Produce the scissors shape
