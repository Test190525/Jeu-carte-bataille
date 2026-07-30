import { Component, ElementRef, OnDestroy, inject } from '@angular/core';
import { IonButton, IonContent, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { pause } from 'ionicons/icons';

import { BatailleService } from '../jeu/bataille.service';
import { CarteComponent } from '../jeu/carte/carte.component';
import { CartePosee, Joueur } from '../jeu/moteur-bataille';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  imports: [IonContent, IonButton, IonIcon, CarteComponent],
})
export class Tab1Page implements OnDestroy {
  readonly jeu = inject(BatailleService);

  private readonly hote: ElementRef<HTMLElement> = inject(ElementRef);

  /** Durées en ms : elles doivent rester alignées avec celles des SCSS. */
  private static readonly DUREE_POSE = 380;

  /** Attente entre deux cartes : elles sont posées l'une après l'autre. */
  private static readonly DECALAGE = 160;

  /** Temps laissé au joueur pour observer les cartes avant de les comparer. */
  private static readonly PAUSE_LECTURE = 1500;

  /** Vol d'une carte vers le paquet du gagnant, et écart entre deux cartes. */
  private static readonly DUREE_VOL = 650;
  private static readonly DECALAGE_VOL = 70;

  /** Le menu pause est-il ouvert ? */
  enPause = false;

  /** Calque des cartes en train de voler vers un paquet, hors du template. */
  private coucheDeVol: HTMLElement | null = null;

  /** Cartes en train de glisser du paquet vers le tapis. */
  private readonly entrantes = new Set<string>();

  /** Retard de départ de chaque carte entrante, pour l'effet « à la suite ». */
  private readonly decalages = new Map<string, number>();

  private minuteries: ReturnType<typeof setTimeout>[] = [];

  constructor() {
    addIcons({ pause });
  }

  ngOnDestroy(): void {
    this.oublierAnimations();
  }

  /** Clic sur son propre paquet : on retourne la ou les cartes du tour. */
  poser(): void {
    if (!this.jeu.peutPoser) {
      return;
    }
    // On photographie le tapis AVANT d'avancer : ce qui apparaît après est
    // exactement ce qu'il faut animer.
    const avant = this.idsSurTapis();
    this.jeu.avancer();
    this.animerNouvelles(avant);
  }

  nouvellePartie(): void {
    this.enPause = false;
    this.oublierAnimations();
    this.jeu.nouvellePartie();
  }

  mettreEnPause(): void {
    this.enPause = true;
  }

  reprendre(): void {
    this.enPause = false;
  }

  estEntrante(posee: CartePosee): boolean {
    return this.entrantes.has(posee.carte.id);
  }

  estRetournee(posee: CartePosee): boolean {
    return !posee.cachee;
  }

  decalage(posee: CartePosee): number {
    return this.decalages.get(posee.carte.id) ?? 0;
  }

  private idsSurTapis(): Set<string> {
    return new Set(this.toutesPosees().map((p) => p.carte.id));
  }

  private toutesPosees(): CartePosee[] {
    return [...this.jeu.posees('ordinateur'), ...this.jeu.posees('joueur')];
  }

  /**
   * Chaque carte nouvellement posée glisse de son paquet vers le tapis, les
   * unes après les autres. La comparaison se déclenche toute seule ensuite.
   */
  private animerNouvelles(avant: Set<string>): void {
    const posees = this.toutesPosees();
    if (!posees.length) {
      // Le tapis vient d'être ramassé : plus rien à animer.
      this.oublierAnimations();
      return;
    }

    let rang = 0;
    for (const posee of posees) {
      const id = posee.carte.id;
      if (avant.has(id)) {
        continue;
      }
      const decalage = rang++ * Tab1Page.DECALAGE;
      this.decalages.set(id, decalage);
      this.entrantes.add(id);
      this.differer(() => this.entrantes.delete(id), decalage + Tab1Page.DUREE_POSE);
    }

    const finDesPoses = Math.max(rang - 1, 0) * Tab1Page.DECALAGE + Tab1Page.DUREE_POSE;
    this.comparerQuandToutEstPose(finDesPoses + Tab1Page.PAUSE_LECTURE);
  }

  private comparerQuandToutEstPose(delai: number): void {
    if (this.jeu.etat.phase !== 'comparaison') {
      return;
    }
    this.differer(() => {
      const paquetsAvant = {
        joueur: this.jeu.nbCartes('joueur'),
        ordinateur: this.jeu.nbCartes('ordinateur'),
      };

      this.jeu.avancer();

      const gagnant = this.gagnantDuTour(paquetsAvant);
      if (gagnant) {
        this.animerRamassage(gagnant);
      } else if (!this.toutesPosees().length) {
        this.oublierAnimations();
      }
    }, delai);
  }

  /**
   * Le moteur n'annonce pas le gagnant du tour : c'est le paquet qui a grossi
   * qui le trahit. Aucun des deux ne bouge s'il y a bataille.
   */
  private gagnantDuTour(paquetsAvant: Record<Joueur, number>): Joueur | null {
    for (const j of ['joueur', 'ordinateur'] as Joueur[]) {
      if (this.jeu.nbCartes(j) > paquetsAvant[j]) {
        return j;
      }
    }
    return null;
  }

  /**
   * Les cartes du tapis filent se ranger SOUS le paquet du gagnant.
   *
   * Le moteur a déjà vidé le tapis : Angular effacera ces cartes au prochain
   * rafraîchissement. On les CLONE donc dans un calque, hors de portée du
   * template, et ce sont les clones qui volent. Le calque est glissé dans le
   * tapis sous les paquets (z-index 0 contre 1) : à l'arrivée, la pile recouvre
   * les cartes, exactement comme si elles se rangeaient dessous.
   */
  private animerRamassage(vers: Joueur): void {
    this.oublierAnimations();

    const tapis = this.hote.nativeElement.querySelector<HTMLElement>('.tapis');
    const cible = this.rectDuPaquet(vers);
    const cartes = this.elementsDesCartesPosees();
    if (!tapis || !cible || !cartes.length) {
      return;
    }

    const repere = tapis.getBoundingClientRect();
    const calque = document.createElement('div');
    calque.style.cssText = 'position:absolute;inset:0;z-index:0;pointer-events:none';
    tapis.appendChild(calque);
    this.coucheDeVol = calque;

    let finDuDernier = Tab1Page.DUREE_VOL;
    cartes.forEach((carte, i) => {
      const depart = carte.getBoundingClientRect();
      const clone = carte.cloneNode(true) as HTMLElement;
      clone.style.position = 'absolute';
      clone.style.left = `${depart.left - repere.left}px`;
      clone.style.top = `${depart.top - repere.top}px`;
      clone.style.margin = '0';
      calque.appendChild(clone);

      const retard = i * Tab1Page.DECALAGE_VOL;
      clone.animate(
        [
          { transform: 'none' },
          // Pile et cartes ont la même taille : sans mise à l'échelle, le clone
          // se superpose pile au paquet et disparaît derrière lui.
          { transform: `translate(${cible.left - depart.left}px, ${cible.top - depart.top}px)` },
        ],
        {
          duration: Tab1Page.DUREE_VOL,
          delay: retard,
          easing: 'cubic-bezier(0.3, 0, 0.2, 1)',
          fill: 'forwards',
        },
      );
      finDuDernier = Math.max(finDuDernier, retard + Tab1Page.DUREE_VOL);
    });

    this.differer(() => this.retirerCoucheDeVol(), finDuDernier);
  }

  private elementsDesCartesPosees(): HTMLElement[] {
    return Array.from(this.hote.nativeElement.querySelectorAll<HTMLElement>('.eventail app-carte'));
  }

  private rectDuPaquet(j: Joueur): DOMRect | null {
    const selecteur = j === 'joueur' ? '.camp.bas .paquet' : '.camp.haut .paquet';
    return this.hote.nativeElement.querySelector(selecteur)?.getBoundingClientRect() ?? null;
  }

  private retirerCoucheDeVol(): void {
    this.coucheDeVol?.remove();
    this.coucheDeVol = null;
  }

  private differer(action: () => void, delai: number): void {
    this.minuteries.push(setTimeout(action, delai));
  }

  private oublierAnimations(): void {
    this.minuteries.forEach(clearTimeout);
    this.minuteries = [];
    this.entrantes.clear();
    this.decalages.clear();
    this.retirerCoucheDeVol();
  }
}
