# Furia Ninja — base de datos privada

Next.js 16 · TypeScript estricto · Prisma 6 + SQLite (portable a PostgreSQL) · Tailwind 4 · i18n propio (español por defecto).

Estado: **Milestone 4** (cierre de datos iniciales, optimización responsive, pruebas y preparación del despliegue). Informes: `MILESTONE_4_FINAL_TECHNICAL_REPORT.md` y `MILESTONE_4_FINAL_DELIVERY_VERIFICATION.md`. Despliegue: `DEPLOYMENT.md`. Comprobación de salud: `GET /api/health`.
No hay integración con Discord de ningún tipo: los datos se transcriben a mano desde el material de referencia entregado.

## Puesta en marcha

    npm install
    cp .env.example .env            # ajusta DATABASE_URL si hace falta
    npx prisma migrate deploy       # crea o actualiza el esquema (nunca reinicia la base de datos)
    npm run db:ingest               # carga los datos de referencia ya revisados (se puede repetir)
    ADMIN_EMAIL='<correo>' ADMIN_PASSWORD='<10+ caracteres>' npm run db:seed   # crea el administrador
    npm run dev

- `npm run db:ingest` lee `data/reference/*.json` (transcripción manual de las capturas) y hace *upsert*: repetirlo no duplica nada ni borra datos.
- `npm run db:ingest:staging` además exporta las tablas de revisión en CSV a `data/reference/staging/`.
- `npm run db:seed:demo` carga datos ficticios "[DEMO]" para probar la interfaz (`-- --clean` los elimina).
- `FEATURE_GEMS=true` vuelve a mostrar la sección Gemas (oculta por petición del cliente; sus tablas se conservan).

## Antes de migrar una base de datos con datos reales

Haz una copia del archivo (`cp prisma/dev.db prisma/backups/<fecha>.db`) o un volcado en PostgreSQL. La migración de M2 es aditiva y conserva los registros de M1, pero no tiene migración inversa: para volver atrás se restaura la copia.

## Comprobaciones

`npm run typecheck` · `npm run lint` · `npm test` · `npm run build`

## Estructura

- `prisma/schema.prisma` — modelo de datos. `prisma/constraints.sql` — reglas de integridad (triggers) incluidas en la migración de M2.
- `data/reference/` — datos de referencia revisados y su procedencia. `docs/milestone-2-handoff/` — material original (solo lectura).
- `src/domain` — lógica pura: resolución de efectos (valor por defecto frente a valor propio de un uso), condiciones, talentos, fechas, conjuntos.
- `src/game` — servicios de datos del juego: validación, escrituras transaccionales, lecturas paginadas, procedencia, cargador. `src/game/api.ts` aplica los permisos en cada llamada.
- `src/server` — acceso a base de datos, sesión y permisos (solo servidor).
- `src/components`, `src/i18n` — interfaz reutilizable y textos centralizados.
- `src/app/(app)` rutas privadas · `src/app/admin` rutas de administrador · `src/app/login`.
- `legacy-prototype/` — prototipo estático anterior (con datos inventados), conservado solo como referencia.
