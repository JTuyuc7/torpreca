# Torpreca — Sistema de Gestión de Rutas

Aplicación móvil multiplataforma con geolocalización en tiempo real para gestión de rutas de la Corporación Torpreca, S.A.

## Apps

| App | Tecnología | Descripción |
|---|---|---|
| apps/backend | Bun + TypeScript | API REST + WebSocket |
| apps/dashboard | Next.js + TypeScript | Panel web para administradores |
| apps/mobile | Flutter (Android) | App para conductores |
| apps/landing | Next.js + TypeScript | Página de presentación |
| packages/shared | TypeScript | Tipos, schemas zod y constantes |

## Requisitos

- Bun >= 1.0
- Node.js >= 20
- Flutter >= 3.x (Android SDK)
- Cuenta en Supabase
- Token de Mapbox

## Setup

```
# Clonar
git clone https://github.com/<usuario>/torpreca.git
cd torpreca

# Variables de entorno
cp apps/backend/.env.example apps/backend/.env
cp apps/dashboard/.env.example apps/dashboard/.env.local
cp apps/mobile/.env.example apps/mobile/.env

# Instalar dependencias
cd apps/backend && bun install
cd apps/dashboard && pnpm install
cd packages/shared && bun install

# Correr en desarrollo
cd apps/backend && bun dev
cd apps/dashboard && pnpm dev
cd apps/mobile && flutter run
```

## Despliegue

Staging (`main`) y producción (`release`) corren en Render, con auto-deploy nativo por
rama — ver `context/infra/deploy-plan-cicd.md` para el diseño completo (topología de
servicios, gate de aprobación manual, workflows de CI). Convención de variables de
entorno por ambiente: [docs/deploy/environment-variables.md](docs/deploy/environment-variables.md).

## Documentación de la API (backend)

Con el backend corriendo (`bun dev` en `apps/backend`, puerto por defecto 3000):

- **Spec OpenAPI 3.1:** http://localhost:3000/openapi.json — generado en cada boot a partir de los schemas zod de `packages/shared` (`apps/backend/src/openapi/registry.ts`), no se escribe a mano.
- **Visor interactivo (Scalar):** http://localhost:3000/docs
- **Colección Postman:** en Postman, `File → Import` y pegar la URL `http://localhost:3000/openapi.json` (o el archivo descargado) — Postman genera la colección completa a partir del spec, tampoco se mantiene a mano.
