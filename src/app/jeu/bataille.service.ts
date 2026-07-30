import { Injectable } from '@angular/core';

import { Carte } from './carte.model';
import { EtatJeu, Joueur, MoteurBataille } from './moteur-bataille';

/**
 * Service Angular : il ne contient AUCUNE règle du jeu.
 * Il se contente d'exposer le moteur au reste de l'application.
 * providedIn: 'root' => une seule instance partagée par toutes les pages.
 */
@Injectable({ providedIn: 'root' })
export class BatailleService {
  private readonly moteur = new MoteurBataille();

  get etat(): EtatJeu {
    return this.moteur.etat;
  }

  nouvellePartie(): void {
    this.moteur.nouvellePartie();
  }

  avancer(): void {
    this.moteur.avancer();
  }

  nbCartes(j: Joueur): number {
    return this.etat.paquets[j].length;
  }

  /** Cartes visibles posées par un joueur, dans l'ordre de pose. */
  cartesVisibles(j: Joueur): Carte[] {
    return this.etat.tapis[j].filter((p) => !p.cachee).map((p) => p.carte);
  }

  /** Nombre de cartes face cachée posées par un joueur pendant les batailles. */
  nbCachees(j: Joueur): number {
    return this.etat.tapis[j].filter((p) => p.cachee).length;
  }

  /** Libellé du bouton d'action principal, selon la phase. */
  get libelleAction(): string {
    switch (this.etat.phase) {
      case 'pret':
        return 'Retourner les cartes';
      case 'comparaison':
        return 'Comparer';
      case 'bataille':
        return 'BATAILLE !';
      default:
        return 'Nouvelle partie';
    }
  }

  get partieEnCours(): boolean {
    return this.etat.phase !== 'accueil' && this.etat.phase !== 'fin';
  }
}
