/**
 * Modèle d'une carte et fabrication d'un jeu de 52 cartes (sans jokers).
 * Ce fichier ne dépend PAS d'Angular : il est réutilisable et testable partout.
 */

/** Les 4 couleurs (enseignes) d'un jeu classique. */
export type Couleur = 'pique' | 'coeur' | 'carreau' | 'trefle';

export interface Carte {
  /** Identifiant unique dans le jeu, ex: "A-pique". Utile pour le *ngFor et les tests. */
  readonly id: string;
  readonly couleur: Couleur;
  /** Force de la carte : 2..10, puis 11=Valet, 12=Dame, 13=Roi, 14=As. */
  readonly valeur: number;
  /** Ce qu'on affiche sur la carte : "2".."10", "V", "D", "R", "A". */
  readonly libelle: string;
}

export const COULEURS: readonly Couleur[] = ['pique', 'coeur', 'carreau', 'trefle'];

/** Symboles Unicode : pratiques pour l'affichage sans images. */
export const SYMBOLES: Record<Couleur, string> = {
  pique: '♠',
  coeur: '♥',
  carreau: '♦',
  trefle: '♣',
};

/** Rouge ou noir : servira pour la mise en forme. */
export function estRouge(couleur: Couleur): boolean {
  return couleur === 'coeur' || couleur === 'carreau';
}

const LIBELLES_FIGURES: Record<number, string> = { 11: 'V', 12: 'D', 13: 'R', 14: 'A' };

export function libelleValeur(valeur: number): string {
  return LIBELLES_FIGURES[valeur] ?? String(valeur);
}

/**
 * Construit LE jeu de 52 cartes : 4 couleurs x 13 valeurs (2 -> As).
 * Aucun hasard ici : on garantit d'abord que le jeu est complet et sans doublon.
 * Le hasard vient ensuite, uniquement du mélange.
 */
export function creerJeu52(): Carte[] {
  const jeu: Carte[] = [];
  for (const couleur of COULEURS) {
    for (let valeur = 2; valeur <= 14; valeur++) {
      jeu.push({
        id: `${libelleValeur(valeur)}-${couleur}`,
        couleur,
        valeur,
        libelle: libelleValeur(valeur),
      });
    }
  }
  return jeu; // 4 * 13 = 52
}

/**
 * Mélange de Fisher-Yates : chaque permutation des cartes est équiprobable.
 * On permute des cartes existantes, donc on n'en perd ni n'en invente aucune.
 * Retourne une nouvelle liste (le tableau d'origine n'est pas modifié).
 */
export function melanger<T>(cartes: readonly T[]): T[] {
  const copie = [...cartes];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}

/**
 * "Faire couper le paquet" : on choisit un point de coupe et on inverse les
 * deux moitiés. C'est fidèle à la règle, même si le mélange suffisait déjà.
 */
export function couper<T>(cartes: readonly T[]): T[] {
  if (cartes.length < 2) {
    return [...cartes];
  }
  // On évite de couper pile au bord (ce qui ne changerait rien).
  const point = 1 + Math.floor(Math.random() * (cartes.length - 1));
  return [...cartes.slice(point), ...cartes.slice(0, point)];
}
