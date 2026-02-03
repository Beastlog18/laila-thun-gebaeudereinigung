Web Freeze V1.2
WEB_FREEZE_v1.2
Projekt

Laila Thun Gebäudereinigung – Webseite

Freeze-Datum

2026-02-03

Status

FINAL – VERBINDLICH

Dieser Stand ist eingefroren. Alle Dateien, Inhalte und Strukturen gelten als lauffähig, korrekt und bewusst festgelegt. Änderungen erfolgen nicht rückwirkend, sondern nur über eine neue Version (v1.3 ff.).

1. Ziel des Freezes

Der Freeze v1.2 dokumentiert den inhaltlich und strukturell abgeschlossenen Stand der öffentlichen Webseite.

Fokus von v1.2:

klare Positionierung des Unternehmens

konsistenter Tonfall über alle Seiten

saubere regionale Einordnung

technisch stabile, statische Webseite ohne produktiven Adminbetrieb

Nicht Ziel dieses Freezes:

Design-Feinschliff

SEO-Optimierung

Performance-Tuning

Produktiver Admin- oder Backend-Betrieb

2. Enthaltene Seiten (öffentlich)

Folgende Seiten sind Teil von WEB_FREEZE_v1.2:

index.html – Startseite

ueber-uns.html – Über uns

leistungen.html – Leistungen

kontakt.html – Kontakt

jobs.html – Jobs / Initiativbewerbung

impressum.html

datenschutz.html

Alle Seiten:

laden korrekt

sind gestalterisch konsistent

nutzen die gemeinsame style.css

3. Inhaltliche Kernaussagen v1.2
Unternehmensprofil

Familienbetrieb seit 2016

Sitz: Schulzendorf

Schwerpunkt: gewerbliche Kunden

Privatkunden nur bei Kapazität und Sinnhaftigkeit

Regionale Ausrichtung (explizit benannt)

südliches Berlin

Berliner Umland

Großbeeren

Wildau

Schulzendorf

Königs Wusterhausen

Offen für weitere Regionen bei passenden Anfragen

Jobs

Initiativbewerbung dauerhaft sichtbar

Initiativbewerbung bleibt sichtbar, auch wenn konkrete Stellen geschaltet sind

Regionale Aussagen konsistent zu „Über uns“

Admin-Logik nur prototypisch (clientseitig)

4. Admin-Bereich (bewusst abgegrenzt)

Der Ordner /admin:

ist nicht Teil von WEB_FREEZE_v1.2

dient ausschließlich als Prototyp / Vorbereitung

besitzt:

keine Rechteverwaltung

keine Sicherheit

keine produktive Datenhaltung

Wichtig: Admin-Funktionen beeinflussen den Freeze nicht, solange keine produktiven Daten angebunden sind.

5. Technische Rahmenbedingungen

Statische HTML/CSS/JS-Webseite

Hosting: Netlify

Deployment: GitHub → Netlify (Continuous Deployment)

Kein Backend

Kein Server-Side-Code

Clientseitige Prototyp-Logik (z. B. Jobs über localStorage)

6. Abgrenzung zu früheren Versionen
v1.0

historischer Frontend-Freeze

reine Layout- und Strukturgrundlage

v1.1

Zwischenstand

inhaltlich nicht final

regionale Aussagen unvollständig

v1.2 (dieser Freeze)

inhaltlich konsistent

regionale Klarheit hergestellt

Initiativbewerbung strategisch integriert

geeignet als Übergabestand

7. Verbindlichkeit

Mit diesem Dokument gilt:

WEB_FREEZE_v1.2 ist abgeschlossen

Änderungen erfolgen ausschließlich über neue Versionen

Dieser Stand ist Referenz für:

weitere Entwicklung

Admin-Konzeption (Phase 0.4)

externe Übergaben

Ende der Freeze-Dokumentation – WEB_FREEZE_v1.2