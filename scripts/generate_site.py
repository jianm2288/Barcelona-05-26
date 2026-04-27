from __future__ import annotations

import json
import re
import zipfile
from copy import deepcopy
from dataclasses import dataclass
from html import escape
from pathlib import Path
from typing import Any
from urllib.parse import unquote
from urllib.parse import quote_plus

from lxml import etree, html


ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "raw"
PAGES_DIR = ROOT / "pages"
MANIFEST_PATH = ROOT / "site_manifest.json"

WORD_NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
REL_NS = {"rel": "http://schemas.openxmlformats.org/package/2006/relationships"}
MAP_CONTEXT_BY_TAG = {
    "Barcelona": "Barcelona, Spain",
    "Granada": "Granada, Spain",
    "Seville": "Seville, Spain",
    "Costa Brava": "Tossa de Mar, Girona, Spain",
    "Gaudi": "Barcelona, Spain",
    "Landmark": "Barcelona, Spain",
    "Historic Core": "Barcelona, Spain",
    "Art": "Barcelona, Spain",
    "Square": "Barcelona, Spain",
    "Performance": "Barcelona, Spain",
    "Neighborhood": "Barcelona, Spain",
    "Church": "Barcelona, Spain",
    "Museum": "Barcelona, Spain",
    "Park": "Barcelona, Spain",
    "Waterfront": "Barcelona, Spain",
    "Boulevard": "Barcelona, Spain",
    "Basilica": "Barcelona, Spain",
    "Modernisme": "Barcelona, Spain",
    "Transit": "Barcelona, Spain",
    "Shopping": "Barcelona, Spain",
    "Day Trip": "Sitges, Spain",
    "Viewpoint": "Sitges, Spain",
    "Museum District": "Sitges, Spain",
}
SPAIN_DAY_HEADING_RE = re.compile(
    r"^(May\s+\d{1,2}),\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+[—-]\s+(.+)$"
)
TIME_SPLIT_RE = re.compile(r"(?<=[a-z\)])(?=(?:\d{1,2}:\d{2}(?:[–-]\d{1,2}:\d{2})?\s*(?:am|pm)\s+[—-]))")
LABEL_SPLIT_RE = re.compile(
    r"(?<=[a-z\.\)])(?=(?:Morning(?: options)?|Morning–early afternoon|Late morning|Early afternoon|Afternoon option [A-Z]|Afternoon|Late afternoon|Early evening|Evening / sunset|Evening|Sunset|Lunch:|Dinner:|Dinner in Seville:|Alternative:|Airport:|Suggested structure:|Book these first:))"
)

DAY_HEADING_RE = re.compile(
    r"^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+([A-Za-z]+\s+\d{1,2})\s+[—-]\s+(.+)$"
)

BARCELONA_DESTINATION_OVERRIDES = [
    {
        "title": "Barcelona Cathedral",
        "tag": "Landmark",
        "text": "Gothic focal point just a short walk from the hotel and part of the softened arrival-day route.",
        "link_href": "https://catedralbcn.org/en/tourist-visit/visiting-hours/",
        "aliases": ["Barcelona Cathedral", "Cathedral"],
    },
    {
        "title": "Gothic Quarter",
        "tag": "Historic Core",
        "text": "The most repeat-visited district in the updated plan, spanning the arrival walk, Boqueria option, and several dinner routes.",
        "link_href": "https://www.barcelonaturisme.com/wv3/en/page/1052/gothic-quarter.html",
        "aliases": ["Gothic Quarter", "Gothic Quarter lanes", "Optional Gothic Quarter walk"],
    },
    {
        "title": "El Món Neix en Cada Besada / Kiss Mural",
        "tag": "Art",
        "text": "A quick, close-to-hotel art stop folded into the easy first-evening walk.",
        "link_href": "https://www.google.com/maps/search/El+Mon+Neix+en+Cada+Besada+Barcelona/",
        "aliases": ["El Món Neix en Cada Besada / Kiss Mural", "Kiss Mural"],
    },
    {
        "title": "Plaça de Sant Jaume",
        "tag": "Square",
        "text": "Civic square in the Gothic Quarter that fits naturally into a low-effort arrival loop.",
        "link_href": "https://www.google.com/maps/search/Placa+de+Sant+Jaume+Barcelona/",
        "aliases": ["Plaça de Sant Jaume"],
    },
    {
        "title": "Palau de la Música Catalana",
        "tag": "Performance",
        "text": "A guided-tour anchor for the first full day, paired with El Born and the Picasso Museum.",
        "link_href": "https://www.palaumusica.cat/en/visites",
        "aliases": ["Palau de la Música Catalana", "Palau de la Música"],
    },
    {
        "title": "El Born",
        "tag": "Neighborhood",
        "text": "Walkable district for museums, lunch, and evening dining on the revised Sunday route.",
        "link_href": "https://www.barcelonabusturistic.cat/en/el-born",
        "aliases": ["El Born", "El Born streets"],
    },
    {
        "title": "Santa Maria del Mar",
        "tag": "Church",
        "text": "A natural late-morning stop between the Palau tour and the Picasso Museum.",
        "link_href": "https://www.google.com/maps/search/Santa+Maria+del+Mar+Barcelona/",
        "aliases": ["Santa Maria del Mar"],
    },
    {
        "title": "Picasso Museum Barcelona",
        "tag": "Museum",
        "text": "Timed-entry museum stop kept on the revised Sunday plan.",
        "link_href": "https://museupicassobcn.cat/en",
        "aliases": ["Picasso Museum", "Picasso Museum Barcelona"],
    },
    {
        "title": "Parc de la Ciutadella",
        "tag": "Park",
        "text": "Easy post-museum green-space extension before deciding whether to continue toward the waterfront.",
        "link_href": "https://www.google.com/maps/search/Parc+de+la+Ciutadella+Barcelona/",
        "aliases": ["Parc de la Ciutadella"],
    },
    {
        "title": "Barceloneta Waterfront",
        "tag": "Waterfront",
        "text": "Optional seaside stretch after the Picasso Museum and Ciutadella loop.",
        "link_href": "https://www.google.com/maps/search/Barceloneta+waterfront+Barcelona/",
        "aliases": ["Barceloneta waterfront"],
    },
    {
        "title": "Casa Batlló",
        "tag": "Gaudi",
        "text": "Fixed-plan Gaudi house visit scheduled for the morning of May 18 in the revised itinerary.",
        "link_href": "https://www.casabatllo.es/en/visit/",
        "aliases": ["Casa Batlló", "Casa Batllo"],
    },
    {
        "title": "Passeig de Gràcia",
        "tag": "Boulevard",
        "text": "Architecture and shopping spine connecting the Gaudi house morning to later shopping time.",
        "link_href": "https://www.barcelonaturisme.com/wv3/en/page/1239/passeig-de-gracia.html",
        "aliases": ["Passeig de Gràcia"],
    },
    {
        "title": "Casa Milà / La Pedrera",
        "tag": "Gaudi",
        "text": "The second fixed-plan Gaudi house visit on the International Museum Day route.",
        "link_href": "https://www.lapedrera.com/en/",
        "aliases": ["Casa Milà", "Casa Milà / La Pedrera", "La Pedrera"],
    },
    {
        "title": "Fundació Joan Miró",
        "tag": "Museum",
        "text": "Preferred May 18 museum pick in the updated schedule because it fits International Museum Day well.",
        "link_href": "https://www.fmirobcn.org/en/",
        "aliases": ["Fundació Joan Miró", "Joan Miró"],
    },
    {
        "title": "MACBA",
        "tag": "Museum",
        "text": "Optional second museum only if there is still energy after the Gaudi-house morning and Miró visit.",
        "link_href": "https://www.macba.cat/en",
        "aliases": ["MACBA"],
    },
    {
        "title": "Sagrada Família",
        "tag": "Basilica",
        "text": "Fixed timed visit at 13:30 on May 19 and one of the main anchors of the Barcelona stay.",
        "link_href": "https://sagradafamilia.org/en",
        "aliases": ["Sagrada Família"],
    },
    {
        "title": "Recinte Modernista de Sant Pau",
        "tag": "Modernisme",
        "text": "Recommended add-on for the May 19 morning now that the original Sant Pau slot is gone.",
        "link_href": "https://www.santpaubarcelona.org/en/",
        "aliases": ["Recinte Modernista de Sant Pau", "Sant Pau"],
    },
    {
        "title": "Park Güell",
        "tag": "Park",
        "text": "Moved to the morning of May 20 in the revised source so arrival day stays light.",
        "link_href": "https://parkguell.barcelona/en/planning-your-visit/prices-and-times",
        "aliases": ["Park Güell"],
    },
    {
        "title": "Gràcia",
        "tag": "Neighborhood",
        "text": "Optional coffee-and-stroll follow-up after Park Güell before returning for shopping.",
        "link_href": "https://www.google.com/maps/search/Gracia+Barcelona/",
        "aliases": ["Gràcia"],
    },
    {
        "title": "Mercado de la Boqueria",
        "tag": "Market",
        "text": "Late-morning or early-lunch option on May 20, deliberately kept off Sunday in the updated plan.",
        "link_href": "https://www.boqueria.barcelona/home",
        "aliases": ["Mercado de la Boquería", "Boquería"],
    },
    {
        "title": "Plaça Reial",
        "tag": "Square",
        "text": "Optional extension from La Rambla on the Boqueria-focused version of May 20.",
        "link_href": "https://www.google.com/maps/search/Placa+Reial+Barcelona/",
        "aliases": ["Plaça Reial"],
    },
    {
        "title": "Plaça Catalunya",
        "tag": "Transit",
        "text": "Central return point for shopping and transit after the Park Güell or Gràcia morning.",
        "link_href": "https://www.google.com/maps/search/Placa+Catalunya+Barcelona/",
        "aliases": ["Plaça Catalunya"],
    },
    {
        "title": "El Corte Inglés at Plaça Catalunya",
        "tag": "Shopping",
        "text": "One-stop department-store option in the dedicated shopping half-day.",
        "link_href": "https://www.google.com/maps/search/El+Corte+Ingles+Placa+Catalunya+Barcelona/",
        "aliases": ["El Corte Inglés at Plaça Catalunya", "El Corte Inglés"],
    },
    {
        "title": "Portal de l’Àngel",
        "tag": "Shopping",
        "text": "High-street shopping corridor close to the hotel and easy to fold into the final Barcelona day.",
        "link_href": "https://www.google.com/maps/search/Portal+de+l%27Angel+Barcelona/",
        "aliases": ["Portal de l’Àngel"],
    },
    {
        "title": "Sitges",
        "tag": "Day Trip",
        "text": "Optional seaside swap for May 20 if a beach-town break matters more than Park Güell plus shopping.",
        "link_href": "https://www.google.com/maps/search/Sitges/",
        "aliases": ["Sitges"],
    },
    {
        "title": "Sant Bartomeu i Santa Tecla Church Viewpoint",
        "tag": "Viewpoint",
        "text": "A classic old-town lookout on the optional Sitges version of the day.",
        "link_href": "https://www.google.com/maps/search/Sant+Bartomeu+i+Santa+Tecla+Sitges/",
        "aliases": ["Sant Bartomeu i Santa Tecla Church viewpoint"],
    },
    {
        "title": "Cau Ferrat / Maricel Area",
        "tag": "Museum District",
        "text": "Optional cultural stop on the Sitges swap if you want more than a beach-and-promenade day.",
        "link_href": "https://www.google.com/maps/search/Cau+Ferrat+Sitges/",
        "aliases": ["Cau Ferrat", "Maricel", "Cau Ferrat / Maricel area"],
    },
]

SPAIN_DESTINATION_OVERRIDES = [
    {
        "title": "Gothic Quarter",
        "tag": "Barcelona",
        "text": "Arrival-night historic core walk that keeps the first Barcelona evening compact and scenic.",
        "link_href": "https://www.barcelonaturisme.com/wv3/en/page/1052/gothic-quarter.html",
        "aliases": ["Gothic Quarter"],
    },
    {
        "title": "Barcelona Cathedral",
        "tag": "Barcelona",
        "text": "Quick first-evening anchor near the hotel before dinner in the old city.",
        "link_href": "https://catedralbcn.org/en/tourist-visit/visiting-hours/",
        "aliases": ["Barcelona Cathedral"],
    },
    {
        "title": "Plaça Reial",
        "tag": "Barcelona",
        "text": "A classic old-town square folded into the softened arrival-day walk.",
        "link_href": "https://www.google.com/maps/search/Placa+Reial+Barcelona/",
        "aliases": ["Plaça Reial"],
    },
    {
        "title": "Picasso Museum Barcelona",
        "tag": "Barcelona",
        "text": "Strong Sunday museum anchor before the El Born and Palau de la Música stretch.",
        "link_href": "https://museupicassobcn.cat/en",
        "aliases": ["Picasso Museum", "Museu Picasso Barcelona"],
    },
    {
        "title": "El Born",
        "tag": "Barcelona",
        "text": "Walkable neighborhood for museum, church, lunch, and dinner stops on the Sunday plan.",
        "link_href": "https://www.barcelonabusturistic.cat/en/el-born",
        "aliases": ["El Born", "El Born streets"],
    },
    {
        "title": "Santa Maria del Mar",
        "tag": "Barcelona",
        "text": "Historic church and easy landmark within the El Born walking segment.",
        "link_href": "https://www.google.com/maps/search/Santa+Maria+del+Mar+Barcelona/",
        "aliases": ["Santa Maria del Mar"],
    },
    {
        "title": "Palau de la Música Catalana",
        "tag": "Barcelona",
        "text": "Afternoon architectural highlight on the Barcelona Sunday route.",
        "link_href": "https://www.palaumusica.cat/en/visites",
        "aliases": ["Palau de la Música Catalana"],
    },
    {
        "title": "Arc de Triomf",
        "tag": "Barcelona",
        "text": "Optional add-on after the Palau visit before returning toward dinner.",
        "link_href": "https://www.google.com/maps/search/Arc+de+Triomf+Barcelona/",
        "aliases": ["Arc de Triomf"],
    },
    {
        "title": "Parc de la Ciutadella",
        "tag": "Barcelona",
        "text": "Optional green-space extension after Palau de la Música and Arc de Triomf.",
        "link_href": "https://www.google.com/maps/search/Parc+de+la+Ciutadella+Barcelona/",
        "aliases": ["Parc de la Ciutadella"],
    },
    {
        "title": "Casa Milà / La Pedrera",
        "tag": "Barcelona",
        "text": "First Gaudí-house anchor on the Monday architecture day.",
        "link_href": "https://www.lapedrera.com/en/",
        "aliases": ["Casa Milà", "Casa Milà / La Pedrera", "La Pedrera", "lapedrera.com"],
    },
    {
        "title": "Casa Batlló",
        "tag": "Barcelona",
        "text": "Second major Gaudí visit on the Monday architecture circuit.",
        "link_href": "https://www.casabatllo.es/en/visit/",
        "aliases": ["Casa Batlló"],
    },
    {
        "title": "Park Güell",
        "tag": "Barcelona",
        "text": "Afternoon park visit tied to the Gaudí-house day in the current source itinerary.",
        "link_href": "https://parkguell.barcelona/en/planning-your-visit/prices-and-times",
        "aliases": ["Park Güell"],
    },
    {
        "title": "Gràcia",
        "tag": "Barcelona",
        "text": "Late-afternoon cafe and dinner neighborhood after Park Güell.",
        "link_href": "https://www.google.com/maps/search/Gracia+Barcelona/",
        "aliases": ["Gràcia"],
    },
    {
        "title": "MNAC",
        "tag": "Barcelona",
        "text": "Tuesday museum stop placed before the fixed Sagrada Família entry.",
        "link_href": "https://www.museunacional.cat/en",
        "aliases": ["MNAC", "Museu Nacional d'Art de Catalunya"],
    },
    {
        "title": "Sagrada Família",
        "tag": "Barcelona",
        "text": "Fixed timed entry at 1:30 PM on Tuesday, May 19, and one of the trip’s main anchors.",
        "link_href": "https://sagradafamilia.org/en",
        "aliases": ["Sagrada Família"],
    },
    {
        "title": "Sant Pau Art Nouveau Site",
        "tag": "Barcelona",
        "text": "Late-afternoon follow-up near Sagrada Família on the Tuesday plan.",
        "link_href": "https://www.santpaubarcelona.org/en/",
        "aliases": ["Sant Pau Art Nouveau Site", "Sant Pau"],
    },
    {
        "title": "Tossa de Mar",
        "tag": "Costa Brava",
        "text": "Full-day coastal excursion replacing the earlier Blanes or Sitges idea in this updated itinerary.",
        "link_href": "https://www.google.com/maps/search/Tossa+de+Mar/",
        "aliases": ["Tossa de Mar"],
    },
    {
        "title": "Vila Vella",
        "tag": "Costa Brava",
        "text": "The walled old town and viewpoints that define the Tossa de Mar day trip.",
        "link_href": "https://www.google.com/maps/search/Vila+Vella+Tossa+de+Mar/",
        "aliases": ["Vila Vella"],
    },
    {
        "title": "Platja Gran",
        "tag": "Costa Brava",
        "text": "Main beach option during the open afternoon in Tossa de Mar.",
        "link_href": "https://www.google.com/maps/search/Platja+Gran+Tossa+de+Mar/",
        "aliases": ["Platja Gran"],
    },
    {
        "title": "Es Codolar",
        "tag": "Costa Brava",
        "text": "Smaller cove option on the Tossa afternoon beach-and-viewpoint loop.",
        "link_href": "https://www.google.com/maps/search/Es+Codolar+Tossa+de+Mar/",
        "aliases": ["Es Codolar"],
    },
    {
        "title": "Granada Cathedral",
        "tag": "Granada",
        "text": "Easy first-evening or next-morning anchor near the Granada hotel.",
        "link_href": "https://catedraldegranada.com/",
        "aliases": ["Granada Cathedral"],
    },
    {
        "title": "Royal Chapel",
        "tag": "Granada",
        "text": "Compact historical stop paired naturally with the cathedral in central Granada.",
        "link_href": "https://capillarealgranada.com/",
        "aliases": ["Royal Chapel"],
    },
    {
        "title": "Alcaicería",
        "tag": "Granada",
        "text": "Historic market area that fits neatly into the first Granada evening and final Granada morning.",
        "link_href": "https://www.google.com/maps/search/Alcaiceria+Granada/",
        "aliases": ["Alcaicería"],
    },
    {
        "title": "Plaza Bib-Rambla",
        "tag": "Granada",
        "text": "Central square attached to the late-afternoon Granada orientation walk.",
        "link_href": "https://www.google.com/maps/search/Plaza+Bib-Rambla+Granada/",
        "aliases": ["Plaza Bib-Rambla"],
    },
    {
        "title": "Albaicín",
        "tag": "Granada",
        "text": "Hilltop quarter for sunset views, first-night dinner, and the most atmospheric Granada walking stretch.",
        "link_href": "https://www.google.com/maps/search/Albaicin+Granada/",
        "aliases": ["Albaicín"],
    },
    {
        "title": "Mirador de San Nicolás",
        "tag": "Granada",
        "text": "Classic sunset lookout over the Alhambra and one of the defining Granada moments.",
        "link_href": "https://www.google.com/maps/search/Mirador+de+San+Nicolas+Granada/",
        "aliases": ["Mirador de San Nicolás"],
    },
    {
        "title": "Alhambra",
        "tag": "Granada",
        "text": "Highest-priority Granada booking, around which the full Friday visit should be built.",
        "link_href": "https://www.alhambra-patronato.es/en",
        "aliases": ["Alhambra"],
    },
    {
        "title": "Generalife",
        "tag": "Granada",
        "text": "Gardens-and-palaces follow-up within the Alhambra complex.",
        "link_href": "https://www.alhambra-patronato.es/en/the-monument/generalife",
        "aliases": ["Generalife"],
    },
    {
        "title": "Nasrid Palaces",
        "tag": "Granada",
        "text": "Timed-entry centerpiece within the Alhambra visit and the critical scheduling constraint for the day.",
        "link_href": "https://www.alhambra-patronato.es/en/areas/nasrid-palaces",
        "aliases": ["Nasrid Palaces"],
    },
    {
        "title": "Monasterio de San Jerónimo",
        "tag": "Granada",
        "text": "Optional extra site on the final Granada morning if the city-center list is already covered.",
        "link_href": "https://www.google.com/maps/search/Monasterio+de+San+Jeronimo+Granada/",
        "aliases": ["Monasterio de San Jerónimo"],
    },
    {
        "title": "Real Alcázar of Seville",
        "tag": "Seville",
        "text": "Top-priority Seville monument and the main Sunday morning booking anchor.",
        "link_href": "https://www.alcazarsevilla.org/en/",
        "aliases": ["Real Alcázar", "Alcázar", "Alcázar de Sevilla", "Real Alcázar of Seville"],
    },
    {
        "title": "Santa Cruz",
        "tag": "Seville",
        "text": "Most walkable district in the monument core, connecting the Alcázar, Cathedral, lunch, and evening routes.",
        "link_href": "https://www.google.com/maps/search/Barrio+de+Santa+Cruz+Seville/",
        "aliases": ["Santa Cruz", "Barrio Santa Cruz"],
    },
    {
        "title": "Patio de Banderas",
        "tag": "Seville",
        "text": "Key stop within the Santa Cruz walking segment after the Alcázar.",
        "link_href": "https://www.google.com/maps/search/Patio+de+Banderas+Seville/",
        "aliases": ["Patio de Banderas"],
    },
    {
        "title": "Murillo Gardens",
        "tag": "Seville",
        "text": "Shaded extension within the Santa Cruz afternoon route.",
        "link_href": "https://www.google.com/maps/search/Murillo+Gardens+Seville/",
        "aliases": ["Murillo Gardens"],
    },
    {
        "title": "Seville Cathedral",
        "tag": "Seville",
        "text": "Sunday afternoon monument stop once the cultural-visit timing opens up.",
        "link_href": "https://www.catedraldesevilla.es/en/",
        "aliases": ["Seville Cathedral"],
    },
    {
        "title": "Giralda",
        "tag": "Seville",
        "text": "Bell-tower climb paired with the Cathedral on the Sunday sightseeing route.",
        "link_href": "https://www.google.com/maps/search/Giralda+Seville/",
        "aliases": ["Giralda"],
    },
    {
        "title": "Las Setas / Metropol Parasol",
        "tag": "Seville",
        "text": "Sunset and dinner district for the first full Seville evening.",
        "link_href": "https://www.google.com/maps/search/Metropol+Parasol+Seville/",
        "aliases": ["Las Setas", "Metropol Parasol"],
    },
    {
        "title": "Plaza de España",
        "tag": "Seville",
        "text": "Open-air Monday morning anchor before the park, palace, or Triana options.",
        "link_href": "https://www.google.com/maps/search/Plaza+de+Espana+Seville/",
        "aliases": ["Plaza de España"],
    },
    {
        "title": "Parque de María Luisa",
        "tag": "Seville",
        "text": "Cooler park follow-up to Plaza de España on the open-air Seville day.",
        "link_href": "https://www.google.com/maps/search/Parque+de+Maria+Luisa+Seville/",
        "aliases": ["Parque de María Luisa", "María Luisa Park"],
    },
    {
        "title": "Palacio de las Dueñas",
        "tag": "Seville",
        "text": "Preferred Monday palace option when the afternoon leans architectural rather than riverfront.",
        "link_href": "https://www.lasduenas.es/en/",
        "aliases": ["Palacio de las Dueñas"],
    },
    {
        "title": "Triana",
        "tag": "Seville",
        "text": "Riverfront neighborhood for ceramics, tapas, and flamenco on the final full day.",
        "link_href": "https://www.google.com/maps/search/Triana+Seville/",
        "aliases": ["Triana"],
    },
    {
        "title": "Archivo de Indias",
        "tag": "Seville",
        "text": "Easy final-morning exterior stop near the cathedral before heading to the airport.",
        "link_href": "https://www.google.com/maps/search/Archivo+de+Indias+Seville/",
        "aliases": ["Archivo de Indias"],
    },
    {
        "title": "Hospital de los Venerables",
        "tag": "Seville",
        "text": "Optional last cultural stop if there is enough time on the final Seville morning.",
        "link_href": "https://www.google.com/maps/search/Hospital+de+los+Venerables+Seville/",
        "aliases": ["Hospital de los Venerables"],
    },
]


@dataclass
class ManifestEntry:
    source: str
    slug: str
    seed_page: str | None = None


def load_manifest() -> dict[str, ManifestEntry]:
    if not MANIFEST_PATH.exists():
        return {}

    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    entries: dict[str, ManifestEntry] = {}
    for item in manifest.get("itineraries", []):
        entry = ManifestEntry(
            source=item["source"],
            slug=item["slug"],
            seed_page=item.get("seedPage"),
        )
        entries[entry.source] = entry
    return entries


def slugify(value: str) -> str:
    value = unquote(value)
    value = re.sub(r"[^a-z0-9]+", "-", value.lower())
    return value.strip("-") or "itinerary"


def supported_sources() -> list[Path]:
    return sorted(
        path
        for path in RAW_DIR.iterdir()
        if path.is_file() and path.suffix.lower() in {".docx", ".md"}
        and not path.name.startswith("~$")
    )


def parse_seed_page(path: Path) -> dict[str, Any]:
    document = html.fromstring(path.read_text(encoding="utf-8"))
    title = text_or_default(document, "//title")
    eyebrow = text_or_default(document, "//div[@class='hero-copy']/p[@class='eyebrow']")
    hero_heading = text_or_default(document, "//div[@class='hero-copy']/h1")
    hero_text = text_or_default(document, "//div[@class='hero-copy']/p[@class='hero-text']")
    snapshot = [normalize_text(node.text_content()) for node in document.xpath("//aside[contains(@class, 'hero-panel')]//li")]

    intro_cards = []
    for card in document.xpath("//section[@id='overview']//article[contains(@class, 'card')]"):
        intro_cards.append(
            {
                "title": normalize_text(text_or_default(card, "./h2")),
                "text": normalize_text(text_or_default(card, "./p")),
                "accent": "accent" in (card.get("class") or ""),
            }
        )

    destinations = []
    for card in document.xpath("//section[@id='destinations']//article[contains(@class, 'destination-card')]"):
        link = first(card.xpath(".//a[contains(@class, 'destination-link')]"))
        destinations.append(
            {
                "tag": normalize_text(text_or_default(card, "./span[contains(@class, 'tag')]")),
                "title": normalize_text(text_or_default(card, "./h3")),
                "text": normalize_text(text_or_default(card, "./p")),
                "link_label": normalize_text(link.text_content()) if link is not None else "",
                "link_href": link.get("href", "") if link is not None else "",
            }
        )

    tab_map = {}
    for tab in document.xpath("//*[self::button or self::a][contains(@class, 'day-tab')]"):
        tab_map[tab.get("data-day")] = {
            "date_short": normalize_text(text_or_default(tab, ".//span[contains(@class, 'day-tab-date')]")),
            "tab_title": normalize_text(text_or_default(tab, ".//span[contains(@class, 'day-tab-title')]")),
        }

    days = []
    for panel in document.xpath("//article[contains(@class, 'day-panel')]"):
        panel_id = panel.get("id")
        tab = tab_map.get(panel_id, {})
        links = []
        stops = []
        for item in panel.xpath(".//article[contains(@class, 'timeline-item')]"):
            route_links = []
            for route in item.xpath(".//a[contains(@class, 'route-link')]"):
                route_links.append(
                    {
                        "label": normalize_text(route.text_content()),
                        "href": route.get("href", ""),
                    }
                )
            stops.append(
                {
                    "heading": normalize_text(text_or_default(item, "./h4")),
                    "text": normalize_text(text_or_default(item, "./p[1]")),
                    "meta": normalize_text(text_or_default(item, "./p[contains(@class, 'meta')]")),
                    "links": route_links,
                }
            )
            links.extend(route_links)

        days.append(
            {
                "date_short": tab.get("date_short", ""),
                "tab_title": tab.get("tab_title", ""),
                "full_date": normalize_text(text_or_default(panel, ".//div[contains(@class, 'day-header')]//p[contains(@class, 'eyebrow')]")),
                "title": normalize_text(text_or_default(panel, ".//div[contains(@class, 'day-header')]//h3")),
                "pill": normalize_text(text_or_default(panel, ".//span[contains(@class, 'route-pill')]")),
                "summary": normalize_text(text_or_default(panel, "./p[contains(@class, 'day-summary')]")),
                "stops": stops,
                "route_links": links,
            }
        )

    return {
        "title": title,
        "eyebrow": eyebrow,
        "hero_heading": hero_heading,
        "hero_text": hero_text,
        "snapshot": snapshot,
        "intro_cards": intro_cards,
        "destinations": destinations,
        "days": days,
    }


def parse_markdown_source(path: Path) -> dict[str, Any]:
    lines = path.read_text(encoding="utf-8").splitlines()
    title = ""
    sections: dict[str, list[str]] = {}
    current = "root"
    sections[current] = []

    for raw_line in lines:
        line = raw_line.rstrip()
        if line.startswith("# "):
            title = line[2:].strip()
            continue
        if line.startswith("## "):
            current = line[3:].strip().lower()
            sections[current] = []
            continue
        sections.setdefault(current, []).append(line)

    trip_summary = parse_key_value_bullets(sections.get("trip summary", []))
    transport = parse_bullets(sections.get("transport anchors", []))
    stay_pattern = parse_bullets(sections.get("stay pattern", []))
    planning_goals = parse_bullets(sections.get("intended planning goals", []))

    snapshot = []
    for key in ("dates", "sequence", "theme"):
        if key in trip_summary:
            snapshot.append(f"{key.title()}: {trip_summary[key]}")
    snapshot.extend(stay_pattern)
    snapshot.extend(transport[:2])

    intro_cards = []
    if trip_summary.get("sequence") or planning_goals:
        intro_cards.append(
            {
                "title": "Overall Route Logic",
                "text": planning_goals[0] if planning_goals else f"Trip sequence: {trip_summary.get('sequence', '')}",
                "accent": False,
            }
        )
    if transport:
        intro_cards.append(
            {
                "title": "Transport Strategy",
                "text": " ".join(transport),
                "accent": False,
            }
        )
    if planning_goals:
        intro_cards.append(
            {
                "title": "Planning Goals",
                "text": " ".join(planning_goals),
                "accent": True,
            }
        )

    return {
        "title": title or path.stem,
        "eyebrow": trip_summary.get("dates", ""),
        "hero_heading": title or path.stem,
        "hero_text": " ".join(planning_goals) if planning_goals else "",
        "snapshot": snapshot,
        "intro_cards": intro_cards,
        "destinations": [],
        "days": [],
    }


def parse_docx_source(path: Path) -> dict[str, Any]:
    paragraphs = [item["text"] for item in extract_docx_paragraph_data(path)]

    title = first(paragraphs) or path.stem
    details = []
    for paragraph in paragraphs[1:6]:
        details.extend([part.strip() for part in paragraph.split("\n") if part.strip()])

    snapshot = [item for item in details if ":" in item][:4]
    intro_text = " ".join(paragraphs[6:9]) if len(paragraphs) > 6 else ""

    return {
        "title": title,
        "eyebrow": first(snapshot) or "",
        "hero_heading": title,
        "hero_text": intro_text,
        "snapshot": snapshot,
        "intro_cards": [],
        "destinations": [],
        "days": [],
    }


def parse_spain_trip_docx_source(path: Path) -> dict[str, Any]:
    paragraphs = extract_docx_paragraphs(path)
    if not paragraphs:
        return parse_docx_source(path)

    day_indexes = [index for index, value in enumerate(paragraphs) if SPAIN_DAY_HEADING_RE.match(value)]
    days = []
    for offset, start in enumerate(day_indexes):
        end = day_indexes[offset + 1] if offset + 1 < len(day_indexes) else len(paragraphs)
        days.append(parse_spain_trip_day_block(paragraphs[start:end]))

    source_links = extract_docx_link_lookup(path)
    return {
        "title": paragraphs[0],
        "eyebrow": "Spain • May 16–26, 2026",
        "hero_heading": "Barcelona, Tossa de Mar, Granada, and Seville in one shared trip flow.",
        "hero_text": (
            "A continuous Spain trip from Barcelona through Tossa de Mar, Granada, and Seville, "
            "updated to remove Joan Miró, Blanes or Sitges, and Tibidabo while keeping the fixed "
            "Sagrada Família visit and a full Tossa de Mar day."
        ),
        "snapshot": [
            "Barcelona: May 16–20",
            "Granada: May 21–23",
            "Seville: May 23–26",
            "Fixed entry: Sagrada Família on May 19 at 1:30 PM",
            "Day trip swap: Tossa de Mar replaces Blanes / Sitges",
        ],
        "intro_cards": [
            {
                "title": "Trip Shape",
                "text": "This source combines five Barcelona days, a full Tossa de Mar excursion, two Granada days, and the final Seville stretch into one continuous May itinerary.",
                "accent": False,
            },
            {
                "title": "Booking Priorities",
                "text": "Secure the Alhambra, Sagrada Família, Real Alcázar, Seville Cathedral, Casa Batlló, Casa Milà, Park Güell, and Picasso Museum first, then layer restaurant reservations around those fixed anchors.",
                "accent": False,
            },
            {
                "title": "Routing Logic",
                "text": "The flow stays light on arrival days, clusters major monuments by neighborhood, and uses Sunday and Monday opening patterns to decide which museums and palaces land where.",
                "accent": True,
            },
        ],
        "destinations": build_spain_destinations(days, source_links),
        "days": days,
        "trip_name": "Spain Trip Itinerary",
    }


def parse_barcelona_docx_source(path: Path) -> dict[str, Any]:
    paragraphs = extract_docx_paragraphs(path)
    if not paragraphs:
        return parse_docx_source(path)

    title = next((p for p in paragraphs if p.endswith("Itinerary")), "Barcelona Itinerary")
    intro = paragraphs[0]
    details = split_compound_details(paragraphs[2]) if len(paragraphs) > 2 else []
    key_adjustment = paragraphs[4] if len(paragraphs) > 4 else ""

    days = []
    heading_indexes = [index for index, value in enumerate(paragraphs) if DAY_HEADING_RE.match(value)]
    for offset, start in enumerate(heading_indexes):
        end = heading_indexes[offset + 1] if offset + 1 < len(heading_indexes) else len(paragraphs)
        days.append(parse_barcelona_day_block(paragraphs[start:end]))

    snapshot = details[:4]
    if len(details) >= 4:
        hero_eyebrow = f"Barcelona • {details[0].replace('Dates: ', '')}"
    else:
        hero_eyebrow = "Barcelona"

    hero_heading = "Updated Barcelona daily plan synced to the revised May 16 arrival."
    hero_text = key_adjustment or intro

    intro_cards = [
        {"title": "Key Adjustment", "text": key_adjustment, "accent": False},
        {
            "title": "Fixed Anchors",
            "text": "The revised source keeps Casa Batlló and Casa Milà on May 18 morning, Sagrada Família at 13:30 on May 19, one dedicated shopping half-day, and the optional Sitges swap.",
            "accent": False,
        },
        {
            "title": "How To Read It",
            "text": "The arrival afternoon is now intentionally lighter, Park Güell has moved to May 20, and each day below reflects the updated raw itinerary timing.",
            "accent": True,
        },
    ]

    return {
        "title": title,
        "eyebrow": hero_eyebrow,
        "hero_heading": hero_heading,
        "hero_text": hero_text,
        "snapshot": snapshot,
        "intro_cards": intro_cards,
        "destinations": build_barcelona_destinations(days),
        "days": days,
        "trip_name": "Barcelona Itinerary",
    }


def build_itinerary(source_path: Path, manifest_entry: ManifestEntry | None) -> dict[str, Any]:
    data: dict[str, Any] = {}
    has_seed = False

    if manifest_entry and manifest_entry.seed_page:
        seed_path = ROOT / manifest_entry.seed_page
        if seed_path.exists():
            data = parse_seed_page(seed_path)
            has_seed = True

    if source_path.name == "Barcelona Itinerary.docx":
        raw_data = parse_barcelona_docx_source(source_path)
    elif source_path.name == "May 26 Spain Trip.docx":
        raw_data = parse_spain_trip_docx_source(source_path)
    elif source_path.suffix.lower() == ".md":
        raw_data = parse_markdown_source(source_path)
    else:
        raw_data = parse_docx_source(source_path)

    if has_seed and not raw_data.get("destinations") and not raw_data.get("days"):
        data = merge_sparse_source(data, raw_data)
    else:
        data = merge_itinerary(data, raw_data)

    slug = manifest_entry.slug if manifest_entry else slugify(source_path.stem)
    data["slug"] = slug
    data["source_name"] = source_path.name
    data["source_href"] = f"../raw/{source_path.name}"
    data["page_href"] = f"pages/{slug}.html"
    data["trip_name"] = infer_trip_name(data, source_path)
    data["duration"] = infer_duration(data)
    data["description"] = infer_description(data)
    data["coverage"] = infer_coverage(data)
    data["title"] = data.get("title") or source_path.stem
    data["eyebrow"] = data.get("eyebrow") or data["trip_name"]
    data["hero_heading"] = data.get("hero_heading") or data["trip_name"]
    data["hero_text"] = data.get("hero_text") or data["description"]
    data["snapshot"] = data.get("snapshot") or [f"Source: {source_path.name}"]
    data["intro_cards"] = normalize_intro_cards(data.get("intro_cards") or [], data)
    prepare_destination_linking(data)
    return data


def merge_itinerary(seed: dict[str, Any], raw: dict[str, Any]) -> dict[str, Any]:
    merged = deepcopy(seed)
    for key, value in raw.items():
        if isinstance(value, list):
            if value:
                merged[key] = value
            else:
                merged.setdefault(key, [])
        elif isinstance(value, str):
            if value.strip():
                merged[key] = value.strip()
            else:
                merged.setdefault(key, "")
        else:
            merged[key] = value
    return merged


def merge_sparse_source(seed: dict[str, Any], raw: dict[str, Any]) -> dict[str, Any]:
    merged = deepcopy(seed)
    for key in ("snapshot",):
        if raw.get(key):
            merged[key] = raw[key]
    return merged


def normalize_intro_cards(cards: list[dict[str, Any]], itinerary: dict[str, Any]) -> list[dict[str, Any]]:
    if cards:
        return cards[:3]

    destinations = itinerary.get("destinations", [])
    days = itinerary.get("days", [])
    return [
        {
            "title": "Overall Route Logic",
            "text": itinerary.get("hero_text") or "Browse the trip at the overall level first, then move into the day-by-day route.",
            "accent": False,
        },
        {
            "title": "Destination Coverage",
            "text": f"{len(destinations)} destination highlights and {len(days)} itinerary days are currently mapped on this page.",
            "accent": False,
        },
        {
            "title": "Source Tracking",
            "text": f"This page is generated from {itinerary.get('source_name', 'the raw itinerary source')} so the landing page and itinerary view stay in sync.",
            "accent": True,
        },
    ]


def render_index(itineraries: list[dict[str, Any]]) -> str:
    date_items = [item.get("eyebrow") for item in itineraries if item.get("eyebrow")]
    coverage_items = [item for item in date_items[:3]]
    source_cards = []
    for itinerary in itineraries:
        source_cards.append(
            f"""
          <article class="trip-card">
            <span class="tag">{escape(source_extension_label(itinerary["source_name"]))}</span>
            <h3>{escape(itinerary["source_name"])}</h3>
            <p>Canonical itinerary input for the {escape(itinerary["trip_name"])} page.</p>
            <a class="destination-link" href="raw/{escape(itinerary["source_name"])}">Open source file</a>
          </article>
"""
        )

    trip_cards = []
    for itinerary in itineraries:
        trip_cards.append(
            f"""
          <article class="trip-card">
            <span class="tag">{escape(itinerary["coverage"])}</span>
            <h3>{escape(itinerary["trip_name"])}</h3>
            <p>{escape(itinerary["description"])}</p>
            <div class="trip-meta">
              <span>{escape(itinerary["eyebrow"])}</span>
              <span>{escape(itinerary["duration"])}</span>
            </div>
            <a class="destination-link" href="{escape(itinerary["page_href"])}">Open itinerary</a>
          </article>
"""
        )

    coverage_list = "".join(f"<li>{escape(item)}</li>" for item in coverage_items) or "<li>Generated from raw itinerary sources</li>"
    trip_count = len(itineraries)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>Trip Library</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600;700&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="page-shell">
    <header class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Trip Library</p>
        <h1>Generated itinerary pages from every source file in <code>raw/</code>.</h1>
        <p class="hero-text">
          Each trip uses the same overview, destination coverage, and day-by-day route browsing pattern, with one output page per source itinerary.
        </p>
        <div class="hero-actions">
          <a href="#trips" class="button button-primary">Open Itineraries</a>
          <a href="#sources" class="button button-secondary">View Source Files</a>
        </div>
      </div>
      <aside class="hero-panel">
        <h2>Current Coverage</h2>
        <ul class="snapshot-list">
          <li>{trip_count} published itineraries</li>
          {coverage_list}
        </ul>
      </aside>
    </header>

    <main>
      <section class="section intro-grid" id="overview">
        <article class="card">
          <h2>Consistent Structure</h2>
          <p>Every trip page keeps the same order: trip overview, overall destinations, then a day-by-day route browser with route links attached to the relevant stop.</p>
        </article>
        <article class="card">
          <h2>Built For Growth</h2>
          <p>The generator scans supported sources in <code>raw/</code>, keeps a stable source-to-page mapping, and updates the landing page automatically.</p>
        </article>
        <article class="card accent">
          <h2>Best Way To Use It</h2>
          <p>Start from the trip card that matches your travel leg, then move into the daily tabs for route order, transit anchors, and map links.</p>
        </article>
      </section>

      <section class="section" id="trips">
        <div class="section-heading">
          <p class="eyebrow">Trip Pages</p>
          <h2>Published itineraries</h2>
        </div>
        <div class="trip-grid">
{''.join(trip_cards)}        </div>
      </section>

      <section class="section" id="sources">
        <div class="section-heading">
          <p class="eyebrow">Raw Inputs</p>
          <h2>Source files in this repository</h2>
        </div>
        <div class="trip-grid">
{''.join(source_cards)}        </div>
      </section>
    </main>
  </div>
</body>
</html>
"""


def render_itinerary_page(itinerary: dict[str, Any]) -> str:
    destination_cards = "".join(render_destination_card(card) for card in itinerary["destinations"])
    day_tabs = "".join(render_day_tab(index, day) for index, day in enumerate(itinerary["days"], start=1))
    day_panels = "".join(render_day_panel(index, day) for index, day in enumerate(itinerary["days"], start=1))
    intro_cards = "".join(render_intro_card(card) for card in itinerary["intro_cards"])
    snapshot = "".join(f"<li>{escape(item)}</li>" for item in itinerary["snapshot"])

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>{escape(itinerary["title"])}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600;700&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../styles.css">
</head>
<body>
  <div class="page-shell">
    <a class="home-link" href="../index.html">All itineraries</a>

    <header class="hero">
      <div class="hero-copy">
        <p class="eyebrow">{escape(itinerary["eyebrow"])}</p>
        <h1>{escape(itinerary["hero_heading"])}</h1>
        <p class="hero-text">{escape(itinerary["hero_text"])}</p>
        <div class="hero-actions">
          <a href="#days" class="button button-primary">Browse Daily Route</a>
          <a href="#destinations" class="button button-secondary">See All Destinations</a>
        </div>
      </div>
      <aside class="hero-panel">
        <h2>Trip Snapshot</h2>
        <ul class="snapshot-list">
          {snapshot}
        </ul>
      </aside>
    </header>

    <main>
      <section class="section intro-grid" id="overview">
        {intro_cards}
      </section>

      <section class="section" id="destinations">
        <div class="section-heading">
          <p class="eyebrow">All Stops</p>
          <h2>Overall Destinations</h2>
        </div>
        <div class="destination-grid">
          {destination_cards}
        </div>
      </section>

      <section class="section days-section" id="days">
        <div class="section-heading">
          <p class="eyebrow">Daily Route</p>
          <h2>Browse each day</h2>
        </div>

        <div class="days-layout">
          <nav class="day-nav" aria-label="Itinerary days" role="tablist">
            {day_tabs}
          </nav>

          <div class="day-panels">
            {day_panels}
          </div>
        </div>
      </section>
    </main>
  </div>

  <script src="../script.js"></script>
</body>
</html>
"""


def render_intro_card(card: dict[str, Any]) -> str:
    accent_class = " accent" if card.get("accent") else ""
    return f"""
        <article class="card{accent_class}">
          <h2>{escape(card.get("title", ""))}</h2>
          <p>{escape(card.get("text", ""))}</p>
        </article>
"""


def render_destination_card(card: dict[str, Any]) -> str:
    link_html = ""
    if card.get("link_href"):
        link_html = (
            f'<a class="destination-link" href="{escape(card["link_href"])}" '
            'target="_blank" rel="noreferrer">'
            f'{escape(card.get("link_label") or "Travel info")}</a>'
        )

    return f"""
          <article class="destination-card" id="{escape(card.get('id', ''))}" tabindex="-1">
            <span class="tag">{escape(card.get("tag", "Destination"))}</span>
            <h3>{escape(card.get("title", ""))}</h3>
            <p>{escape(card.get("text", ""))}</p>
            {link_html}
          </article>
"""


def render_day_tab(index: int, day: dict[str, Any]) -> str:
    active = " active" if index == 1 else ""
    selected = "true" if index == 1 else "false"
    return f"""
            <a class="day-tab{active}" data-day="day{index}" href="#day{index}" role="tab" aria-controls="day{index}" aria-selected="{selected}">
              <span class="day-tab-date">{escape(day.get("date_short", f"Day {index}"))}</span>
              <span class="day-tab-title">{escape(day.get("tab_title", day.get("title", f"Day {index}")))}</span>
            </a>
"""


def render_day_panel(index: int, day: dict[str, Any]) -> str:
    active = " active" if index == 1 else ""
    hidden = "" if index == 1 else " hidden"
    stops = "".join(render_stop(stop) for stop in day.get("stops", []))
    day_links = "".join(
        render_route_link(link)
        for link in day.get("route_links", [])
        if link.get("href")
    )
    day_links_html = f'<div class="route-links day-route-links">{day_links}</div>' if day_links else ""
    return f"""
            <article class="day-panel{active}" id="day{index}" role="tabpanel"{hidden}>
              <div class="day-header">
                <div>
                  <p class="eyebrow">{escape(day.get("full_date", day.get("date_short", f"Day {index}")))}</p>
                  <h3>{escape(day.get("title", day.get("tab_title", f"Day {index}")))}</h3>
                </div>
                <span class="route-pill">{escape(day.get("pill", "Daily route"))}</span>
              </div>
              <p class="day-summary">{render_rich_text(day.get("summary", ""), day.get("destination_links", {}))}</p>
              {day_links_html}
              <div class="timeline">
                {stops}
              </div>
            </article>
"""


def render_stop(stop: dict[str, Any]) -> str:
    links = "".join(
        render_route_link(link)
        for link in stop.get("links", [])
        if link.get("href")
    )
    meta_html = f'<p class="meta">{render_rich_text(stop.get("meta", ""), stop.get("destination_links", {}))}</p>' if stop.get("meta") else ""
    links_html = f'<div class="route-links">{links}</div>' if links else ""
    return f"""
                <article class="timeline-item">
                  <h4>{render_rich_text(stop.get("heading", ""), stop.get("destination_links", {}))}</h4>
                  <p>{render_rich_text(stop.get("text", ""), stop.get("destination_links", {}))}</p>
                  {meta_html}
                  {links_html}
                </article>
"""


def render_route_link(link: dict[str, str]) -> str:
    apple_attr = f' data-apple-href="{escape(link["apple_href"])}"' if link.get("apple_href") else ""
    google_attr = f' data-google-href="{escape(link["href"])}"' if link.get("href") else ""
    return (
        f'<a class="route-link" href="{escape(link["href"])}"{apple_attr}{google_attr} rel="noreferrer">'
        f'{escape(link["label"])}</a>'
    )


def infer_trip_name(itinerary: dict[str, Any], source_path: Path) -> str:
    for candidate in (
        itinerary.get("title"),
        itinerary.get("hero_heading"),
        source_path.stem,
    ):
        if candidate:
            return candidate
    return source_path.stem


def infer_duration(itinerary: dict[str, Any]) -> str:
    days = itinerary.get("days", [])
    if days:
        return f"{len(days)} days"
    return "Itinerary"


def infer_description(itinerary: dict[str, Any]) -> str:
    hero_text = itinerary.get("hero_text", "").strip()
    if hero_text:
        return hero_text
    first_destination = first(itinerary.get("destinations", []))
    if first_destination:
        return first_destination.get("text", "")
    return "Browsable trip overview with destinations and route planning."


def infer_coverage(itinerary: dict[str, Any]) -> str:
    title = itinerary.get("trip_name", "")
    if "spain" in title.lower():
        return "Spain"
    if "barcelona" in title.lower() and "seville" not in title.lower():
        return "Barcelona"
    if "granada" in title.lower() or "seville" in title.lower():
        return "Granada + Seville"
    return "Itinerary"


def parse_key_value_bullets(lines: list[str]) -> dict[str, str]:
    result = {}
    for line in lines:
        match = re.match(r"^\s*-\s*([^:]+):\s*(.+?)\s*$", line)
        if match:
            result[match.group(1).strip().lower()] = match.group(2).strip()
    return result


def parse_bullets(lines: list[str]) -> list[str]:
    bullets = []
    for line in lines:
        match = re.match(r"^\s*-\s*(.+?)\s*$", line)
        if match:
            bullets.append(match.group(1).strip())
    return bullets


def source_extension_label(filename: str) -> str:
    return Path(filename).suffix.replace(".", "").upper() or "FILE"


def normalize_text(value: str) -> str:
    value = repair_mojibake(value)
    value = value.replace("\xa0", " ")
    value = re.sub(r"(?<=[A-Za-z]{2}\s\d{3})(?=\d{1,2}:\d{2}\s*(?:am|pm)\s+[—-])", " ", value)
    value = re.sub(r"(?<=[a-zÀ-ÿ\)])(?=[A-ZÀ-Ý])", " ", value)
    value = value.replace("â€¢", "•")
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def repair_mojibake(value: str) -> str:
    if not any(marker in value for marker in ("Ã", "â", "Â")):
        return value

    try:
        repaired = value.encode("latin-1").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return value

    return repaired


def text_or_default(node: Any, xpath: str) -> str:
    result = node.xpath(xpath)
    if not result:
        return ""
    first_result = result[0]
    if isinstance(first_result, str):
        return first_result
    return first_result.text_content()


def first(items: list[Any]) -> Any:
    return items[0] if items else None


def extract_docx_paragraphs(path: Path) -> list[str]:
    return [item["text"] for item in extract_docx_paragraph_data(path)]


def extract_docx_paragraph_data(path: Path) -> list[dict[str, Any]]:
    with zipfile.ZipFile(path) as archive:
        document_xml = archive.read("word/document.xml")
        rels_xml = archive.read("word/_rels/document.xml.rels")

    rel_root = etree.fromstring(rels_xml)
    relationships = {
        rel.get("Id"): rel.get("Target")
        for rel in rel_root.xpath("//rel:Relationship", namespaces=REL_NS)
        if "hyperlink" in (rel.get("Type") or "")
    }

    document_root = etree.fromstring(document_xml)
    paragraphs: list[dict[str, Any]] = []
    for paragraph in document_root.xpath("//w:body/w:p", namespaces=WORD_NS):
        parts = []
        links = []
        for child in paragraph:
            tag = etree.QName(child).localname
            if tag == "hyperlink":
                rel_id = child.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
                text = normalize_text("".join(child.xpath(".//w:t/text()", namespaces=WORD_NS)).strip())
                href = relationships.get(rel_id, "")
                if text:
                    parts.append(f"{text} ({href})" if href else text)
                    if href:
                        links.append({"text": text, "href": href})
            elif tag == "r":
                text = "".join(child.xpath(".//w:t/text()", namespaces=WORD_NS))
                if text:
                    parts.append(text)
                if child.xpath(".//w:br", namespaces=WORD_NS):
                    parts.append("\n")

        combined = normalize_text("".join(parts).replace("\n ", "\n"))
        if combined:
            paragraphs.append({"text": combined, "links": links})
    return paragraphs


def extract_docx_link_lookup(path: Path) -> dict[str, str]:
    lookup: dict[str, str] = {}
    for paragraph in extract_docx_paragraph_data(path):
        for link in paragraph.get("links", []):
            text = normalize_text(link.get("text", ""))
            href = link.get("href", "")
            if text and href:
                lookup[text] = href
    return lookup


def split_compound_details(value: str) -> list[str]:
    labels = ["Dates:", "Hotel:", "Arrival:", "Departure:"]
    pieces = []
    for index, label in enumerate(labels):
        start = value.find(label)
        if start == -1:
            continue
        next_positions = [value.find(other, start + len(label)) for other in labels[index + 1 :] if value.find(other, start + len(label)) != -1]
        end = min(next_positions) if next_positions else len(value)
        pieces.append(normalize_text(value[start:end]))
    return pieces or [value]


def parse_barcelona_day_block(block: list[str]) -> dict[str, Any]:
    heading = block[0]
    match = DAY_HEADING_RE.match(heading)
    if not match:
        return {"full_date": heading, "title": heading, "summary": "", "stops": []}

    weekday, month_day, title = match.groups()
    year = "2026"
    full_date = f"{weekday}, {month_day}, {year}"
    date_short = month_day

    lines = block[1:]
    theme_text = ""
    if lines[:2] and lines[0] == "Theme":
        theme_text = lines[1]
        lines = lines[2:]

    stops = parse_barcelona_stops(lines)
    pill = infer_barcelona_day_pill(title)
    tab_title = shorten_day_title(title)
    summary = theme_text or (stops[0]["text"] if stops else "")

    return {
        "date_short": date_short,
        "tab_title": tab_title,
        "full_date": full_date,
        "title": title,
        "pill": pill,
        "summary": summary,
        "stops": stops,
    }


def parse_barcelona_stops(lines: list[str]) -> list[dict[str, Any]]:
    section_headers = {
        "Morning",
        "Afternoon",
        "Late morning / lunch",
        "Late lunch",
        "Lunch recommendation",
        "Dinner recommendation",
        "Afternoon museum plan",
        "Final dinner recommendation",
        "Optional Sitges Swap for Wednesday, May 20",
        "Sitges day plan",
        "Tradeoff",
        "Revised reservation priorities",
        "Book these first:",
        "Restaurant reservations:",
        "Choose one:",
        "After Park Güell, choose one:",
        "Early evening walk from hotel",
        "Avoid Sunday",
    }

    stops: list[dict[str, Any]] = []
    current_heading = "Plan"
    current_lines: list[str] = []

    def flush() -> None:
        nonlocal current_heading, current_lines
        if not current_lines:
            return
        text = " ".join(current_lines[:4])
        meta = " ".join(current_lines[4:]) if len(current_lines) > 4 else ""
        stops.append({"heading": current_heading, "text": text, "meta": meta, "links": []})
        current_lines = []

    for line in lines:
        if line in section_headers or re.match(r"^Option [A-Z0-9]+:", line):
            flush()
            current_heading = line
            continue
        current_lines.append(line)

    flush()
    return stops


def parse_spain_trip_day_block(block: list[str]) -> dict[str, Any]:
    heading = block[0]
    match = SPAIN_DAY_HEADING_RE.match(heading)
    if not match:
        return {"full_date": heading, "title": heading, "summary": "", "stops": []}

    month_day, weekday, title = match.groups()
    lines = []
    for line in block[1:]:
        lines.extend(split_spain_day_line(line))

    stops = parse_spain_trip_stops(lines)
    summary_stop = first(
        [stop for stop in stops if stop.get("heading") not in {"Plan detail", "Book these first", "Booking priorities"}]
    ) or first(stops)
    return {
        "date_short": month_day,
        "tab_title": shorten_spain_day_title(title),
        "full_date": f"{weekday}, {month_day}, 2026",
        "title": title,
        "pill": infer_spain_day_pill(title),
        "summary": summary_stop["text"] if summary_stop else "",
        "stops": stops,
    }


def split_spain_day_line(line: str) -> list[str]:
    expanded = normalize_text(line)
    expanded = re.sub(r"(?<=[A-Za-z]{2}\s\d{3}) (?=\d{1,2}:\d{2}\s*(?:am|pm)\s+[—-])", "\n", expanded)
    expanded = TIME_SPLIT_RE.sub("\n", expanded)
    expanded = LABEL_SPLIT_RE.sub("\n", expanded)
    expanded = expanded.replace("Optional —", "\nOptional —")
    return [part.strip() for part in expanded.splitlines() if part.strip()]


def parse_spain_trip_stops(lines: list[str]) -> list[dict[str, Any]]:
    stops: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None

    def flush() -> None:
        nonlocal current
        if current and (current.get("text") or current.get("meta")):
            stops.append(current)
        current = None

    for line in lines:
        parsed = classify_spain_stop_line(line)
        if parsed["kind"] == "heading_only":
            flush()
            current = {"heading": parsed["heading"], "text": "", "meta": "", "links": []}
            continue

        if parsed["kind"] == "new_stop":
            flush()
            current = {"heading": parsed["heading"], "text": parsed["text"], "meta": "", "links": []}
            continue

        if current is None:
            current = {"heading": "Plan detail", "text": parsed["text"], "meta": "", "links": []}
            continue

        if not current["text"]:
            current["text"] = parsed["text"]
        else:
            current["meta"] = f"{current['meta']} {parsed['text']}".strip()

    flush()
    return stops


def classify_spain_stop_line(line: str) -> dict[str, str]:
    heading_only_labels = {"Suggested structure:", "Morning options:", "Book these first:", "Booking priorities"}
    if line in heading_only_labels:
        return {"kind": "heading_only", "heading": line.rstrip(":")}

    for prefix, heading in (
        ("Lunch:", "Lunch"),
        ("Dinner:", "Dinner"),
        ("Dinner in Seville:", "Dinner"),
        ("Airport:", "Airport"),
        ("Alternative:", "Alternative"),
    ):
        if line.startswith(prefix):
            return {"kind": "new_stop", "heading": heading, "text": line[len(prefix):].strip()}

    if " — " in line:
        heading, text = line.split(" — ", 1)
        if not text.strip():
            return {"kind": "heading_only", "heading": heading.strip()}
        return {"kind": "new_stop", "heading": heading.strip(), "text": text.strip()}

    if line.endswith(":"):
        return {"kind": "heading_only", "heading": line.rstrip(":")}

    return {"kind": "continuation", "text": line}


def infer_barcelona_day_pill(title: str) -> str:
    title_lower = title.lower()
    if "arrival" in title_lower:
        return "Arrival + nearby walk"
    if "shopping" in title_lower:
        return "Park + shopping day"
    if "fly to granada" in title_lower:
        return "Departure day"
    if "sagrada" in title_lower:
        return "Timed-entry anchor"
    if "museum" in title_lower:
        return "Booked highlights"
    return "Updated daily plan"


def infer_spain_day_pill(title: str) -> str:
    title_lower = title.lower()
    if "arrive barcelona" in title_lower or "arrive granada" in title_lower:
        return "Arrival day"
    if "train to seville" in title_lower:
        return "Transfer day"
    if "fly to barcelona" in title_lower:
        return "Departure day"
    if "tossa de mar" in title_lower:
        return "Full-day excursion"
    if "alhambra" in title_lower or "alcázar" in title_lower:
        return "Major monument day"
    return "Daily route"


def shorten_day_title(title: str) -> str:
    replacements = {
        "Palau de la Música": "Palau + El Born",
        "Casa Batlló + Casa Milà + International Museum Day": "Gaudí + Museum Day",
        "Park Güell + Half-Day Shopping + Boquería Option": "Park Güell + Shopping",
        "Arrival + Light Gothic Quarter Walk": "Arrival + Gothic Quarter",
    }
    return replacements.get(title, title)


def shorten_spain_day_title(title: str) -> str:
    replacements = {
        "Arrive Barcelona + Gothic Quarter evening": "Arrival + Gothic Quarter",
        "Picasso Museum + El Born + Palau de la Música": "Picasso + El Born",
        "Casa Milà + Casa Batlló + Park Güell": "Gaudí + Park Güell",
        "MNAC + Sagrada Família + Sant Pau area": "MNAC + Sagrada Família",
        "Full-day Tossa de Mar": "Tossa de Mar",
        "Arrive Granada + Cathedral area + Albaicín sunset": "Arrival in Granada",
        "Granada morning + train to Seville": "Granada to Seville",
        "Alcázar + Santa Cruz + Cathedral/Giralda + Las Setas": "Alcázar + Cathedral",
        "Plaza de España + María Luisa Park + palace/Triana + flamenco": "Plaza + Triana",
        "Easy Seville morning + fly to Barcelona": "Seville + flight back",
    }
    return replacements.get(title, title)


def build_barcelona_destinations(days: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen = set()
    destinations = []
    available_titles = []
    for item in BARCELONA_DESTINATION_OVERRIDES:
        if destination_referenced(item, days):
            card = {
                "title": item["title"],
                "tag": item["tag"],
                "text": item["text"],
                "link_label": "Travel info",
                "link_href": item["link_href"],
                "aliases": item["aliases"],
            }
            destinations.append(card)
            seen.add(item["title"])
            available_titles.extend(item["aliases"])

    return destinations


def build_spain_destinations(days: list[dict[str, Any]], source_links: dict[str, str]) -> list[dict[str, Any]]:
    destinations = []
    for item in SPAIN_DESTINATION_OVERRIDES:
        if destination_referenced(item, days):
            matching_links = [source_links.get(alias) for alias in item.get("aliases", []) if source_links.get(alias)]
            link_href = first(matching_links) or item["link_href"]
            destinations.append(
                {
                    "title": item["title"],
                    "tag": item["tag"],
                    "text": item["text"],
                    "link_label": "Travel info",
                    "link_href": link_href,
                    "aliases": item["aliases"],
                }
            )
    return destinations


def destination_referenced(item: dict[str, Any], days: list[dict[str, Any]]) -> bool:
    haystack_parts = [day.get("summary", "") for day in days]
    haystack_parts.extend(stop.get("heading", "") for day in days for stop in day.get("stops", []))
    haystack_parts.extend(stop.get("text", "") for day in days for stop in day.get("stops", []))
    haystack_parts.extend(stop.get("meta", "") for day in days for stop in day.get("stops", []))
    haystack = " ".join(haystack_parts)
    return any(alias in haystack for alias in item.get("aliases", []))


def prepare_destination_linking(itinerary: dict[str, Any]) -> None:
    lookup = {}
    map_queries = {}
    for destination in itinerary.get("destinations", []):
        destination_id = f"destination-{slugify(destination['title'])}"
        destination["id"] = destination_id
        destination["aliases"] = destination.get("aliases") or [destination["title"]]
        destination["map_query"] = destination.get("map_query") or build_default_map_query(destination)
        for alias in destination["aliases"]:
            lookup[alias] = destination_id
            map_queries[alias] = destination["map_query"]

    itinerary["destination_lookup"] = lookup
    itinerary["destination_map_queries"] = map_queries
    for day in itinerary.get("days", []):
        day["destination_links"] = lookup
        day["destination_map_queries"] = map_queries
        for stop in day.get("stops", []):
            stop["destination_links"] = lookup
            stop["destination_map_queries"] = map_queries

    enrich_route_links(itinerary)


def build_default_map_query(destination: dict[str, Any]) -> str:
    title = destination.get("title", "")
    tag = destination.get("tag", "")
    context = MAP_CONTEXT_BY_TAG.get(tag)
    if not context:
        return destination.get("aliases", [title])[0]
    if context.lower() in title.lower():
        return title
    return f"{title}, {context}"


def enrich_route_links(itinerary: dict[str, Any]) -> None:
    for day in itinerary.get("days", []):
        if not day.get("route_links"):
            day_queries = extract_map_queries_from_day(day)
            inferred = build_map_links(day_queries, "Open day route", "Open day map")
            if inferred:
                day["route_links"] = inferred

        for stop in day.get("stops", []):
            if stop.get("heading") in {"Plan detail", "Book these first", "Booking priorities"}:
                continue
            if stop.get("links"):
                continue
            stop_queries = extract_map_queries_from_stop(stop)
            inferred = build_map_links(stop_queries, "Open route segment", "Open stop map")
            if inferred:
                stop["links"] = inferred


def extract_map_queries_from_day(day: dict[str, Any]) -> list[str]:
    texts = [day.get("summary", "")]
    for stop in day.get("stops", []):
        if stop.get("heading") in {"Plan detail", "Book these first", "Booking priorities"}:
            continue
        texts.extend([stop.get("heading", ""), stop.get("text", ""), stop.get("meta", "")])
    return extract_map_queries(texts, day.get("destination_map_queries", {}))


def extract_map_queries_from_stop(stop: dict[str, Any]) -> list[str]:
    texts = [stop.get("heading", ""), stop.get("text", ""), stop.get("meta", "")]
    return extract_map_queries(texts, stop.get("destination_map_queries", {}))


def extract_map_queries(texts: list[str], alias_to_query: dict[str, str]) -> list[str]:
    aliases = sorted(alias_to_query.keys(), key=len, reverse=True)
    if not aliases:
        return []

    pattern = re.compile("|".join(re.escape(alias) for alias in aliases))
    ordered: list[str] = []
    seen = set()
    for text in texts:
        if not text:
            continue
        for match in pattern.finditer(text):
            query = alias_to_query.get(match.group(0))
            if query and query not in seen:
                seen.add(query)
                ordered.append(query)
    return ordered


def build_map_links(queries: list[str], multi_label: str, single_label: str) -> list[dict[str, str]]:
    if len(queries) >= 2:
        return [
            {
                "label": multi_label,
                "href": build_google_maps_directions_url(queries),
                "apple_href": build_apple_maps_directions_url(queries),
            }
        ]
    if len(queries) == 1:
        return [
            {
                "label": single_label,
                "href": build_google_maps_search_url(queries[0]),
                "apple_href": build_apple_maps_search_url(queries[0]),
            }
        ]
    return []


def build_google_maps_search_url(query: str) -> str:
    return f"https://www.google.com/maps/search/?api=1&query={quote_plus(query)}"


def build_google_maps_directions_url(queries: list[str]) -> str:
    route_points = queries[:9]
    if len(route_points) < 2:
        return build_google_maps_search_url(route_points[0]) if route_points else ""

    origin = quote_plus(route_points[0])
    destination = quote_plus(route_points[-1])
    url = f"https://www.google.com/maps/dir/?api=1&travelmode=walking&origin={origin}&destination={destination}"
    if len(route_points) > 2:
        # Use an encoded separator so Safari on iPhone treats the full waypoint list as one query value.
        waypoints = "%7C".join(quote_plus(point) for point in route_points[1:-1])
        url += f"&waypoints={waypoints}"
    return url


def build_apple_maps_search_url(query: str) -> str:
    return f"https://maps.apple.com/?q={quote_plus(query)}"


def build_apple_maps_directions_url(queries: list[str]) -> str:
    route_points = queries[:9]
    if len(route_points) < 2:
        return build_apple_maps_search_url(route_points[0]) if route_points else ""

    origin = quote_plus(route_points[0])
    destination = quote_plus(route_points[-1])
    return f"https://maps.apple.com/?saddr={origin}&daddr={destination}&dirflg=w"


def render_rich_text(text: str, lookup: dict[str, str]) -> str:
    if not text:
        return ""
    return linkify_destination_mentions(text, lookup)


def linkify_destination_mentions(text: str, lookup: dict[str, str]) -> str:
    aliases = sorted(lookup.keys(), key=len, reverse=True)
    if not aliases:
        return escape(text)

    pattern = re.compile("|".join(re.escape(alias) for alias in aliases))
    result = []
    last_index = 0
    for match in pattern.finditer(text):
        start, end = match.span()
        if start < last_index:
            continue
        result.append(escape(text[last_index:start]))
        alias = match.group(0)
        target = lookup.get(alias)
        result.append(
            f'<a class="inline-destination-link" href="#{escape(target)}" data-destination-target="{escape(target)}">{escape(alias)}</a>'
        )
        last_index = end
    result.append(escape(text[last_index:]))
    return "".join(result)


def main() -> None:
    manifest = load_manifest()
    PAGES_DIR.mkdir(exist_ok=True)

    itineraries = []
    for source_path in supported_sources():
        entry = manifest.get(source_path.name)
        itinerary = build_itinerary(source_path, entry)
        itineraries.append(itinerary)

    index_html = render_index(itineraries)
    (ROOT / "index.html").write_text(index_html, encoding="utf-8")

    for itinerary in itineraries:
        output_path = PAGES_DIR / f"{itinerary['slug']}.html"
        output_path.write_text(render_itinerary_page(itinerary), encoding="utf-8")

    print(f"Generated {len(itineraries)} itinerary pages.")


if __name__ == "__main__":
    main()
