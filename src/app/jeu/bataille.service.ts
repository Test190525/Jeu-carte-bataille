import { Injectable } from '@angular/core';

import { CartePosee, EtatJeu, Joueur, MoteurBataille } from './moteur-bataille';

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

  /** Cartes posées sur le tapis par un joueur, dans l'ordre de pose. */
  posees(j: Joueur): CartePosee[] {
    return this.etat.tapis[j];
  }

  get partieEnCours(): boolean {
    return this.etat.phase !== 'accueil' && this.etat.phase !== 'fin';
  }

  /**
   * Le joueur doit-il poser ? C'est le seul moment où son paquet est cliquable.
   * Les cartes cachées d'une bataille, elles, partent toutes seules.
   */
  get peutPoser(): boolean {
    return this.etat.phase === 'pret' || this.etat.phase === 'renfort';
  }

  /** Une bataille est en cours : le tapis attend encore des cartes. */
  get enBataille(): boolean {
    return this.etat.phase === 'bataille' || this.etat.phase === 'renfort';
  }

  /** Résultat affiché une fois la partie terminée. */
  get resultat(): string {
    switch (this.etat.vainqueur) {
      case 'joueur':
        return 'Tu gagnes !';
      case 'ordinateur':
        return "L'ordinateur gagne !";
      default:
        return 'Match nul.';
    }
  }
}
