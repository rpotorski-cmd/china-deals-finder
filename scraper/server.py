#!/usr/bin/env python3
"""
China Deals Finder - API Server
Flask server that allows the frontend to trigger scraper searches.
"""

import json
import os
import threading

from flask import Flask, jsonify, request
from flask_cors import CORS

from config import OUTPUT_PATH
from scraper import run_scraper, save_results

app = Flask(__name__)
CORS(app)

scraper_status = {
    "running": False,
    "query": "",
    "progress": "",
}


def run_scraper_thread(categories, sources):
    global scraper_status
    scraper_status["running"] = True
    scraper_status["query"] = ", ".join(categories)
    scraper_status["progress"] = "Uruchamiam scraper..."

    try:
        products = run_scraper(categories=categories, sources=sources)
        if products:
            save_results(products)
            scraper_status["progress"] = f"Gotowe! Znaleziono {len(products)} okazji."
        else:
            save_results([])
            scraper_status["progress"] = "Brak wyników."
    except Exception as e:
        scraper_status["progress"] = f"Błąd: {e}"
    finally:
        scraper_status["running"] = False


@app.route("/api/search", methods=["POST"])
def search():
    if scraper_status["running"]:
        return jsonify({"error": "Scraper już działa. Poczekaj na zakończenie."}), 409

    data = request.get_json()
    if not data or not data.get("query"):
        return jsonify({"error": "Brak frazy wyszukiwania."}), 400

    query = data["query"].strip()
    categories = [q.strip() for q in query.split(",") if q.strip()]
    sources = data.get("sources", ["aliexpress", "temu"])

    thread = threading.Thread(target=run_scraper_thread, args=(categories, sources))
    thread.daemon = True
    thread.start()

    return jsonify({"status": "started", "query": query})


@app.route("/api/status")
def status():
    return jsonify(scraper_status)


@app.route("/api/deals")
def deals():
    if not os.path.exists(OUTPUT_PATH):
        return jsonify({"products": [], "total_products": 0, "scraped_at": ""})

    with open(OUTPUT_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    return jsonify(data)


if __name__ == "__main__":
    print("=" * 50)
    print("  China Deals Finder - API Server")
    print("  http://localhost:5000")
    print("=" * 50)
    app.run(host="0.0.0.0", port=5000, debug=False)
