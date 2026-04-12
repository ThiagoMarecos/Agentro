import os
os.chdir(r'C:\Users\userp\Desktop\nexora\backend')

from app.services.import_ai_service import (
    detect_source_currency,
    get_exchange_rate,
    convert_prices,
    generate_missing_descriptions,
)

print("ALL IMPORTS OK")

# Test currency detection
tests = [
    ("https://www.puma.com.py/products", [250.0, 180.0], "PYG"),
    ("https://www.tiendamia.com.ar/products", [50.0], "ARS"),
    ("https://www.nike.com/shoes", [120.0], "USD"),
    ("https://www.casarica.com.py/tv", [5500000.0, 3200000.0], "PYG"),
    ("https://www.amazon.com/dp/123", [29.99], "USD"),
    ("https://www.falabella.cl/products", [50.0], "CLP"),
    ("https://www.mercadolibre.com.br/item", [50.0], "BRL"),
]

print("\nCurrency detection tests:")
for url, prices, expected in tests:
    result = detect_source_currency(url, prices)
    status = "PASS" if result == expected else "FAIL"
    domain = url.split("//")[1].split("/")[0]
    print(f"  {status}: {domain:35s} -> {result} (expected {expected})")

# Test price conversion
print("\nPrice conversion test:")
products = [
    {"name": "Nike Air Max", "price": 120.0, "compare_at_price": 150.0},
    {"name": "Puma RS-X", "price": 95.0, "compare_at_price": None},
]
converted = convert_prices(products, "USD", "PYG")
for p in converted:
    print(f"  {p['name']}: {p['price']:,.0f} PYG (compare: {p.get('compare_at_price', 'N/A')})")
