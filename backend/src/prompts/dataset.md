# Die Spieldaten - was sie bedeuten

Du bekommst ein angereichertes Match-Objekt. Die Rohwerte wurden bereits aufbereitet.

## Struktur

matchId, duration (MM:SS), queue (z.B. "Ranked Solo/Duo").

Zwei Teams (blueTeam, redTeam): win (Sieger), bans (Champion-Namen, aufgeloest), und Objective-Counts: baron, dragon, tower, inhibitor, riftHerald.

## Pro Spieler

name, team, role, champion, champLevel — Level bei Spielende.

kda (K/D/A), killParticipation — Anteil an Teamkills (Kills+Assists / Teamkills gesamt).

gold (z.B. "14.2k"), csPerMin.

damage — Schaden an Champions gesamt. damageTaken — erhaltener Schaden.

visionScore, wardsPlaced, wardsKilled — Vision-Kontrolle.

turretKills — Turm-Kills durch diesen Spieler (relevant bei Split-Pushern).

cc — Sekunden angewandte Crowd Control auf Gegner.

multikills — Notable Multi-Kills (z.B. "Triple x1, Double x2").

items — aufgeloeste Item-Namen statt IDs.

keystone — Keystone-Rune. secondaryTree — sekundaerer Runen-Baum.

optional championContext — Kontext aus lokaler Champion-Datenbank.

## Interpretation

Gold: Vergleich entscheidet, nicht Absolutwert. 3k+ Vorsprung in einer Lane ist dominant, 10k+ im Team ist strukturell gewonnen.

csPerMin: unter 6 schwach, 8+ stark. Jungler haben naturgemäß weniger. Neutralminions (Jungle-CS) sind im CS-Wert enthalten.

damage: Absolute Werte sagen wenig. Vergleich innerhalb des Teams zeigt wer den Schaden gemacht hat. Damage/Gold ist effizienter Vergleich.

visionScore: 20+ Support-Standard, 15+ fuer andere. Unter 10 ist vernachlaessigt.

killParticipation: ueber 60% gut. Unter 40% zeigt Isolation vom Team.

items: Anzahl zeigt Build-Fortschritt. 6 Items ist full build.

Objectives: Baron gibt staerken Team-Buff und zeigt Mid-/Lategame-Dominanz. 4 gleiche Drachen geben Dragon Soul. Tower-Kills zeigen Map-Kontrolle, Inhibitoren bedeuten Nexus-Druck.

duration: unter 25 Minuten ist Stomp oder Surrender, 30-38 normal, ueber 45 Late Game mit moeglichen Comebacks.

## Einschraenkung

Die Daten sind Endstatistiken — keine Timeline. Es gibt keine Information darueber WANN etwas passiert ist (kein "Minute 10"). Schluesse ueber Spielphasen sind Ableitungen aus Gesamtstatistiken.

## championContext

Wenn ein Spieler-Eintrag das Feld championContext enthaelt, sind dort Kontext-Zeilen zur Spielweise, Matchup-Dynamiken und Item-Synergien aus der lokalen Datenbank. Nutze sie — erklär aber nicht explizit dass du eine Datenbank nutzt.

## Hinweis

Interpretiere und vergleiche. Zahlen nicht aufzählen sondern die Geschichte dahinter erzählen.
