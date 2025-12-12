"""Functions to search for products and generate product add events.

Used for generation of shopping scenarios.
"""

import argparse
import base64
import json

from webarena.shopping.events.generate_events import event_types
from webarena.shopping.events.products import generate_product_from_product
from webarena.shopping.utils.auth import get_admin_token
from webarena.shopping.utils.store_requests import make_authenticated_request


# Use the Adobe Commerce REST API to search for products for a given search query
def search_products(query, token):
    """Search for products using the Adobe Commerce REST API."""
    # Search by products matching the list of search terms
    query_terms = query.split(" ")
    query = ",".join([term.strip() for term in query_terms])

    url_start = "/rest/V1/products?"
    for term in query_terms:
        url_start += f"searchCriteria[filter_groups][0][filters][0][field]=name&searchCriteria[filter_groups][0][filters][0][value]=%25{term}%25&searchCriteria[filter_groups][0][filters][0][condition_type]=like&"

    url = url_start.rstrip("&")

    print(f"Searching products with query: {query}, URL: {url}")
    response = make_authenticated_request(token, url, method="GET")

    if response is not None and "items" in response:
        return response["items"]

    return []


def generate_similar_product_add_events(query, num_products=10):
    """Generate product add events for products matching the search query to serve as distractors."""
    admin_token = get_admin_token()
    products = search_products(query, admin_token)
    print(f"Found {len(products)} products matching query '{query}'")

    events = []

    # select a subset of results
    products = products[:num_products]
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
    # use argparse to get the query
    parser = argparse.ArgumentParser(
        description="Generate product review events for a given search query."
    )
    parser.add_argument(
        "--query", type=str, help="Search query for products", required=True
    )
    parser.add_argument(
        "--num-products",
        type=int,
        help="Number of products to generate events for",
        default=10,
    )
    args = parser.parse_args()

    query = args.query
    events = generate_similar_product_add_events(query, num_products=args.num_products)

    with open("product_add_events.json", "w") as f:
        json.dump(events, f, indent=4)

    print(f"Generated {len(events)} product add events for query '{query}'")
