# Torpreca — Sistema de Gestión de Rutas

> Proyecto de Graduación II (PG2) · Universidad Mariano Gálvez de Guatemala · 2026
> Jaime Israel Tuyuc Tzaj · carné 1990-18-2320

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

## Documentación

- Contexto del proyecto: https://www.notion.so/Contexto-para-IA-3b79981178b7813e873ef0465f2e275d
- Plan completo: https://app.notion.com/p/3b29981178b780d68c83c51b6678bc08
- Diagramas UML: Notion → 📐 Documentación Técnica
- Modelo de datos: Notion → 🗄️ Modelo de Datos