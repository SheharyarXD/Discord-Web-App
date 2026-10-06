# Shinobi Codex

Interfaz inicial en español para organizar y explorar una biblioteca de información del juego. No necesita un proceso de compilación: abre `index.html` en un navegador moderno.

## Alcance implementado

- Secciones de ninjas, equipamiento, joyería, gemas, conjuntos y estadísticas.
- Búsqueda de texto, filtros combinables, orden por nombre, poder y rareza; vista de cuadrícula o lista.
- Vistas detalladas con estadísticas, habilidades, pasivas, despertares, efectos, condiciones y bonificaciones de 2/4/6 piezas.
- Selector de talento activo (una opción seleccionada por ninja).
- Formularios para crear, editar y eliminar registros. Los cambios se guardan en `localStorage` del navegador.
- Diseño adaptable a pantallas grandes y móviles.

## Límites de esta entrega

El contenido incluido es demostrativo y no constituye una carga verificada del dataset vigente. No se proporcionó el contenido de referencia de Discord. La aplicación actual es una interfaz estática con persistencia local: no tiene base de datos compartida, autenticación, autorización real ni panel de servidor. La etiqueta «Espacio privado» representa el destino previsto, no una barrera de acceso. Para habilitar varios usuarios aprobados y proteger administración se necesita conectar un backend con almacenamiento persistente, identidad y roles.

No se configuró alojamiento ni despliegue: hacen falta el proveedor/entorno de destino y las credenciales correspondientes. La carga inicial completa requiere acordar y recibir los datos fuente del juego.

## Archivos

- `index.html`: estructura y contenido inicial.
- `styles.css`: estilos adaptables.
- `app.js`: datos de demostración, búsqueda, filtros, detalles y CRUD local.

Los registros iniciales viven en el objeto `seed` de `app.js`. Tras la primera apertura, el navegador conserva una copia en `localStorage`; para volver a los ejemplos iniciales, borra la clave `shinobi-codex-data` del almacenamiento local del sitio.
