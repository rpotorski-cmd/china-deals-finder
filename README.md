# China Deals Finder

Automat do wyszukiwania okazji z chińskich platform (AliExpress, Temu) z webowym interfejsem do przeglądania wyników.

## Funkcje

- **Scraper** — automatycznie zbiera okazje z AliExpress i Temu (headless Selenium)
- **Strona WWW** — nowoczesny dark-mode UI do przeglądania okazji
- **Filtrowanie** — po platformie, kategorii, min. rabacie
- **Sortowanie** — po rabacie, cenie, popularności, ocenie
- **Wyszukiwarka** — szybkie wyszukiwanie po nazwie produktu
- **Statystyki** — podsumowanie: liczba okazji, śr. rabat, najlepszy rabat, śr. cena

## Wymagania

- **Node.js** >= 18
- **Python** >= 3.10
- **Google Chrome** (dla scrapera)

## Instalacja

```bash
# Frontend
npm install

# Scraper
pip install -r scraper/requirements.txt
```

## Użycie (najprostszy sposób)

### 1. Uruchom serwer API (w jednym terminalu)

```bash
python3 scraper/server.py
```

### 2. Uruchom stronę WWW (w drugim terminalu)

```bash
npm run dev
```

### 3. Otwórz http://localhost:5173

Wpisz czego szukasz (np. "mini pc", "słuchawki bluetooth") i kliknij **Szukaj okazji**. Scraper automatycznie pobierze okazje z AliExpress i Temu.

---

## Użycie z terminala (alternatywnie)

```bash
# Szukaj konkretnych produktów
python3 scraper/scraper.py --categories "mini pc" "słuchawki bluetooth"

# Tylko z AliExpress
python3 scraper/scraper.py --categories "drone" --sources aliexpress

# Tylko z Temu
python3 scraper/scraper.py --categories "led strip" --sources temu
```

Scraper zapisuje wyniki do `public/deals.json`. Po uruchomieniu odśwież stronę.

## Struktura projektu

```
china-deals-finder/
├── scraper/
│   ├── scraper.py          # Główny skrypt scrapera
│   ├── server.py           # Serwer API (Flask) - szukanie z przeglądarki
│   ├── config.py           # Konfiguracja (URLe, kategorie, limity)
│   └── requirements.txt    # Zależności Pythona
├── src/
│   ├── App.tsx             # Główna aplikacja React
│   └── App.css             # Style
├── public/
│   └── deals.json          # Dane okazji (generowane przez scraper)
└── package.json
```

## Technologie

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Scraper**: Python + Selenium (headless Chrome) + BeautifulSoup
- **Ikony**: Lucide React
