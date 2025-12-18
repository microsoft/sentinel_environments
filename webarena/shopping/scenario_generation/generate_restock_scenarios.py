"""Functions to generate restock events for products for a given search query.

Used in generation of events for shopping scenarios.

"""

import json
from datetime import datetime

from webarena.shopping.events.generate_events import event_types
from webarena.shopping.events.products import generate_restock_event
from webarena.shopping.events.reviews import get_product_review_from_description
from webarena.shopping.utils.auth import get_admin_token
from webarena.shopping.utils.store_requests import make_authenticated_request


# Use the Adobe Commerce REST API to search for products for a given search query
def search_products(sku, token):
    """Search for products using the Adobe Commerce REST API."""
    url = f"/rest/V1/products?searchCriteria[filterGroups][0][filters][0][field]=sku&searchCriteria[filterGroups][0][filters][0][value]={sku}&searchCriteria[filterGroups][0][filters][0][condition_type]=like"
    print(f"Searching products with sku: {sku}, URL: {url}")
    response = make_authenticated_request(token, url, method="GET")

    if response is not None and "items" in response:
        return response["items"]

    return []


def generate_review_events(token, sku, num_reviews=10):
    """Generate product review events for products matching the search query."""
    products = search_products(sku, token)
    print(f"Found {len(products)} products matching sku '{sku}'")

    if not products or len(products) > 1:
        print(f"✗ Expected exactly one product for SKU '{sku}', found {len(products)}")
        return []

    events = []

    product = products[0]
    for i in range(0, num_reviews):
        product_id = product["id"]

        print(f"Product name: {product['name']}, id: {product_id}")

        product_description = list(
            filter(
                lambda x: x["attribute_code"] == "description",
                product["custom_attributes"],
            )
        )

        # Generate a new review for this product
        review = get_product_review_from_description(
            product["name"],
            product_description[0]["value"] if product_description else "",
        )

        print(
            f"\nGenerated review: Title={review.review_title}, Rating={review.rating}, Text={review.review_text}"
        )
        review_payload = {
            "review": {
                "entity_pk_value": product_id,  # Product ID
                "title": review.review_title,
                "detail": review.review_text,
                "nickname": review.nickname,
                "ratings": [
                    {
                        "rating_id": 4,  # Assuming '4' corresponds to 'Rating'
                        "rating_name": "Rating",
                        "value": review.rating,
                        "percent": (review.rating / 5) * 100,
                    }
                ],
                "review_entity": "product",
                "review_type": 2,
                "review_status": 1,
                "store_id": 1,
                "stores": [1],
            }
        }

        events += [
            {
                "time": i * 10,  # Space events by 10 seconds
                "type": event_types.ADD_PRODUCT_REVIEW.name,
                "payload": review_payload,
            }
        ]

    return events


if __name__ == "__main__":
    product_sku = "B009DD2RJ2"

    token = get_admin_token()

    all_events = []

    # Create payload with updated stock information
    # First event should be to set the stock to 0
    payload = generate_restock_event(token, product_sku, qty=0)
    unstock = {
        "time": 0,
        "type": event_types.RESTOCK_PRODUCT.name,
        "payload": payload,
    }
    all_events.append(unstock)

    # Modify the reviews on the page as a distractor
    review_events = generate_review_events(token, product_sku)
    all_events.extend(review_events)

    # Create payload with updated stock information
    payload = generate_restock_event(token, product_sku)
    restock_event = {
        "time": datetime.now().isoformat(timespec="milliseconds"),
        "type": event_types.RESTOCK_PRODUCT.name,
        "payload": payload,
    }
    all_events.append(restock_event)

    with open("restock_events.json", "w") as f:
        json.dump(all_events, f, indent=4)
    print(
        f"Generated {len(all_events)} events, including restock and {len(review_events)} review events for sku '{product_sku}'"
    )
