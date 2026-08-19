# CLAUDE.md — Torpreca PG2
> Instrucciones para Claude Code (VS Code / WebStorm).
> Este archivo se lee automáticamente al iniciar cada sesión de código.
> Última actualización: 17 de agosto 2026

---

## Contexto del proyecto

**Proyecto de Graduación II (PG2) + Seminario — UMG Guatemala**
Sistema de gestión de rutas en tiempo real para Corporación Torpreca, S.A.
Jaime Israel Tuyuc Tzaj · carné 1990-18-2320

**Contexto completo (leer antes de cualquier tarea):**
👉 https://www.notion.so/Contexto-para-IA-3b79981178b7813e873ef0465f2e275d

**Backlog de tareas:**
👉 https://app.notion.com/p/3b29981178b780d68c83c51b6678bc08 → 🧩 Backlog

---

## Estructura del monorepo

```
torpreca/
├── apps/
│   ├── backend/          # Bun + TypeScript (REST + WebSocket)
│   ├── dashboard/        # Next.js + pnpm + TypeScript
│   ├── mobile/           # Flutter — solo Android
│   └── landing/          # Next.js (página de presentación)
├── packages/
│   └── shared/           # Tipos TS, schemas zod, constantes
├── .claude/
│   └── CLAUDE.md         # Este archivo (copia de referencia)
├── .github/
│   └── workflows/        # CI/CD por app
└── README.md
```

---

## Stack — CERRADO (no cambiar sin documentar en Notion)

| App | Tecnología |
|---|---|
| backend | Bun + TypeScript · REST + WebSocket nativo |
| dashboard | Next.js 14+ · pnpm · TypeScript |
| mobile | Flutter · solo Android · Material Design 3 |
| landing | Next.js · pnpm · TypeScript |
| Auth | Supabase Auth (JWT + roles) — NO implementar auth propio |
| DB | PostgreSQL en Supabase — NO usar Neon ni otra DB |
| Mapas | Mapbox (mapbox_maps_flutter en mobile) |
| Validación | zod en backend y dashboard |
| Push notifications | FCM — Fase 2, no implementar en MVP |

---

## Reglas de código

### General
- TypeScript estricto en todo — no usar `any` salvo caso extremo documentado
- snake_case en la DB · camelCase en TypeScript · kebab-case en archivos
- Siempre validar inputs con zod antes de tocar la DB
- No hardcodear credenciales — todo en variables de entorno (.env)
- Commits en español, descriptivos: `feat: agregar endpoint POST /rutas`

### Backend (Bun)
- Toda request pasa por: auth → rol → rate limit → zod → handler
- Usar service_role key de Supabase para DB — nunca la anon key
- Encriptar nombre: pgp_sym_encrypt(nombre, SECRET_KEY) al escribir
- Desencriptar: pgp_sym_decrypt(nombre, SECRET_KEY) al leer
- Registrar en audit_logs los 12 eventos definidos
- WebSocket: autenticar con JWT en el handshake inicial

### Dashboard (Next.js)
- Componentes en app/ (App Router) — no usar pages/
- Pantalla de logs solo renderiza si rol === 'super_admin'
- super_admin no se puede crear desde la UI — solo desde la DB
- Usar anon key solo para auth — resto via backend

### Mobile (Flutter)
- Componentes nativos Material Design 3 — sin custom widgets salvo necesidad documentada
- Tema dual claro/oscuro con tokens V2 (ver Notion → Sistema de Diseño)
- Login: supabase_flutter → signInWithPassword()
- Offline: guardar en SQLite/Hive con sincronizado: false
- Al reconectar: drenar sync_queue cronológicamente via POST /sync

### Shared (packages/shared)
- Tipos TypeScript de las 9 entidades
- Schemas zod de todos los endpoints
- Constantes: estados, roles, eventos de audit
- Backend y dashboard importan desde aquí — no duplicar

---

## Variables de entorno

### apps/backend/.env
```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SECRET_KEY=
PORT=3000
ALLOWED_ORIGINS=
```

### apps/dashboard/.env.local
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_BACKEND_URL=
NEXT_PUBLIC_MAPBOX_TOKEN=
```

### apps/mobile/.env
```
SUPABASE_URL=
SUPABASE_ANON_KEY=
BACKEND_URL=
MAPBOX_TOKEN=
```

---

## Roles

| Rol | Acceso |
|---|---|
| conductor | App mobile — sus rutas y paradas |
| supervisor | Dashboard — ver + gestionar rutas |
| admin | Dashboard — acceso completo salvo logs |
| super_admin | Dashboard — acceso completo + logs · Solo asignable desde DB |

---

## Seguridad
- Rate limiting: máx 5 login/min por IP · máx 60 req/min general
- CORS: solo orígenes en ALLOWED_ORIGINS
- Headers: X-Content-Type-Options, X-Frame-Options, HSTS
- RLS activo en USUARIOS, RUTAS, PARADAS
- Resto de tablas: RLS sin políticas (solo service_role key)

---

## Sync con Notion

**Al iniciar sesión:** leer contexto en Notion (link arriba) + revisar tareas Por hacer.

**Documentar en Notion si:**
- Se toma una decisión técnica que cambia stack o arquitectura
- Se agrega una dependencia nueva
- Se completa una tarea del backlog
- Se encuentra un bloqueante relevante

**Al finalizar sesión:**
1. Mover tareas completadas a Hecho en el backlog
2. Actualizar página Contexto para IA si hay decisiones nuevas
3. Agregar entrada al historial con la fecha real del día

---

## Fuera del MVP
- NO: Notificaciones admin→conductor (tabla diseñada, sin uso)
- NO: Push notifications FCM
- NO: Optimización automática de rutas
- NO: iOS