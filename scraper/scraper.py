#!/usr/bin/env python3
"""
China Deals Finder - Scraper
Scrapes deals from AliExpress and Temu using headless Selenium.
"""

import json
import os
import random
import re
import sys
import time
from datetime import datetime, timezone
from typing import Optional

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from selenium.common.exceptions import (
    TimeoutException,
    NoSuchElementException,
    StaleElementReferenceException,
    WebDriverException,
)

from config import (
    OUTPUT_PATH,
    REQUEST_DELAY,
    PAGE_LOAD_TIMEOUT,
    MAX_PRODUCTS_PER_SOURCE,
    USER_AGENTS,
    SEARCH_CATEGORIES,
)


def create_driver() -> webdriver.Chrome:
    """Create a headless Chrome WebDriver instance."""
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)

    user_agent = random.choice(USER_AGENTS)
    options.add_argument(f"--user-agent={user_agent}")

    driver = webdriver.Chrome(options=options)
    driver.execute_cdp_cmd(
        "Page.addScriptToEvaluateOnNewDocument",
        {
            "source": """
                Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
                Object.defineProperty(navigator, 'languages', {get: () => ['en-US', 'en', 'pl']});
                Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]});
            """
        },
    )
    driver.set_page_load_timeout(PAGE_LOAD_TIMEOUT)
    return driver


def random_delay(min_sec: Optional[float] = None, max_sec: Optional[float] = None):
    """Wait a random amount of time to mimic human behavior."""
    min_s = min_sec if min_sec is not None else REQUEST_DELAY[0]
    max_s = max_sec if max_sec is not None else REQUEST_DELAY[1]
    time.sleep(random.uniform(min_s, max_s))


def parse_price(price_str: str) -> Optional[float]:
    """Extract numeric price from a string like '$12.99' or '12,99 zl'."""
    if not price_str:
        return None
    cleaned = re.sub(r"[^\d.,]", "", price_str)
    cleaned = cleaned.replace(",", ".")
    # Handle cases like "12.345.67" -> take last dot as decimal
    parts = cleaned.split(".")
    if len(parts) > 2:
        cleaned = "".join(parts[:-1]) + "." + parts[-1]
    try:
        return round(float(cleaned), 2)
    except (ValueError, TypeError):
        return None


def calculate_discount(original: Optional[float], current: Optional[float]) -> Optional[int]:
    """Calculate discount percentage."""
    if original and current and original > current > 0:
        return round((1 - current / original) * 100)
    return None


def scrape_aliexpress(driver: webdriver.Chrome, query: str) -> list[dict]:
    """Scrape AliExpress search results for a given query."""
    products = []
    url = f"https://www.aliexpress.com/wholesale?SearchText={query.replace(' ', '+')}&SortType=total_tranpro_desc"

    print(f"  [AliExpress] Searching: {query}")
    try:
        driver.get(url)
        random_delay(3, 6)

        # Scroll down to load more products
        for _ in range(3):
            driver.execute_script("window.scrollBy(0, 1000)")
            random_delay(1, 2)

        # Wait for product cards
        try:
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located(
                    (By.CSS_SELECTOR, "[class*='product-snippet'], [class*='search-item-card'], .search-card-item, a[href*='/item/']")
                )
            )
        except TimeoutException:
            print(f"  [AliExpress] Timeout waiting for results for '{query}'")
            return products

        # Try multiple selectors for product cards
        card_selectors = [
            "[class*='search-item-card']",
            "[class*='product-snippet']",
            ".search-card-item",
            "[class*='SearchProductFeed'] a[href*='/item/']",
            "div[class*='card--'] a[href*='/item/']",
        ]

        cards = []
        for selector in card_selectors:
            cards = driver.find_elements(By.CSS_SELECTOR, selector)
            if cards:
                break

        print(f"  [AliExpress] Found {len(cards)} product cards for '{query}'")

        for card in cards[:MAX_PRODUCTS_PER_SOURCE]:
            try:
                product = extract_aliexpress_product(card, query)
                if product and product.get("title"):
                    products.append(product)
            except (StaleElementReferenceException, NoSuchElementException):
                continue

    except WebDriverException as e:
        print(f"  [AliExpress] Error scraping '{query}': {e}")

    return products


def extract_aliexpress_product(card, query: str) -> Optional[dict]:
    """Extract product data from an AliExpress card element."""
    product = {
        "source": "AliExpress",
        "category": query,
        "scraped_at": datetime.now(timezone.utc).isoformat(),
    }

    # Title
    title_selectors = [
        "h1", "h3", "[class*='title']", "[class*='name']",
        "a[href*='/item/'] span", "a[href*='/item/']"
    ]
    for sel in title_selectors:
        try:
            el = card.find_element(By.CSS_SELECTOR, sel)
            text = el.text.strip()
            if text and len(text) > 5:
                product["title"] = text[:200]
                break
        except NoSuchElementException:
            continue

    if not product.get("title"):
        return None

    # URL
    try:
        link = card.find_element(By.CSS_SELECTOR, "a[href*='/item/']")
        href = link.get_attribute("href")
        if href:
            product["url"] = href if href.startswith("http") else f"https:{href}"
    except NoSuchElementException:
        try:
            link = card.find_element(By.TAG_NAME, "a")
            href = link.get_attribute("href")
            if href:
                product["url"] = href if href.startswith("http") else f"https:{href}"
        except NoSuchElementException:
            pass

    # Image
    try:
        img = card.find_element(By.TAG_NAME, "img")
        src = img.get_attribute("src") or img.get_attribute("data-src")
        if src:
            product["image"] = src if src.startswith("http") else f"https:{src}"
    except NoSuchElementException:
        pass

    # Prices
    price_selectors = [
        "[class*='price'] span", "[class*='price']",
        "[class*='Price']", "[class*='cost']"
    ]
    prices_found = []
    for sel in price_selectors:
        try:
            els = card.find_elements(By.CSS_SELECTOR, sel)
            for el in els:
                text = el.text.strip()
                price = parse_price(text)
                if price and price > 0:
                    prices_found.append(price)
        except NoSuchElementException:
            continue

    if prices_found:
        prices_found.sort()
        product["price"] = prices_found[0]
        if len(prices_found) > 1:
            product["original_price"] = prices_found[-1]
            product["discount"] = calculate_discount(prices_found[-1], prices_found[0])

    # Orders / rating
    try:
        text = card.text
        orders_match = re.search(r"([\d,.]+)\+?\s*(?:sold|orders|sprzedanych)", text, re.IGNORECASE)
        if orders_match:
            orders_str = orders_match.group(1).replace(",", "").replace(".", "")
            product["orders"] = int(orders_str) if orders_str.isdigit() else 0

        rating_match = re.search(r"(\d+\.?\d*)\s*(?:/\s*5|stars?|\u2605)", text, re.IGNORECASE)
        if rating_match:
            product["rating"] = float(rating_match.group(1))
    except Exception:
        pass

    return product


def scrape_temu(driver: webdriver.Chrome, query: str) -> list[dict]:
    """Scrape Temu search results for a given query."""
    products = []
    url = f"https://www.temu.com/search_result.html?search_key={query.replace(' ', '+')}&search_method=user"

    print(f"  [Temu] Searching: {query}")
    try:
        driver.get(url)
        random_delay(3, 6)

        # Scroll to load products
        for _ in range(3):
            driver.execute_script("window.scrollBy(0, 1000)")
            random_delay(1, 2)

        # Wait for product cards
        try:
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located(
                    (By.CSS_SELECTOR, "[class*='ProductList'], [class*='product-card'], [class*='goods-item']")
                )
            )
        except TimeoutException:
            print(f"  [Temu] Timeout waiting for results for '{query}'")
            return products

        # Try multiple selectors
        card_selectors = [
            "[class*='goods-item']",
            "[class*='product-card']",
            "[class*='ProductCard']",
            "div[data-testid*='product']",
        ]

        cards = []
        for selector in card_selectors:
            cards = driver.find_elements(By.CSS_SELECTOR, selector)
            if cards:
                break

        print(f"  [Temu] Found {len(cards)} product cards for '{query}'")

        for card in cards[:MAX_PRODUCTS_PER_SOURCE]:
            try:
                product = extract_temu_product(card, query)
                if product and product.get("title"):
                    products.append(product)
            except (StaleElementReferenceException, NoSuchElementException):
                continue

    except WebDriverException as e:
        print(f"  [Temu] Error scraping '{query}': {e}")

    return products


def extract_temu_product(card, query: str) -> Optional[dict]:
    """Extract product data from a Temu card element."""
    product = {
        "source": "Temu",
        "category": query,
        "scraped_at": datetime.now(timezone.utc).isoformat(),
    }

    # Title
    title_selectors = [
        "[class*='title']", "[class*='name']", "h3", "h2",
        "a span", "p"
    ]
    for sel in title_selectors:
        try:
            el = card.find_element(By.CSS_SELECTOR, sel)
            text = el.text.strip()
            if text and len(text) > 5:
                product["title"] = text[:200]
                break
        except NoSuchElementException:
            continue

    if not product.get("title"):
        return None

    # URL
    try:
        link = card.find_element(By.TAG_NAME, "a")
        href = link.get_attribute("href")
        if href:
            product["url"] = href if href.startswith("http") else f"https://www.temu.com{href}"
    except NoSuchElementException:
        pass

    # Image
    try:
        img = card.find_element(By.TAG_NAME, "img")
        src = img.get_attribute("src") or img.get_attribute("data-src")
        if src:
            product["image"] = src if src.startswith("http") else f"https:{src}"
    except NoSuchElementException:
        pass

    # Prices
    price_selectors = [
        "[class*='price'] span", "[class*='price']",
        "[class*='Price']"
    ]
    prices_found = []
    for sel in price_selectors:
        try:
            els = card.find_elements(By.CSS_SELECTOR, sel)
            for el in els:
                text = el.text.strip()
                price = parse_price(text)
                if price and price > 0:
                    prices_found.append(price)
        except NoSuchElementException:
            continue

    if prices_found:
        prices_found.sort()
        product["price"] = prices_found[0]
        if len(prices_found) > 1:
            product["original_price"] = prices_found[-1]
            product["discount"] = calculate_discount(prices_found[-1], prices_found[0])

    # Orders / rating from full text
    try:
        text = card.text
        sold_match = re.search(r"([\d,.]+[kK]?)\+?\s*(?:sold|bought|sprzedanych)", text, re.IGNORECASE)
        if sold_match:
            sold_str = sold_match.group(1).lower().replace(",", "")
            if "k" in sold_str:
                product["orders"] = int(float(sold_str.replace("k", "")) * 1000)
            else:
                product["orders"] = int(float(sold_str))

        rating_match = re.search(r"(\d+\.?\d*)\s*(?:/\s*5|stars?|\u2605)", text, re.IGNORECASE)
        if rating_match:
            product["rating"] = float(rating_match.group(1))
    except Exception:
        pass

    return product


def deduplicate(products: list[dict]) -> list[dict]:
    """Remove duplicate products based on title similarity."""
    seen_titles = set()
    unique = []
    for p in products:
        title_key = re.sub(r"\s+", " ", p.get("title", "").lower().strip())[:80]
        if title_key not in seen_titles:
            seen_titles.add(title_key)
            unique.append(p)
    return unique


def run_scraper(
    categories: Optional[list[str]] = None,
    sources: Optional[list[str]] = None,
) -> list[dict]:
    """Run the full scraping pipeline."""
    if categories is None:
        categories = SEARCH_CATEGORIES
    if sources is None:
        sources = ["aliexpress", "temu"]

    all_products = []
    driver = None

    try:
        print("Starting Chrome driver (headless)...")
        driver = create_driver()
        print("Chrome driver ready.\n")

        for category in categories:
            print(f"--- Category: {category} ---")

            if "aliexpress" in sources:
                products = scrape_aliexpress(driver, category)
                all_products.extend(products)
                print(f"  AliExpress: {len(products)} products")
                random_delay()

            if "temu" in sources:
                products = scrape_temu(driver, category)
                all_products.extend(products)
                print(f"  Temu: {len(products)} products")
                random_delay()

            print()

    except KeyboardInterrupt:
        print("\nScraping interrupted by user.")
    except Exception as e:
        print(f"\nError during scraping: {e}")
    finally:
        if driver:
            driver.quit()
            print("Chrome driver closed.")

    # Deduplicate
    unique_products = deduplicate(all_products)
    print(f"\nTotal products: {len(all_products)}, Unique: {len(unique_products)}")

    return unique_products


def save_results(products: list[dict], output_path: Optional[str] = None):
    """Save scraped products to JSON file."""
    path = output_path or OUTPUT_PATH
    os.makedirs(os.path.dirname(path), exist_ok=True)

    data = {
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "total_products": len(products),
        "products": products,
    }

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Results saved to: {path}")


def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="China Deals Finder - Scraper")
    parser.add_argument(
        "--categories",
        nargs="+",
        default=None,
        help="Categories to search (default: all)",
    )
    parser.add_argument(
        "--sources",
        nargs="+",
        choices=["aliexpress", "temu"],
        default=None,
        help="Sources to scrape (default: all)",
    )
    parser.add_argument(
        "--output",
        default=None,
        help=f"Output JSON file path (default: {OUTPUT_PATH})",
    )

    args = parser.parse_args()

    print("=" * 60)
    print("  China Deals Finder - Scraper")
    print("=" * 60)
    print(f"  Categories: {args.categories or SEARCH_CATEGORIES}")
    print(f"  Sources: {args.sources or ['aliexpress', 'temu']}")
    print(f"  Output: {args.output or OUTPUT_PATH}")
    print("=" * 60 + "\n")

    products = run_scraper(categories=args.categories, sources=args.sources)

    if products:
        save_results(products, args.output)
    else:
        print("No products found. Saving empty results.")
        save_results([], args.output)

    print("\nDone!")


if __name__ == "__main__":
    main()
