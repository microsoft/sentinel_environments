"""Functions to generate product review events for products matching a search query.

Used in scenario generation for shopping scenarios.

"""

import argparse
import json
import random

from webarena.shopping.events.products import get_product_by_sku
from webarena.shopping.events.reviews import get_product_review_from_description
from webarena.shopping.utils.auth import get_admin_token
from webarena.shopping.utils.store_requests import make_authenticated_request


# Use the Adobe Commerce REST API to search for products for a given search query
def search_products(query, token):
    """Search for products using the Adobe Commerce REST API."""
    url = f"/rest/V1/products?searchCriteria[filter_groups][0][filters][0][field]=name&searchCriteria[filter_groups][0][filters][0][value]=%25{query}%25&searchCriteria[filter_groups][0][filters][0][condition_type]=like"

    print(f"Searching products with query: {query}, URL: {url}")
    response = make_authenticated_request(token, url, method="GET")

    if response is not None and "items" in response:
        return response["items"]

    return []


def generate_review_payload(product, review):
    """Generate the review payload for a given product and review."""
    product_id = product["id"]
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
    return review_payload


def generate_review_for_product(product, sentiment="positive"):
    """Generate a review for a given product based on sentiment."""
    product_description = list(
        filter(
            lambda x: x["attribute_code"] == "description",
            product["custom_attributes"],
        )
    )
    description_text = product_description[0]["value"] if product_description else ""

    # Generate a new review for this product
    sent = (  # Whether the review is positive or negative
        random.choice([True, False])
        if sentiment == "either"
        else sentiment == "positive"
    )
    review = get_product_review_from_description(
        product["name"],
        description_text,
        positive=sent,
    )
    return review


def generate_product_review_events(
    sku, num_reviews=20, time_spacing=20, time_start=0, sentiment="positive"
):
    """Generate product review events for a specific product SKU."""
    admin_token = get_admin_token()
    product = get_product_by_sku(admin_token, sku)
    if not product:
        print(f"✗ No product found with SKU '{sku}'")
        return []

    events = []
    for i in range(0, num_reviews):
        review = generate_review_for_product(product, sentiment=sentiment)
        print(
            f"Generated review: Title={review.review_title}, Rating={review.rating}, Text={review.review_text}"
        )
        review_payload = generate_review_payload(product, review)

        events += [
            {
                "time": time_start
                + i * time_spacing,  # Space events by specified time spacing
                "type": "ADD_PRODUCT_REVIEW",
                "payload": review_payload,
            }
        ]

    return events


def generate_similar_product_reviews(
    query,
    num_products=20,
    num_reviews_per_product=20,
    time_spacing=20,
    sentiment="positive",
):
    """Generate product review events for products matching the search query."""
    admin_token = get_admin_token()
    products = search_products(query, admin_token)
    print(f"Found {len(products)} products matching query '{query}'")

    events = []

    # Create a list of tuples (product, i) to generate reviews for where i is the index of the review ranging from 0 to num_reviews_per_product - 1
    reviews_to_generate = []
    for product in products:
        for i in range(num_reviews_per_product):
            reviews_to_generate.append((product, i))

    # Shuffle the list to randomize the order of review generation
    random.shuffle(reviews_to_generate)

    # select a subset of products
    count = 0
    for product, _ in reviews_to_generate:
        review = generate_review_for_product(product, sentiment=sentiment)
        print(
            f"Generated review: Title={review.review_title}, Rating={review.rating}, Text={review.review_text}"
        )
        review_payload = generate_review_payload(product, review)

        events += [
            {
                "time": (
                    count * time_spacing
                ),  # Space events by specified time spacing
                "type": "ADD_PRODUCT_REVIEW",
                "payload": review_payload,
            }
        ]

        count += 1

    # Verify we only have the requested number of reviews
    assert len(events) == num_products * num_reviews_per_product

    return events


if __name__ == "__main__":
    # use argparse to get the query
    parser = argparse.ArgumentParser(
        description="Generate product review events for a given search query."
    )
    parser.add_argument("--query", type=str, help="Search query for products")

    # type can be a specific product SKU or comma separated list of SKUs
    parser.add_argument(
        "--products",
        help="Specific product(s) SKU to generate reviews for",
        nargs="+",
    )
    parser.add_argument(
        "--sentiment",
        choices=["positive", "negative", "either"],
        help="Sentiment of the reviews to generate",
        default="positive",
    )
    parser.add_argument(
        "--num-reviews-per-product",
        type=int,
        help="Number of reviews to generate per product",
        default=20,
    )
    parser.add_argument(
        "--num-products",
        type=int,
        help="Number of products to generate reviews for",
        default=20,
    )

    parser.add_argument(
        "--time-spacing",
        type=int,
        help="Time spacing between review events in seconds",
        default=20,
    )

    parser.add_argument(
        "--time-start",
        type=int,
        help="Offset for the start time of the first review event in seconds",
        default=0,
    )
    args = parser.parse_args()

    events = []
    if args.products:
        # Generate reviews for a specific product SKU or list of SKUs passed in
        skus = args.products

        num_reviews = args.num_reviews_per_product
        time_spacing = args.time_spacing

        time_start = args.time_start
        for sku in skus:
            print(f"Generating reviews for product SKU: {sku}")
            events_for_product = generate_product_review_events(
                sku,
                num_reviews=num_reviews,
                time_start=time_start,
                time_spacing=time_spacing,
                sentiment=args.sentiment,
            )
            events.extend(events_for_product)

            time_start += len(events_for_product) * time_spacing
    elif args.query:
        # Generate reviews for similar products based on the search query passed in
        # used to generate distracting reviews appearing on a similar search query
        query = args.query
        num_reviews = args.num_reviews_per_product
        time_spacing = args.time_spacing
        num_products = args.num_products
        events = generate_similar_product_reviews(
            query,
            num_products=num_products,
            num_reviews_per_product=num_reviews,
            time_spacing=time_spacing,
            sentiment=args.sentiment,
        )

        print(f"Generated {len(events)} product review events for query '{query}'")

    else:
        print("Please provide either a --query or --products argument.")
        exit(1)

    with open("review_events.json", "w") as f:
        json.dump(events, f, indent=4)
