"""Configuration for the deals scraper."""

# Output path for scraped deals
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_PATH = os.path.join(BASE_DIR, "public", "deals.json")

# Scraping settings
REQUEST_DELAY = (2, 5)  # Random delay between requests (min, max) in seconds
PAGE_LOAD_TIMEOUT = 30  # Seconds to wait for page load
MAX_PRODUCTS_PER_SOURCE = 50  # Max products to scrape per source

# User agents for rotation
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]

# AliExpress URLs
ALIEXPRESS_URLS = [
    "https://www.aliexpress.com/gcp/300000556/xBhLiWmJBi",  # Super Deals
    "https://www.aliexpress.com/wholesale",  # General search
]

# Temu URLs
TEMU_URLS = [
    "https://www.temu.com/channel/best-sellers.html",
    "https://www.temu.com/channel/flash-sale.html",
]

# Domyślne kategorie do wyszukiwania (możesz dodać swoje)
SEARCH_CATEGORIES = [
    "electronics",
    "phone accessories",
    "smart home",
    "fashion",
    "beauty",
    "toys",
    "sports",
    "home decor",
]

# Przykłady własnych wyszukiwań (użyj --categories):
# python scraper/scraper.py --categories "słuchawki bluetooth" "etui na telefon" "smartwatch"
# python scraper/scraper.py --categories "drone" "led strip" "usb hub"
