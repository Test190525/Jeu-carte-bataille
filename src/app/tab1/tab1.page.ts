import { Component, inject } from '@angular/core';
import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

import { BatailleService } from '../jeu/bataille.service';
import { Carte, SYMBOLES, estRouge } from '../jeu/carte.model';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButton,
    IonCard,
    IonCardContent,
    IonList,
    IonItem,
    IonLabel,
    IonBadge,
  ],
})
export class Tab1Page {
  readonly jeu = inject(BatailleService);

  /** Affichage texte d'une carte, ex: "A ♠". L'habillage viendra à l'étape 3. */
  texte(carte: Carte): string {
    return `${carte.libelle} ${SYMBOLES[carte.couleur]}`;
  }

  classeCarte(carte: Carte): string {
    return estRouge(carte.couleur) ? 'carte rouge' : 'carte noire';
  }

  /** Petit utilitaire pour répéter un élément n fois dans le template. */
  repeter(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
  }

  action(): void {
    if (this.jeu.partieEnCours) {
      this.jeu.avancer();
    } else {
      this.jeu.nouvellePartie();
    }
  }
}
