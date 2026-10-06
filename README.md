# Furia Ninja — base de datos privada (Milestone 1)

Next.js 16 · TypeScript estricto · Prisma 6 + SQLite (portable a PostgreSQL) · Tailwind 4 · i18n propio (español por defecto).
No hay integración con Discord de ningún tipo. No se incluye ningún dato real del juego.

## Puesta en marcha
    npm install
    cp .env.example .env            # ajusta DATABASE_URL si hace falta
    npx prisma migrate deploy
    ADMIN_PASSWORD='<contraseña de 10+ caracteres>' npm run db:seed   # crea vocabulario estructural + admin (ADMIN_EMAIL en .env)
    npm run dev
`npm run db:seed:demo` carga datos ficticios "[DEMO]" para probar la UI (`-- --clean` los elimina).

## Comprobaciones
`npm run typecheck` · `npm run lint` · `npm test` · `npm run build`

## Estructura
- `prisma/schema.prisma` modelo de datos; `prisma/vocabulary.ts` vocabulario estructural.
- `src/domain` lógica pura (efectos, talentos, constantes). `src/server` BD, auth, consultas (solo servidor).
- `src/components` UI reutilizable (`game/` condiciones, talentos, sets). `src/i18n` textos centralizados.
- `src/app/(app)` rutas privadas, `src/app/admin` rutas de administrador, `src/app/login`.
- `legacy-prototype/` prototipo estático anterior (con datos inventados), conservado solo como referencia.
