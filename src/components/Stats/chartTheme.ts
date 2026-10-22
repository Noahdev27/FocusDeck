/**
 * Couleurs des graphiques (thème sombre). Validées avec le script du skill `dataviz` contre la
 * surface des cartes (≈ #111118) :
 * - barres : une seule série, violet 400 (contraste ≥ 3:1) ;
 * - carte de chaleur : rampe ordinale violet 700 → 200, une teinte, luminosité croissante,
 *   premier pas à 2,65:1 ; le niveau 0 est le gris neutre de la piste.
 */
export const BAR_COLOR = '#a78bfa';
export const EMPTY_CELL = 'rgba(255, 255, 255, 0.06)';
export const HEAT_COLORS = [EMPTY_CELL, '#6d28d9', '#8b5cf6', '#a78bfa', '#ddd6fe'] as const;
export const GRID_COLOR = 'rgba(255, 255, 255, 0.07)';
