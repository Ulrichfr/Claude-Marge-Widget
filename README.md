# Claude Usage

Widget collé au bord droit de l'écran. Il apparaît quand la souris touche le
bord, montre où en sont les quotas Claude Max, et disparaît dès qu'on s'en va.

Un anneau par quota, et les quotas ne sont pas les mêmes selon le modèle :
la session de 5 heures, le total hebdomadaire, puis un anneau par modèle
(Opus, Sonnet, Fable...) avec sa propre limite. La liste est construite à
partir de ce que le compte expose réellement, elle n'est pas figée dans le code.

## D'où viennent les chiffres

De l'endpoint officiel utilisé par Claude Code lui-même :

    GET https://api.anthropic.com/api/oauth/usage

Le jeton OAuth est lu là où Claude Code le range : le Trousseau sur macOS
(service `Claude Code`), `~/.claude/.credentials.json` ailleurs. Il n'est ni
copié, ni mis en cache sur disque, ni envoyé ailleurs qu'à `api.anthropic.com`.

Le widget ne renouvelle jamais le jeton lui-même : faire tourner le jeton de
rafraîchissement invaliderait la session de Claude Code. Quand il a expiré, le
widget le dit et il suffit d'ouvrir Claude Code une fois.

Pour voir les données brutes sans lancer l'interface :

    npm run usage

## Lancer

    npm install
    npm start          # attend le survol du bord droit
    npm run demo       # reste ouvert en permanence, pour régler la position

Le widget ne prend jamais le focus et ne capte jamais un clic : la fenêtre est
transparente aux événements souris de bout en bout. Le survol est déduit de la
position du curseur, échantillonnée 22 fois par seconde.

Pour quitter : l'icône dans la barre d'état, ou `pkill -f claude-usage`.

## Démarrage automatique

macOS :

    cp install/com.ulrichrozier.claude-usage.plist ~/Library/LaunchAgents/
    launchctl load ~/Library/LaunchAgents/com.ulrichrozier.claude-usage.plist

Linux :

    mkdir -p ~/.config/systemd/user
    cp install/claude-usage.service ~/.config/systemd/user/
    systemctl --user enable --now claude-usage

## Réglages

`~/.config/claude-usage/config.json`, relu par « Recharger la configuration »
dans le menu de la barre d'état :

    {
      "verticalAnchor": 0.45,        // 0 en haut de l'écran, 1 en bas
      "refreshSeconds": 60,
      "followCursorDisplay": true    // le widget suit l'écran où est la souris
    }

## Couleurs

Vert sous 35 %, jaune jusqu'à 69 %, orange jusqu'à 89 %, rouge au-delà.
Le badge « limite active » signale le quota qui mord en ce moment, c'est-à-dire
celui qui coupera en premier.

## Ce qui est vérifié

`npm test` (21 tests) couvre les deux endroits où une erreur se voit tout de suite :

- la géométrie du survol (14 tests) : bord droit d'un écran multi-moniteurs,
  fenêtre qui reste dans l'écran quel que soit le nombre de modèles, et surtout
  l'absence de clignotement, la zone qui garde le widget ouvert contenant
  toujours la bande qui le déclenche ;
- la normalisation des quotas : un quota absent ne devient jamais un zéro
  affiché, un modèle exposé deux fois par l'API n'apparaît qu'une fois.

Une capture du rendu réel, hors compositeur, se prend avec :

    CLAUDE_USAGE_CAPTURE=/tmp/widget.png npm run demo

## Limites connues

- Sous Wayland, Electron ne peut pas positionner ses fenêtres. Le service
  systemd force X11 ; en lancement manuel, ajouter
  `ELECTRON_OZONE_PLATFORM_HINT=x11`.
- Sur X11 sans compositeur, la transparence tombe : le fond de la pilule
  s'affiche noir opaque au lieu de se fondre dans le bureau.
- L'icône de barre d'état a besoin de `libappindicator` sur Linux. Sans elle,
  le widget fonctionne, il n'y a simplement pas de menu.
