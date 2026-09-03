# TODO — Origamiz web port

Рабочий список: только незавершённые задачи и действующие решения. Подробная
история перенесена в [архив TODO](notes/TODO-history-2026-09-02.md); отчёты
сессий остаются в `sessions/`.

## Активные задачи

- [x] **Chunk 3 — Web build.** Добавлен вариант `web`; `npm run build-web`
      создаёт самостоятельную браузерную сборку в `build/`.
- [ ] **Chunk 4 — Yandex Games SDK.** Интегрировать `LoadingAPI.ready()`,
      рекламу, платежи, лидерборд и облачные сохранения. Не начинать без
      согласованного UX для рекламы и монетизации.
- [ ] **Ребрендинг ассетов.** Продолжать по
      [REBRANDING_PLAN.md](REBRANDING_PLAN.md); это единственный источник
      оставшегося перечня графики, звука и текстов.
- [ ] **Система исследований (research).** Спроектирована в
      [ACHIEVEMENTS_AND_RESEARCH_PLAN.md](ACHIEVEMENTS_AND_RESEARCH_PLAN.md)
      (часть B), код не писался — нужно подтвердить разбивку построек по
      тирам 1/2 прежде чем начинать реализацию.

## Отложенные улучшения

- [ ] Добавить desktop-триггеры undo/redo к уже существующей истории действий.
- [ ] Решить, нужен ли desktop-режим перемещения одной постройки без
      удаления/повторной установки.
- [ ] Решить, нужна ли desktop-цепочка конвейера кликами при обычном зуме
      (сейчас она есть только в map overview).
- [ ] Добавить на mobile повторную вставку последнего blueprint и бесплатное
      вырезание/перемещение группы построек, если это будет востребовано.

## Закрыто

- [x] **Chunk 1 — Browser platform runtime.**
- [x] **Chunk 2a — Mobile touch baseline.**
- [x] **Chunk 2b — Mobile control redesign.** Интерактивные туториалы включены
      и используют мобильные тексты; существующие GIF оставлены на mobile по
      подтверждённому решению.
- [x] **Chunk 2c — Mobile placement/edit UX overhaul.**
- [x] **Chunk 5 — Puzzle mode standalone build.**
- [x] **Система достижений.** 65 ачивок (en+ru), главный экран + пункт в
      настройках, см.
      [ACHIEVEMENTS_AND_RESEARCH_PLAN.md](ACHIEVEMENTS_AND_RESEARCH_PLAN.md)
      (часть A) и `sessions/2026-09-03-0250-session.md`.

## Действующие решения

- Название проекта: **Origamiz**; лицензия: **GPL-3.0-or-later**.
- В настройках доступны только **Русский** и **English**. Остальные файлы
  переводов намеренно сохранены, но не участвуют в выборе языка.
- Светлый фон игрового поля: `#ece3c8`.
- Dev-отладка в `src/js/core/config.local.js` выключена.

## Dev-инфраструктура

- Dev-сервер: пользовательский сервис `shapez-gulp`, порт `3005`.
- Tailscale Serve проксирует `https://localwsl.tail404046.ts.net:8721/` на
  `http://127.0.0.1:3005`.
- Проверить/перезапустить: `systemctl --user status shapez-gulp` /
  `systemctl --user restart shapez-gulp`.

## Архивы и находки

- Полная прежняя история TODO: [notes/TODO-history-2026-09-02.md](notes/TODO-history-2026-09-02.md).
- Отчёты сессий: `sessions/`.
- План ребрендинга и инвентарь ассетов: [REBRANDING_PLAN.md](REBRANDING_PLAN.md).
