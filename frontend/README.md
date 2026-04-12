# Nexora Frontend

Next.js 14 + TypeScript + Tailwind.

## Rutas

| Ruta | Descripción |
|------|-------------|
| `/` | Landing |
| `/login`, `/signup` | Auth |
| `/auth/callback` | Callback Google OAuth |
| `/onboarding` | Wizard crear tienda |
| `/app` | Dashboard admin (métricas, actividad, setup progress) |
| `/app/settings` | Configuración tienda (General, Brand, Region, Contact, SEO) |
| `/app/appearance` | Apariencia (templates, colores, tipografía, preview) |
| `/app/products`, `/app/products/new`, `/app/products/[id]` | Catálogo productos |
| `/app/categories`, `/app/categories/new`, `/app/categories/[id]` | Categorías |
| `/app/orders`, etc. | Otros módulos admin |
| `/store/[slug]` | Storefront home |
| `/store/[slug]/catalog` | Catálogo |
| `/store/[slug]/product/[id]` | Producto |
| `/store/[slug]/cart`, `/checkout`, `/wishlist`, `/drops` | Storefront |

## Hooks y API

- `useDashboard(storeId)` - Dashboard summary y activity
- `useStoreSettings(storeId)` - Settings y update
- `useStoreTheme(storeId)` - Theme, presets, applyPreset, updateTheme
- `lib/api/dashboard.ts` - getDashboardSummary, getDashboardActivity
- `lib/api/settings.ts` - getStoreSettings, updateStoreSettings
- `lib/api/themes.ts` - getThemePresets, getStoreTheme, updateStoreTheme, applyThemePreset

## Componentes admin

- StatCard, ActivityItem, SetupProgressCard, ThemePreviewCard
- SettingsSection, SectionHeader, ColorInputRow, FormActionsBar

## Branding

- Primary: #6366F1
- Secondary: #8B5CF6
- Accent: #22C55E
- Background: #0F172A
- Text: #F8FAFC

## Ejecución

```bash
npm install
npm run dev
```

http://localhost:3000
