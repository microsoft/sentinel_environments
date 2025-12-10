"""Functions to search for products and generate product add events.

Used for generation of shopping scenarios.
"""

import base64
import json

from auth import get_admin_token
from generate_events import event_types
from products import generate_product_from_product
from store_requests import make_authenticated_request


# Use the Adobe Commerce REST API to search for products for a given search query
def search_products(query, token):
    """Search for products using the Adobe Commerce REST API."""
    url = f"/rest/V1/products?searchCriteria[filter_groups][0][filters][0][field]=name&searchCriteria[filter_groups][0][filters][0][value]=%25{query}%25&searchCriteria[filter_groups][0][filters][0][condition_type]=like"

    print(f"Searching products with query: {query}, URL: {url}")
    response = make_authenticated_request(token, url, method="GET")

    if response is not None and "items" in response:
        return response["items"]

    return []


def generate_similar_product_add_events(query):
    """Generate product add events for products matching the search query."""
    admin_token = get_admin_token()
    products = search_products(query, admin_token)
    print(f"Found {len(products)} products matching query '{query}'")

    events = []

    # select a subset of results
    products = products[:20]  # Limit to first 20 products for simplicity
    for i, product in enumerate(products):
        new_product = generate_product_from_product(product)
        sku = new_product["product"]["sku"]

        product_image_path = f"./product_images/{sku}.jpg"
        with open(product_image_path, "rb") as image_file:
            image_data = image_file.read()
            encoded_string = base64.b64encode(image_data).decode("utf-8")

            new_product["image_data_base64"] = encoded_string
            events += [
                {
                    "time": i * 20,  # Space events by 10 seconds
                    "type": event_types.ADD_PRODUCT.name,
                    "payload": new_product,
                }
            ]

    return events


if __name__ == "__main__":
    query = "Over-Ear Headphones"
    events = generate_similar_product_add_events(query)

    with open("product_add_events.json", "w") as f:
        json.dump(events, f, indent=4)
    print(f"Generated {len(events)} product add events for query '{query}'")
