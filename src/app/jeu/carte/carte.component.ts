import { Component, Input } from '@angular/core';

import { Carte, SYMBOLES, estRouge } from '../carte.model';

/** Une carte dessinée en CSS (pas d'image à charger), côté dos ou côté face. */
@Component({
  selector: 'app-carte',
  templateUrl: './carte.component.html',
  styleUrls: ['./carte.component.scss'],
})
export class CarteComponent {
  /** La carte à afficher. null = on ne montrera jamais que le dos. */
  @Input() carte: Carte | null = null;

  /** false = on montre le dos, true = on montre la face. */
  @Input() retournee = false;

  get symbole(): string {
    return this.carte ? SYMBOLES[this.carte.couleur] : '';
  }

  get rouge(): boolean {
    return this.carte !== null && estRouge(this.carte.couleur);
  }
}
