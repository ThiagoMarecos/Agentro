/**
 * Versión central de la aplicación.
 * Editar acá cuando se hace un release — se refleja en el sidebar, account, etc.
 *
 * Convención semver:
 *   - 0.x.x → pre-1.0 (beta cerrada)
 *   - x.0.0 → release mayor
 *   - x.y.0 → feature
 *   - x.y.z → fix
 */

export const APP_VERSION = "0.8.0";
export const APP_VERSION_CHANNEL = "beta"; // "beta" | "rc" | "stable"
export const APP_VERSION_LABEL = `v${APP_VERSION} ${APP_VERSION_CHANNEL}`;

/** Fecha del release actual (formato YYYY-MM-DD). */
export const APP_RELEASE_DATE = "2026-05-29";

/** Highlights del release (para changelog inline si querés mostrarlos). */
export const APP_RELEASE_HIGHLIGHTS = [
  "Tours interactivos por página (44 steps cubriendo todo el sistema)",
  "Spotlight con iluminación + halo radial púrpura",
  "Sistema de invitaciones a la beta (formulario público + panel admin + emails)",
  "Refactor visual de Onboarding, Signup y Request-Invite (smoke + glass coherente)",
  "Redesign de Proveedores, Pipeline IA y WhatsApp",
];
