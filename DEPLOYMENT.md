# Despliegue en producción (Milestone 4)

Este documento describe cómo poner en marcha la aplicación en un servidor propio o en un proveedor que permita **un disco persistente** (la base de datos es un archivo SQLite). El despliegue real no se ha hecho: necesita la aprobación del propietario y los datos del servidor elegido.

## Requisitos
- Node.js 22 o superior, y un disco persistente para el archivo de la base de datos.
- Un dominio con HTTPS (las cookies de sesión son `Secure` en producción).

## Variables de entorno
| Variable | Valor |
| --- | --- |
| `DATABASE_URL` | `file:/ruta/persistente/furia.db` (ruta absoluta en el disco persistente) |
| `SESSION_DAYS` | `14` |
| `FEATURE_GEMS` | `false` (Gemas oculta, como se acordó) |
| `NODE_ENV` | `production` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | solo durante el primer `db:seed`; no se guardan en el repositorio |

## Pasos
1. `npm ci`
2. Copia de seguridad del archivo de base de datos si ya existe.
3. `npx prisma migrate deploy` (crea o actualiza el esquema; no borra datos).
4. `npm run db:ingest` (carga los datos de referencia revisados; se puede repetir sin duplicar nada).
5. `ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run db:seed` (solo la primera vez; crea la cuenta del administrador).
6. `npm run build` y `npm start` (puerto 3000 por defecto, detrás del proxy HTTPS).

## Verificación final en producción
- `GET /api/health` responde `{"status":"ok"}` (comprueba que la aplicación llega a la base de datos).
- Iniciar sesión como administrador; abrir Ninjas, un detalle (por ejemplo Natsu Dragneel), Buscar y Administración.
- Con una cuenta de usuario normal: `/admin` responde «no encontrado» y no se puede modificar nada.
- `/gems` responde 404 mientras `FEATURE_GEMS=false`.
- Ancho de 390, 768 y 1024 px sin desplazamiento horizontal.

## Copias de seguridad
Copiar el archivo de la base de datos a diario (`cp furia.db copias/furia-AAAAMMDD.db`). Restaurar = detener la aplicación y sustituir el archivo.

## Contenido privado
`docs/m2-handoff/`, `docs/m3-handoff/`, las capturas de cartas y las copias de seguridad no forman parte del repositorio ni deben subirse al servidor.
