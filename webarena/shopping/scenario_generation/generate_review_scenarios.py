"""Functions to generate product review events for products matching a search query.

Used in scenario generation for shopping scenarios.

"""

import json

from auth import get_admin_token
from reviews import get_product_review_from_description
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


def generate_similar_product_reviews(query):
    """Generate product review events for products matching the search query."""
    admin_token = get_admin_token()
    products = search_products(query, admin_token)
    print(f"Found {len(products)} products matching query '{query}'")

    events = []

    # select a subset of results
    products = products[:20]  # Limit to first 20 products for simplicity
    for i, product in enumerate(products):
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
            f"Generated review: Title={review.review_title}, Rating={review.rating}, Text={review.review_text}"
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
                "time": i * 20,  # Space events by 10 seconds
                "type": "ADD_PRODUCT_REVIEW",
                "payload": review_payload,
            }
        ]

    return events


if __name__ == "__main__":
    query = "google pixel 4"
    events = generate_similar_product_reviews(query)

    with open("product_review_events.json", "w") as f:
        json.dump(events, f, indent=4)
    print(f"Generated {len(events)} product review events for query '{query}'")
