/**
 * Moteur du jeu de la Bataille (2 joueurs).
 * Volontairement SANS Angular : que de la logique, donc testable en Node.
 *
 * Convention importante : dans un paquet, l'index 0 est le DESSUS.
 *   - piocher  = shift()   (on prend sur le dessus)
 *   - ramasser = push()    (on met sous le paquet)
 */

import { Carte, couper, creerJeu52, melanger } from './carte.model';

export type Joueur = 'joueur' | 'ordinateur';

export type Phase =
  | 'accueil'      // aucune partie en cours
  | 'pret'         // on attend que les deux joueurs posent leur carte
  | 'comparaison'  // les cartes sont sur le tapis, il faut les comparer
  | 'bataille'     // égalité : il faut poser 1 carte cachée + 1 carte visible
  | 'fin';         // partie terminée

export type Resultat = Joueur | 'egalite';

export interface CartePosee {
  carte: Carte;
  /** true = posée face cachée (pendant une bataille). */
  cachee: boolean;
}

export interface EtatJeu {
  phase: Phase;
  /** Qui a distribué (celui qui a tiré la carte la plus forte). */
  donneur: Joueur | null;
  /** Les cartes tirées pour désigner le donneur, gardées pour l'affichage. */
  tirageDonneur: Record<Joueur, Carte> | null;
  /** Les paquets face cachée de chaque joueur. */
  paquets: Record<Joueur, Carte[]>;
  /** Les cartes posées sur la table pour le tour en cours. */
  tapis: Record<Joueur, CartePosee[]>;
  /** Message à afficher à l'écran. */
  message: string;
  /** Nombre de batailles enchaînées dans le tour courant (0 = tour normal). */
  niveauBataille: number;
  tour: number;
  vainqueur: Resultat | null;
  journal: string[];
}

/** Au-delà, on considère la partie interminable et on départage aux cartes. */
const LIMITE_TOURS = 500;

const NOMS: Record<Joueur, string> = {
  joueur: 'Toi',
  ordinateur: "L'ordinateur",
};

export class MoteurBataille {
  etat: EtatJeu = MoteurBataille.etatInitial();

  private static etatInitial(): EtatJeu {
    return {
      phase: 'accueil',
      donneur: null,
      tirageDonneur: null,
      paquets: { joueur: [], ordinateur: [] },
      tapis: { joueur: [], ordinateur: [] },
      message: 'Prêt à jouer ?',
      niveauBataille: 0,
      tour: 0,
      vainqueur: null,
      journal: [],
    };
  }

  // ------------------------------------------------------------------
  // Mise en place
  // ------------------------------------------------------------------

  /**
   * 1. Chacun tire une carte : le plus fort est le donneur.
   * 2. Le donneur bat les cartes et les fait couper.
   * 3. Il distribue une à une, EN COMMENÇANT PAR SON ADVERSAIRE, faces cachées.
   */
  nouvellePartie(): void {
    this.etat = MoteurBataille.etatInitial();

    // --- Tirage du donneur (on retire tant qu'il y a égalité) ---
    let pioche = melanger(creerJeu52());
    let carteJoueur = pioche.shift()!;
    let carteOrdi = pioche.shift()!;
    while (carteJoueur.valeur === carteOrdi.valeur) {
      if (pioche.length < 2) {
        pioche = melanger(creerJeu52());
      }
      carteJoueur = pioche.shift()!;
      carteOrdi = pioche.shift()!;
    }
    const donneur: Joueur = carteJoueur.valeur > carteOrdi.valeur ? 'joueur' : 'ordinateur';

    // --- Le donneur bat les cartes, l'adversaire coupe ---
    const paquetComplet = couper(melanger(creerJeu52()));

    // --- Distribution une à une, en commençant par l'adversaire du donneur ---
    const adversaire = MoteurBataille.autre(donneur);
    const paquets: Record<Joueur, Carte[]> = { joueur: [], ordinateur: [] };
    paquetComplet.forEach((carte, i) => {
      const destinataire = i % 2 === 0 ? adversaire : donneur;
      // unshift : la carte reçue en dernier se retrouve sur le DESSUS du paquet,
      // c'est celle que la règle demande de retourner en premier.
      paquets[destinataire].unshift(carte);
    });

    this.etat.donneur = donneur;
    this.etat.tirageDonneur = { joueur: carteJoueur, ordinateur: carteOrdi };
    this.etat.paquets = paquets;
    this.etat.phase = 'pret';
    this.etat.message = `${NOMS[donneur]} distribue (carte la plus forte au tirage).`;
    this.noter(
      `Tirage : ${carteJoueur.libelle} contre ${carteOrdi.libelle} → ${NOMS[donneur]} distribue.`,
    );
  }

  // ------------------------------------------------------------------
  // Déroulement : une seule méthode publique fait avancer la partie
  // ------------------------------------------------------------------

  /** Fait avancer la partie d'une étape, selon la phase courante. */
  avancer(): void {
    switch (this.etat.phase) {
      case 'pret':
        this.poserCartes();
        break;
      case 'comparaison':
        this.comparer();
        break;
      case 'bataille':
        this.poserBataille();
        break;
      default:
        break; // 'accueil' et 'fin' : il faut appeler nouvellePartie()
    }
  }

  /** Étape 1 d'un tour : chacun retourne la carte du dessus de son paquet. */
  private poserCartes(): void {
    if (this.verifierFinDePartie()) {
      return;
    }
    this.etat.tour++;
    this.etat.niveauBataille = 0;
    this.etat.tapis = { joueur: [], ordinateur: [] };

    // La règle veut que l'adversaire du donneur retourne en premier ;
    // comme les deux cartes sont comparées ensemble, l'ordre n'a pas d'incidence
    // sur le résultat, il servira seulement à animer la pose plus tard.
    for (const j of this.ordreDePose()) {
      this.poser(j, false);
    }
    this.etat.phase = 'comparaison';
    this.etat.message = 'Qui a la carte la plus forte ?';
  }

  /** Étape 2 : on compare les cartes visibles du dessus du tapis. */
  private comparer(): void {
    const visibleJoueur = this.derniereVisible('joueur');
    const visibleOrdi = this.derniereVisible('ordinateur');

    // Cas limite : un joueur n'a pas pu poser (plus de cartes) pendant une bataille.
    if (!visibleJoueur && !visibleOrdi) {
      this.terminer('egalite', 'Plus personne ne peut poser de carte : égalité.');
      return;
    }
    if (!visibleJoueur) {
      this.ramasser('ordinateur', "Tu ne peux plus poser de carte pour la bataille.");
      return;
    }
    if (!visibleOrdi) {
      this.ramasser('joueur', "L'ordinateur ne peut plus poser de carte pour la bataille.");
      return;
    }

    if (visibleJoueur.valeur === visibleOrdi.valeur) {
      this.etat.phase = 'bataille';
      this.etat.message = `BATAILLE ! Deux ${visibleJoueur.libelle} : une carte cachée, puis une visible.`;
      this.noter(`Bataille sur ${visibleJoueur.libelle}.`);
      return;
    }

    const gagnant: Joueur = visibleJoueur.valeur > visibleOrdi.valeur ? 'joueur' : 'ordinateur';
    const forte = gagnant === 'joueur' ? visibleJoueur : visibleOrdi;
    const faible = gagnant === 'joueur' ? visibleOrdi : visibleJoueur;
    this.ramasser(gagnant, `${forte.libelle} bat ${faible.libelle}.`);
  }

  /** Étape 3 (si bataille) : chacun pose une carte cachée puis une visible. */
  private poserBataille(): void {
    this.etat.niveauBataille++;
    for (const j of this.ordreDePose()) {
      // Il faut 2 cartes : une cachée + une visible.
      // S'il n'en reste qu'une, elle est posée face visible (c'est elle qui compte).
      if (this.etat.paquets[j].length >= 2) {
        this.poser(j, true);
        this.poser(j, false);
      } else if (this.etat.paquets[j].length === 1) {
        this.poser(j, false);
      }
      // 0 carte : ce joueur ne peut plus se défendre, comparer() tranchera.
    }
    this.etat.phase = 'comparaison';
    this.etat.message = 'On compare les nouvelles cartes visibles.';
  }

  // ------------------------------------------------------------------
  // Outils internes
  // ------------------------------------------------------------------

  /** Le joueur qui n'est pas le donneur retourne sa carte en premier. */
  private ordreDePose(): Joueur[] {
    const premier = this.etat.donneur ? MoteurBataille.autre(this.etat.donneur) : 'joueur';
    return [premier, MoteurBataille.autre(premier)];
  }

  private poser(j: Joueur, cachee: boolean): void {
    const carte = this.etat.paquets[j].shift();
    if (carte) {
      this.etat.tapis[j].push({ carte, cachee });
    }
  }

  /** Dernière carte posée face visible par ce joueur (celle qui compte). */
  private derniereVisible(j: Joueur): Carte | null {
    for (let i = this.etat.tapis[j].length - 1; i >= 0; i--) {
      if (!this.etat.tapis[j][i].cachee) {
        return this.etat.tapis[j][i].carte;
      }
    }
    return null;
  }

  /**
   * Le vainqueur du tour ramasse TOUTES les cartes du tapis et les met
   * sous son paquet. On mélange le butin : sans cela, deux paquets peuvent
   * se réalimenter dans le même ordre et la partie ne finit jamais.
   */
  private ramasser(gagnant: Joueur, raison: string): void {
    const butin = melanger([
      ...this.etat.tapis.joueur.map((p) => p.carte),
      ...this.etat.tapis.ordinateur.map((p) => p.carte),
    ]);
    this.etat.paquets[gagnant].push(...butin);
    this.etat.tapis = { joueur: [], ordinateur: [] };
    this.etat.message = `${raison} ${NOMS[gagnant]} ramasse ${butin.length} cartes.`;
    this.noter(this.etat.message);

    if (!this.verifierFinDePartie()) {
      this.etat.phase = 'pret';
      this.etat.niveauBataille = 0;
    }
  }

  /** Retourne true si la partie est finie (et bascule alors en phase 'fin'). */
  private verifierFinDePartie(): boolean {
    const nbJoueur = this.etat.paquets.joueur.length;
    const nbOrdi = this.etat.paquets.ordinateur.length;

    if (nbJoueur === 0 && nbOrdi === 0) {
      this.terminer('egalite', 'Les deux paquets sont vides : égalité.');
      return true;
    }
    if (nbJoueur === 0) {
      this.terminer('ordinateur', "Tu n'as plus aucune carte.");
      return true;
    }
    if (nbOrdi === 0) {
      this.terminer('joueur', "L'ordinateur n'a plus aucune carte.");
      return true;
    }
    if (this.etat.tour >= LIMITE_TOURS) {
      const vainqueur: Resultat =
        nbJoueur === nbOrdi ? 'egalite' : nbJoueur > nbOrdi ? 'joueur' : 'ordinateur';
      this.terminer(vainqueur, `Partie très longue (${LIMITE_TOURS} tours) : on départage aux cartes.`);
      return true;
    }
    return false;
  }

  private terminer(vainqueur: Resultat, raison: string): void {
    this.etat.phase = 'fin';
    this.etat.vainqueur = vainqueur;
    this.etat.message =
      vainqueur === 'egalite' ? `${raison} Match nul.` : `${raison} ${NOMS[vainqueur]} gagne !`;
    this.noter(this.etat.message);
  }

  private noter(ligne: string): void {
    this.etat.journal.unshift(`${this.etat.tour}. ${ligne}`);
    this.etat.journal = this.etat.journal.slice(0, 50);
  }

  private static autre(j: Joueur): Joueur {
    return j === 'joueur' ? 'ordinateur' : 'joueur';
  }

  // ------------------------------------------------------------------
  // Contrôle : doit TOUJOURS valoir 52
  // ------------------------------------------------------------------

  /** Nombre total de cartes en jeu (paquets + tapis). Sert de garde-fou. */
  totalCartes(): number {
    return (
      this.etat.paquets.joueur.length +
      this.etat.paquets.ordinateur.length +
      this.etat.tapis.joueur.length +
      this.etat.tapis.ordinateur.length
    );
  }

  /** Liste de tous les identifiants en jeu : sert à détecter doublons/pertes. */
  tousLesIds(): string[] {
    return [
      ...this.etat.paquets.joueur,
      ...this.etat.paquets.ordinateur,
      ...this.etat.tapis.joueur.map((p) => p.carte),
      ...this.etat.tapis.ordinateur.map((p) => p.carte),
    ].map((c) => c.id);
  }
}
