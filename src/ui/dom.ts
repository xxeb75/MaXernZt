/** Élément de la page par son identifiant (la page est celle d'index.html : il doit exister). */
export const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
