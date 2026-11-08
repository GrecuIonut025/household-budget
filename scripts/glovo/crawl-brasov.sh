
#!/usr/bin/env bash

set -Eeuo pipefail

# ============================================================
# GLOVO ROMANIA - CONTROLLED SUPERMARKET CATALOG CRAWLER
# Brașov (city code: brv) — Profi, Carrefour, Kaufland, Mega Image
#
# Session headers expire. Prefer env overrides (see .env.example):
#   GLOVO_DEVICE_URN, GLOVO_DYNAMIC_SESSION_ID, GLOVO_PERSEUS_CLIENT_ID,
#   GLOVO_PERSEUS_SESSION_TIMESTAMP, GLOVO_DELIVERY_LOCATION_TIMESTAMP,
#   COOKIE / GLOVO_COOKIE, GLOVO_USER_AGENT, PYTHON / GLOVO_PYTHON
# ============================================================

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

# Load `.env.local` / `.env` into this shell (Next.js-like). Skip if node missing.
if command -v node >/dev/null 2>&1; then
  # shellcheck disable=SC1090
  eval "$(node "$ROOT/scripts/glovo/env-exports.mjs")"
fi

BASE_URL="${GLOVO_BASE_URL:-https://api.glovoapp.com}"

CITY_CODE="${GLOVO_CITY_CODE:-brv}"
COUNTRY_CODE="${GLOVO_COUNTRY_CODE:-ro}"
CATEGORY_ID="${GLOVO_CATEGORY_ID:-4}"

OUTPUT_DIR="${GLOVO_OUTPUT_DIR:-glovo_data}"
PYTHON="${GLOVO_PYTHON:-${PYTHON:-python3}}"

mkdir -p "$OUTPUT_DIR"

if ! command -v "$PYTHON" >/dev/null 2>&1; then
    echo "[ERROR] Python not found: $PYTHON (set GLOVO_PYTHON or PYTHON)"
    exit 1
fi

echo "[PYTHON] $("$PYTHON" --version)"

# ============================================================
# SESSION HEADERS
# Use a valid, authorized browser session. Override via env — do not
# commit fresh secrets; placeholders below are only for local smoke.
# ============================================================

USER_AGENT="${GLOVO_USER_AGENT:-Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1}"

DEVICE_URN="${GLOVO_DEVICE_URN:-glv:device:00000000-0000-0000-0000-000000000000}"
DYNAMIC_SESSION_ID="${GLOVO_DYNAMIC_SESSION_ID:-00000000-0000-0000-0000-000000000000}"
PERSEUS_CLIENT_ID="${GLOVO_PERSEUS_CLIENT_ID:-00000000-0000-0000-0000-000000000000}"
PERSEUS_SESSION_TIMESTAMP="${GLOVO_PERSEUS_SESSION_TIMESTAMP:-0}"
DELIVERY_LOCATION_TIMESTAMP="${GLOVO_DELIVERY_LOCATION_TIMESTAMP:-0}"

# Optional cookie (COOKIE or GLOVO_COOKIE).
COOKIE="${GLOVO_COOKIE:-${COOKIE:-}}"

export GLOVO_BASE_URL="$BASE_URL"
export GLOVO_CITY_CODE="$CITY_CODE"
export GLOVO_COUNTRY_CODE="$COUNTRY_CODE"
export GLOVO_CATEGORY_ID="$CATEGORY_ID"
export GLOVO_OUTPUT_DIR="$OUTPUT_DIR"

export GLOVO_USER_AGENT="$USER_AGENT"
export GLOVO_DEVICE_URN="$DEVICE_URN"
export GLOVO_DYNAMIC_SESSION_ID="$DYNAMIC_SESSION_ID"
export GLOVO_PERSEUS_CLIENT_ID="$PERSEUS_CLIENT_ID"
export GLOVO_PERSEUS_SESSION_TIMESTAMP="$PERSEUS_SESSION_TIMESTAMP"
export GLOVO_DELIVERY_LOCATION_TIMESTAMP="$DELIVERY_LOCATION_TIMESTAMP"
export GLOVO_COOKIE="$COOKIE"

echo
echo "============================================================"
echo "GLOVO SUPERMARKET CATALOG CRAWLER"
echo "============================================================"

"$PYTHON" - <<'PY'

import csv
import json
import os
import re
import subprocess
import sys
import time
import uuid
import hashlib

from pathlib import Path
from urllib.parse import urljoin
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime


# ============================================================
# CONFIGURATION
# ============================================================

BASE_URL = os.environ["GLOVO_BASE_URL"]
CITY_CODE = os.environ["GLOVO_CITY_CODE"]
COUNTRY_CODE = os.environ["GLOVO_COUNTRY_CODE"]
CATEGORY_ID = os.environ["GLOVO_CATEGORY_ID"]

OUTPUT_DIR = Path(os.environ["GLOVO_OUTPUT_DIR"])
RAW_DIR = OUTPUT_DIR / "raw"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
RAW_DIR.mkdir(parents=True, exist_ok=True)

# Controlled sequential requests.
REQUEST_DELAY = 3.0
MAX_RETRIES = 2
BACKOFF_BASE = 10
BACKOFF_MAX = 60

MAX_CATEGORIES_PER_STORE = 2000

LAST_REQUEST_AT = 0.0

TARGET_STORES = {
    "profi": "profi-brv",
    "carrefour": "carrefour-supermarket-brv",
    "kaufland": "kaufland-brv-bo",
    "mega_image": "mega-image-brv",
}

# ============================================================
# HEADERS
# ============================================================

HEADERS = [
    "accept: application/json, text/plain, */*",
    "accept-language: ro",
    "cache-control: no-cache",
    "content-type: application/json",
    "glovo-api-version: 14",
    "glovo-app-context: web",
    "glovo-app-development-state: prod",
    "glovo-app-platform: web",
    "glovo-app-type: customer",
    "glovo-app-version: v1.2927.0",
    "glovo-client-info: web-customer-web-react/v1.2927.0 project:customer-web",
    "glovo-delivery-location-accuracy: 0",
    f"glovo-delivery-location-timestamp: {os.environ['GLOVO_DELIVERY_LOCATION_TIMESTAMP']}",
    f"glovo-device-urn: {os.environ['GLOVO_DEVICE_URN']}",
    f"glovo-dynamic-session-id: {os.environ['GLOVO_DYNAMIC_SESSION_ID']}",
    "glovo-language-code: ro",
    f"glovo-location-city-code: {CITY_CODE}",
    f"glovo-location-country-code: {COUNTRY_CODE}",
    f"glovo-perseus-client-id: {os.environ['GLOVO_PERSEUS_CLIENT_ID']}",
    "glovo-perseus-consent: essential_functional_marketing",
    f"glovo-perseus-session-id: {os.environ['GLOVO_DYNAMIC_SESSION_ID']}",
    f"glovo-perseus-session-timestamp: {os.environ['GLOVO_PERSEUS_SESSION_TIMESTAMP']}",
    "glovo-request-ttl: 7500",
    "origin: https://glovoapp.com",
    "pragma: no-cache",
    "referer: https://glovoapp.com/",
    f"user-agent: {os.environ['GLOVO_USER_AGENT']}",
]

if os.environ.get("GLOVO_COOKIE"):
    HEADERS.append(f"cookie: {os.environ['GLOVO_COOKIE']}")


# ============================================================
# HELPERS
# ============================================================

def log(message):
    print(message, flush=True)


def save_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    temporary = path.with_suffix(path.suffix + ".tmp")

    with temporary.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    temporary.replace(path)


def load_json(path, default=None):

    path = Path(path)

    if not path.exists():
        return default

    try:
        with path.open(encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return default


def safe_filename(value):
    return re.sub(r"[^a-zA-Z0-9_-]", "_", value)[:100]


def wait_between_requests():

    global LAST_REQUEST_AT

    elapsed = time.monotonic() - LAST_REQUEST_AT
    remaining = REQUEST_DELAY - elapsed

    if remaining > 0:
        log(f"[WAIT] {remaining:.1f}s")
        time.sleep(remaining)


# ============================================================
# HTTP REQUEST
# ============================================================

class RateLimitError(RuntimeError):
    pass


class AccessDeniedError(RuntimeError):
    pass


def request_json(url, method="GET", payload=None):

    global LAST_REQUEST_AT

    for attempt in range(1, MAX_RETRIES + 1):

        wait_between_requests()

        request_headers = [
            header for header in HEADERS
            if not header.lower().startswith("glovo-request-id:")
        ]

        request_headers.append(
            f"glovo-request-id: {uuid.uuid4()}"
        )

        command = [
            "curl",
            "-sS",
            "--connect-timeout", "15",
            "--max-time", "60",
            "-D", "-",
            "-o", "-",
            "-X", method,
            url,
        ]

        for header in request_headers:
            command.extend(["-H", header])

        if payload is not None:
            command.extend([
                "--data-raw",
                json.dumps(payload, separators=(",", ":"))
            ])

        command.extend([
            "-w",
            "\n__HTTP_STATUS__:%{http_code}"
        ])

        LAST_REQUEST_AT = time.monotonic()

        try:

            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=70
            )

        except subprocess.TimeoutExpired:

            log(f"[TIMEOUT] {url}")

            if attempt < MAX_RETRIES:

                wait = min(
                    BACKOFF_BASE * (2 ** (attempt - 1)),
                    BACKOFF_MAX
                )

                log(f"[BACKOFF] {wait}s")
                time.sleep(wait)
                continue

            return None

        output = result.stdout or ""

        marker = "\n__HTTP_STATUS__:"

        if marker not in output:

            log(f"[CURL ERROR] {result.stderr.strip()}")

            if attempt < MAX_RETRIES:
                time.sleep(BACKOFF_BASE)
                continue

            return None

        response, status = output.rsplit(marker, 1)

        try:
            status = int(status.strip())
        except ValueError:
            status = 0

        # Separate HTTP headers and response body.
        header_end = response.find("\r\n\r\n")

        if header_end >= 0:
            response_headers = response[:header_end]
            body = response[header_end + 4:]
        else:
            response_headers = ""
            body = response

        header_map = {}

        for line in response_headers.splitlines():

            if ":" not in line:
                continue

            key, value = line.split(":", 1)
            header_map[key.strip().lower()] = value.strip()

        if status == 200:

            try:
                data = json.loads(body)
                log("[HTTP 200]")
                return data

            except json.JSONDecodeError as exc:
                log(f"[INVALID JSON] {exc}")
                return None

        log(f"[HTTP {status}] {url}")

        if status == 429:

            retry_after = header_map.get("retry-after")

            log("[STOP] Rate limit reached.")

            if retry_after:
                log(f"[RETRY-AFTER] {retry_after}")

            raise RateLimitError(
                "HTTP 429 - execution stopped"
            )

        if status in (401, 403):

            raise AccessDeniedError(
                f"HTTP {status} - access denied"
            )

        if status in (0, 500, 502, 503, 504):

            if attempt < MAX_RETRIES:

                wait = min(
                    BACKOFF_BASE * (2 ** (attempt - 1)),
                    BACKOFF_MAX
                )

                log(f"[BACKOFF] {wait}s")
                time.sleep(wait)
                continue

        if result.stderr.strip():
            log(result.stderr.strip())

        return None

    return None


# ============================================================
# JSON WALKER
# ============================================================

def walk(obj):

    if isinstance(obj, dict):

        yield obj

        for value in obj.values():
            yield from walk(value)

    elif isinstance(obj, list):

        for item in obj:
            yield from walk(item)


# ============================================================
# STORE WALL
# ============================================================

def get_store_entries(data):

    return (
        data.get("data", {})
        .get("stores", {})
        .get("entries", [])
    )


def fetch_store_wall():

    cache = RAW_DIR / "store_wall.json"

    if cache.exists():

        log("[CACHE] Store Wall")

        return load_json(cache)

    url = (
        f"{BASE_URL}/v1/web/store_wall/category/{CATEGORY_ID}"
        "?moduleId=StoreFeeds&offset=0&limit=50"
        "&handlingType=DELIVERY"
    )

    payload = {
        "filters": [
            {
                "filterId": "ADMIN_FILTERS",
                "filterAttributeIds": ["35369"]
            }
        ],
        "previousStoreIds": []
    }

    data = request_json(
        url,
        method="POST",
        payload=payload
    )

    if data is None:
        raise RuntimeError("Cannot retrieve Store Wall")

    save_json(cache, data)

    return data


# ============================================================
# STORE DISCOVERY
# ============================================================

def discover_stores(store_wall):

    stores = {}

    for entry in get_store_entries(store_wall):

        slug = entry.get("slug")

        for retailer, expected_slug in TARGET_STORES.items():

            if slug != expected_slug:
                continue

            metadata = entry.get("metadata") or {}

            store_id = entry.get("id")
            address_id = metadata.get("storeAddressId")

            if store_id is None or address_id is None:
                continue

            stores[retailer] = {
                "retailer": retailer,
                "name": entry.get("title"),
                "slug": slug,
                "store_id": str(store_id),
                "address_id": str(address_id),
                "rating": (
                    entry.get("ratings") or {}
                ).get("score"),
                "eta": entry.get("eta"),
                "availability": (
                    entry.get("availability") or {}
                ).get("status"),
                "has_in_store_prices": (
                    entry.get("inStorePrices") or {}
                ).get("hasInStorePrices"),
            }

            log(
                f"[STORE] {retailer}: "
                f"{store_id}/{address_id}"
            )

    save_json(
        OUTPUT_DIR / "glovo_stores.json",
        stores
    )

    return stores


# ============================================================
# EAN EXTRACTION
# ============================================================

def extract_eans(node):

    values = set()

    for obj in walk(node):

        if not isinstance(obj, dict):
            continue

        eans = obj.get("eans")

        if isinstance(eans, str):

            for value in eans.split(","):

                value = value.strip()

                if value:
                    values.add(value)

        elif isinstance(eans, list):

            for value in eans:

                if value:
                    values.add(str(value))

    return sorted(values)


# ============================================================
# PRODUCT EXTRACTION
# ============================================================

def extract_product(node, retailer, category, store):

    product_type = node.get("type")

    if product_type not in (
        "PRODUCT_TILE",
        "RESTRICTED_PRODUCT_TILE"
    ):
        return None

    data = node.get("data") or {}

    if not isinstance(data, dict):
        return None

    name = data.get("name")

    if not name:
        return None

    product_id = data.get("id")
    external_id = data.get("externalId")
    store_product_id = data.get("storeProductId")

    identity = (
        store_product_id
        or external_id
        or product_id
        or name
    )

    key = f"{retailer}:{identity}"

    price_info = data.get("priceInfo") or {}
    tracking = data.get("tracking") or {}

    return key, {
        "retailer": retailer,
        "store_id": store["store_id"],
        "address_id": store["address_id"],

        "product_id": str(product_id) if product_id is not None else None,
        "external_id": external_id,
        "store_product_id": store_product_id,

        "name": name,
        "description": data.get("description"),

        "price": data.get("price"),
        "currency": price_info.get("currencyCode"),
        "price_display": price_info.get("displayText"),

        "image_url": data.get("imageUrl"),
        "image_id": data.get("imageId"),

        "category": category,

        "out_of_stock": data.get("outOfStock"),
        "restricted": data.get(
            "restricted",
            product_type == "RESTRICTED_PRODUCT_TILE"
        ),

        "sale_type": tracking.get("productSaleType"),
        "is_weighted": tracking.get("isWeightedProduct"),
        "increment": tracking.get("increment"),

        "dietary_labels": tracking.get("dietaryLabels", []),
        "tags": data.get("tags", []),
        "labels": data.get("labels", []),
        "indicators": data.get("indicators", []),
        "promotions": data.get("promotions", []),
        "attribute_groups": data.get("attributeGroups", []),

        "eans": extract_eans(node),

        "source_type": product_type,
    }


# ============================================================
# PRODUCT MERGE
# ============================================================

def extract_products(data, retailer, category, store, all_products):

    extracted = 0

    for obj in walk(data):

        if not isinstance(obj, dict):
            continue

        result = extract_product(
            obj,
            retailer,
            category,
            store
        )

        if result is None:
            continue

        key, product = result

        existing = all_products.get(key)

        if existing is None:

            all_products[key] = product
            extracted += 1

        else:

            existing["eans"] = sorted(
                set(existing.get("eans", []))
                | set(product.get("eans", []))
            )

            for field, value in product.items():

                if existing.get(field) in (None, "", [], {}):

                    if value not in (None, "", [], {}):
                        existing[field] = value

    return extracted


# ============================================================
# CATEGORY DISCOVERY
# ============================================================

def extract_deep_links(data):

    links = {}

    for obj in walk(data):

        if not isinstance(obj, dict):
            continue

        if obj.get("type") != "COLLECTION_TILE":
            continue

        collection_data = obj.get("data") or {}

        action = collection_data.get("action") or {}
        action_data = action.get("data") or {}

        path = action_data.get("path")

        if not path or "nodeType=DEEP_LINK" not in path:
            continue

        links[path] = {
            "title": collection_data.get("title") or "Unknown",
            "slug": collection_data.get("slug"),
            "path": path,
        }

    return links


# ============================================================
# CHECKPOINTS
# ============================================================

def checkpoint_path(retailer):
    return OUTPUT_DIR / f"checkpoint_{retailer}.json"


def load_checkpoint(retailer):

    return load_json(
        checkpoint_path(retailer),
        {
            "visited": [],
            "queue": [],
            "complete": False,
        }
    )


def save_checkpoint(retailer, state, all_products, all_categories):

    save_json(
        checkpoint_path(retailer),
        {
            **state,
            "products": [
                p for p in all_products.values()
                if p["retailer"] == retailer
            ],
            "categories": [
                c for c in all_categories.values()
                if c["retailer"] == retailer
            ],
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    )


# ============================================================
# CATALOG CACHE
# ============================================================

def get_main_catalog(retailer, store):

    store_dir = RAW_DIR / retailer
    store_dir.mkdir(parents=True, exist_ok=True)

    cache = store_dir / "main.json"

    if cache.exists():

        log(f"[CACHE] {retailer} main catalog")

        return load_json(cache)

    legacy_cache = OUTPUT_DIR / f"{retailer}_catalog.json"

    if legacy_cache.exists():

        log(f"[CACHE] Importing legacy catalog: {retailer}")

        data = load_json(legacy_cache)

        save_json(cache, data)

        return data

    url = (
        f"{BASE_URL}/v4/stores/{store['store_id']}"
        f"/addresses/{store['address_id']}/content/main"
    )

    data = request_json(url)

    if data is not None:
        save_json(cache, data)

    return data


# ============================================================
# CATEGORY CACHE
# ============================================================

def category_cache_path(store_dir, path, category):

    digest = hashlib.sha1(
        path.encode("utf-8")
    ).hexdigest()[:12]

    filename = f"{safe_filename(category)}_{digest}.json"

    return store_dir / filename


# ============================================================
# CRAWL STORE
# ============================================================

def crawl_store(
    retailer,
    store,
    all_products,
    all_categories,
    failed_requests
):

    log("")
    log("=" * 60)
    log(f"CRAWLING {retailer.upper()}")
    log("=" * 60)

    store_dir = RAW_DIR / retailer
    store_dir.mkdir(parents=True, exist_ok=True)

    state = load_checkpoint(retailer)

    if state.get("complete"):
        log(f"[COMPLETE] {retailer} already processed")
        return

    main_data = get_main_catalog(retailer, store)

    if main_data is None:

        failed_requests.append({
            "retailer": retailer,
            "reason": "main_catalog_failed",
        })

        return

    main_url = (
        f"{BASE_URL}/v4/stores/{store['store_id']}"
        f"/addresses/{store['address_id']}/content/main"
    )

    if not state["queue"] and not state["visited"]:

        state["queue"].append({
            "path": None,
            "title": "HOME",
        })

    # Restore persisted products and categories.
    for product in state.get("products", []):

        identity = (
            product.get("store_product_id")
            or product.get("external_id")
            or product.get("product_id")
            or product.get("name")
        )

        all_products[f"{retailer}:{identity}"] = product

    for category in state.get("categories", []):

        key = f"{retailer}:{category['path']}"
        all_categories[key] = category

    visited = set(state["visited"])

    processed = len(visited)

    while state["queue"]:

        if processed >= MAX_CATEGORIES_PER_STORE:

            log("[LIMIT] Category limit reached")
            break

        current = state["queue"].pop(0)

        path = current["path"]
        category = current["title"]

        visit_key = path or "HOME"

        if visit_key in visited:
            continue

        log(f"[CATEGORY {processed + 1}] {category}")

        if path is None:

            data = main_data

        else:

            url = urljoin(BASE_URL, path)

            cache = category_cache_path(
                store_dir,
                path,
                category
            )

            if cache.exists():

                log(f"[CACHE] {category}")
                data = load_json(cache)

            else:

                data = request_json(url)

                if data is None:

                    failed_requests.append({
                        "retailer": retailer,
                        "category": category,
                        "url": url,
                        "reason": "category_request_failed",
                    })

                    log(f"[FAILED] {category}")

                    # Preserve failed category for next execution.
                    state["queue"].insert(0, current)

                    save_checkpoint(
                        retailer,
                        state,
                        all_products,
                        all_categories
                    )

                    return

                save_json(cache, data)

        new_products = extract_products(
            data,
            retailer,
            category,
            store,
            all_products
        )

        discovered = extract_deep_links(data)

        new_categories = 0

        for child_path, child in discovered.items():

            if child_path in visited:
                continue

            if any(
                item["path"] == child_path
                for item in state["queue"]
            ):
                continue

            state["queue"].append({
                "path": child_path,
                "title": child["title"],
            })

            category_key = f"{retailer}:{child_path}"

            all_categories[category_key] = {
                "retailer": retailer,
                "store_id": store["store_id"],
                "address_id": store["address_id"],
                "title": child["title"],
                "slug": child["slug"],
                "path": child_path,
            }

            new_categories += 1

        visited.add(visit_key)
        state["visited"] = list(visited)

        processed += 1

        # Persist after every successful page.
        save_json(
            OUTPUT_DIR / "all_products.json",
            list(all_products.values())
        )

        save_json(
            OUTPUT_DIR / "all_categories.json",
            list(all_categories.values())
        )

        save_checkpoint(
            retailer,
            state,
            all_products,
            all_categories
        )

        log(f"    [PRODUCTS] New unique: {new_products}")
        log(f"    [SUBCATEGORIES] Discovered: {new_categories}")
        log(f"    [TOTAL] {len(all_products)}")

    if not state["queue"]:

        state["complete"] = True

    save_checkpoint(
        retailer,
        state,
        all_products,
        all_categories
    )

    log(
        f"[STORE COMPLETE] {retailer}: "
        f"{processed} pages"
    )


# ============================================================
# CSV EXPORT
# ============================================================

CSV_FIELDS = [
    "retailer",
    "store_id",
    "address_id",
    "product_id",
    "external_id",
    "store_product_id",
    "name",
    "description",
    "price",
    "currency",
    "price_display",
    "image_url",
    "image_id",
    "category",
    "out_of_stock",
    "restricted",
    "sale_type",
    "is_weighted",
    "increment",
    "dietary_labels",
    "tags",
    "labels",
    "indicators",
    "promotions",
    "attribute_groups",
    "eans",
    "source_type",
]


def export_csv(path, products):

    with Path(path).open(
        "w",
        newline="",
        encoding="utf-8-sig"
    ) as f:

        writer = csv.DictWriter(
            f,
            fieldnames=CSV_FIELDS,
            extrasaction="ignore"
        )

        writer.writeheader()

        for product in products:

            row = dict(product)

            for field in (
                "dietary_labels",
                "tags",
                "labels",
                "indicators",
                "promotions",
                "attribute_groups",
                "eans",
            ):

                row[field] = json.dumps(
                    row.get(field, []),
                    ensure_ascii=False
                )

            writer.writerow(row)


# ============================================================
# MAIN
# ============================================================

def main():

    started_at = datetime.now(timezone.utc).isoformat()

    all_products = {}
    all_categories = {}
    failed_requests = []

    # Restore products from previous full export.
    previous_products = load_json(
        OUTPUT_DIR / "all_products.json",
        []
    )

    for product in previous_products:

        retailer = product.get("retailer")

        if retailer not in TARGET_STORES:
            continue

        identity = (
            product.get("store_product_id")
            or product.get("external_id")
            or product.get("product_id")
            or product.get("name")
        )

        all_products[f"{retailer}:{identity}"] = product

    previous_categories = load_json(
        OUTPUT_DIR / "all_categories.json",
        []
    )

    for category in previous_categories:

        key = f"{category['retailer']}:{category['path']}"
        all_categories[key] = category

    log("")
    log("=" * 60)
    log("1. FETCHING STORE WALL")
    log("=" * 60)

    store_wall = fetch_store_wall()

    stores = discover_stores(store_wall)

    if not stores:
        raise RuntimeError("No target stores found")

    log(f"[OK] Found {len(stores)}/4 stores")

    for retailer, store in stores.items():

        crawl_store(
            retailer,
            store,
            all_products,
            all_categories,
            failed_requests
        )

    # Final JSON exports.
    products = list(all_products.values())
    categories = list(all_categories.values())

    save_json(
        OUTPUT_DIR / "all_products.json",
        products
    )

    save_json(
        OUTPUT_DIR / "all_categories.json",
        categories
    )

    save_json(
        OUTPUT_DIR / "failed_requests.json",
        failed_requests
    )

    finished_at = datetime.now(timezone.utc).isoformat()

    save_json(
        OUTPUT_DIR / "crawl_metadata.json",
        {
            "started_at": started_at,
            "finished_at": finished_at,
            "city": CITY_CODE,
            "country": COUNTRY_CODE,
            "stores": stores,
            "unique_products": len(products),
            "categories_discovered": len(categories),
            "failed_requests": len(failed_requests),
        }
    )

    # Combined CSV.
    export_csv(
        OUTPUT_DIR / "all_products.csv",
        products
    )

    # Per-retailer CSV.
    for retailer in TARGET_STORES:

        retailer_products = [
            product
            for product in products
            if product["retailer"] == retailer
        ]

        export_csv(
            OUTPUT_DIR / f"{retailer}_products.csv",
            retailer_products
        )

    # Final summary.
    log("")
    log("=" * 60)
    log("CRAWLING SUMMARY")
    log("=" * 60)

    for retailer in TARGET_STORES:

        count = sum(
            1 for product in products
            if product["retailer"] == retailer
        )

        log(f"{retailer:15} {count:>8} products")

    log("-" * 60)
    log(f"TOTAL PRODUCTS: {len(products)}")
    log(f"CATEGORIES:     {len(categories)}")
    log(f"FAILED REQUESTS: {len(failed_requests)}")
    log("-" * 60)

    log(f"[JSON] {OUTPUT_DIR / 'all_products.json'}")
    log(f"[CSV]  {OUTPUT_DIR / 'all_products.csv'}")
    log(f"[RAW]  {RAW_DIR}")


if __name__ == "__main__":

    try:

        main()

    except RateLimitError as exc:

        log("")
        log(f"[STOPPED] {exc}")
        log("[INFO] Checkpoint saved. Do not retry before the server permits.")
        sys.exit(2)

    except AccessDeniedError as exc:

        log("")
        log(f"[STOPPED] {exc}")
        sys.exit(3)

    except KeyboardInterrupt:

        log("")
        log("[STOPPED] Interrupted by user.")
        sys.exit(130)

    except Exception as exc:

        log("")
        log(f"[FATAL] {type(exc).__name__}: {exc}")
        sys.exit(1)

PY

STATUS=$?

echo
echo "============================================================"
echo "CRAWLER FINISHED"
echo "============================================================"

exit "$STATUS"
