"""Script to generate, add, and remove products in Adobe Commerce (Magento) via REST API."""

import argparse
import json
import os
import random
from datetime import datetime
from enum import Enum
from pathlib import Path
from time import sleep

from tqdm import tqdm

from webarena.shopping.events.product_sales import (
    add_product_sales_rule,
    generate_sales_rule_for_product,
    remove_product_sales_rule,
)
from webarena.shopping.events.products import (
    add_product,
    generate_product_from_catalog,
    generate_restock_event,
    get_random_product_from_catalog,
    remove_product,
    update_stock_for_product,
)
from webarena.shopping.events.reviews import add_product_review, generate_product_review
from webarena.shopping.utils.auth import get_admin_token, get_customer_token
from webarena.shopping.utils.store_requests import make_authenticated_request

event_types = Enum(
    "EventType",
    [
        "ADD_PRODUCT",
        "REMOVE_PRODUCT",
        "UNSTOCK_PRODUCT",
        "RESTOCK_PRODUCT",
        "ADD_SALE",
        "ADD_PRODUCT_REVIEW",
    ],
)


def example_api_calls(token):
    """Issue example API calls using Bearer token."""
    print("\n" + "=" * 60)
    print("Example API Calls")
    print("=" * 60)

    # Example 1: Get store configuration
    print("\n1. Getting store configuration...")
    config = make_authenticated_request(token, "/rest/V1/store/storeConfigs")
    if config:
        print(f"Found {len(config)} store(s)")
        if config:
            print(f"Store URL: {config[0].get('base_url')}")
            print(f"Store Code: {config[0].get('code')}")

    # Example 2: Get products (with pagination)
    print("\n2. Getting products...")
    products = make_authenticated_request(
        token, "/rest/V1/products?searchCriteria[pageSize]=5"
    )
    if products:
        items = products.get("items", [])
        total = products.get("total_count", 0)
        print(f"Found {total} total products, showing {len(items)}")
        for product in items[:3]:
            print(product)

    # Example 3: Get customers (admin token required)
    print("\n3. Getting customers...")
    customers = make_authenticated_request(
        token, "/rest/V1/customers/search?searchCriteria[pageSize]=5"
    )
    if customers:
        items = customers.get("items", [])
        total = customers.get("total_count", 0)
        print(f"Found {total} total customers, showing {len(items)}")
        for customer in items[:3]:
            print(
                f"  - {customer.get('firstname')} {customer.get('lastname')} ({customer.get('email')})"
            )

    # Example 4: Get categories
    print("\n4. Getting categories...")
    categories = make_authenticated_request(token, "/rest/V1/categories")
    if categories:
        print(f"Root Category: {categories.get('name')}")
        children = categories.get("children_data", [])
        print(f"Found {len(children)} child categories")
        for cat in children[:3]:
            print(f"  - {cat.get('name')} (ID: {cat.get('id')})")

    # Example 5: Post a sale for a product
    print("\n5. Posting a sale for a product...")
    make_authenticated_request(
        token,
        "/rest/V1/salesRules",
    )


def generate_events(
    token, num_sales, num_add_products, num_remove_products, num_reviews, num_restocks
):
    """Generate product sales and add product events."""
    # Generate a list of the right amount of each event type
    all_events = (
        [event_types.ADD_SALE] * num_sales
        + [event_types.ADD_PRODUCT] * num_add_products
        + [event_types.REMOVE_PRODUCT] * num_remove_products
        + [event_types.ADD_PRODUCT_REVIEW] * num_reviews
        + [event_types.RESTOCK_PRODUCT] * num_restocks
    )
    random.shuffle(all_events)

    events = []
    for event in tqdm(all_events):
        if event == event_types.ADD_SALE:
            print("\nGenerating product sale event...")
            # Use the adobe commerce API to create a product sale event modifying the salesrule table
            product = get_random_product_from_catalog(token)
            if not product:
                print("✗ No products found in catalog to create sales event.")
                continue

            sku = product.get("sku")
            print(f"Creating sale event for product SKU: {sku}...")

            # Get the rest API endpoint to modify sales rules
            payload = generate_sales_rule_for_product(product)

            event = {
                "time": datetime.now().isoformat(timespec="milliseconds"),
                "type": event_types.ADD_SALE.name,
                "payload": payload,
            }
            events.append(event)

        elif event == event_types.ADD_PRODUCT:
            print("\nGenerating product add event...")
            # Generate a new product based on existing catalog
            product = generate_product_from_catalog(token)
            if not product:
                print("✗ Failed to generate new product from catalog.")
                continue

            event = {
                "time": datetime.now().isoformat(timespec="milliseconds"),
                "type": event_types.ADD_PRODUCT.name,
                "payload": product,
            }
            events.append(event)

        elif event == event_types.REMOVE_PRODUCT:
            print("\nGenerating product remove event...")

            # Generate a remove event for an existing product
            product = get_random_product_from_catalog(token)
            if not product:
                print("✗ No products found in catalog to create remove event.")
                continue

            sku = product.get("sku")
            print(f"Creating remove event for product SKU: {sku}...")

            event = {
                "time": datetime.now().isoformat(timespec="milliseconds"),
                "type": event_types.REMOVE_PRODUCT.name,
                "payload": {"sku": sku},
            }
            events.append(event)

        elif event == event_types.ADD_PRODUCT_REVIEW:
            print("\nGenerating product review event...")
            # Generate a new product review based on existing catalog
            product = get_random_product_from_catalog(token)
            if not product:
                print("✗ No products found in catalog to create review event.")
                continue

            sku = product.get("sku")
            print(f"Creating review event for product SKU: {sku}...")

            payload = generate_product_review(token, sku)
            event = {
                "time": datetime.now().isoformat(timespec="milliseconds"),
                "type": event_types.ADD_PRODUCT_REVIEW.name,
                "payload": payload,
            }
            events.append(event)
        elif event == event_types.RESTOCK_PRODUCT:
            print("\nGenerating product restock event...")

            # Generate a restock event for an existing product
            product = get_random_product_from_catalog(token, in_stock=False)
            if not product:
                print("✗ No products found in catalog to create restock event.")
                continue

            sku = product.get("sku")
            print(f"Creating restock event for product SKU: {sku}...")

            # Create payload with updated stock information
            payload = generate_restock_event(token, sku)
            event = {
                "time": datetime.now().isoformat(timespec="milliseconds"),
                "type": event_types.RESTOCK_PRODUCT.name,
                "payload": payload,
            }
            events.append(event)

    return events


def add_events(token, event_type, payload, demo=False):
    """Add events to the sentinel via the /init endpoint."""
    if event_type == event_types.ADD_PRODUCT:
        sku = payload["product"].get("sku")
        add_product(token, sku, payload)

        if demo:
            display_product_pages(sku, payload["product"])

    elif event_type == event_types.REMOVE_PRODUCT:
        sku = payload.get("sku")
        remove_product(token, sku)

        if demo:
            display_product_pages(sku, payload.get("product"))

    elif event_type == event_types.ADD_SALE:
        product_id = payload.get("rule", {}).get("product_ids")[0]
        sales_rule = add_product_sales_rule(token, product_id, payload)

        if demo:
            token = get_customer_token()
            display_product_in_cart(token, sales_rule)

    elif event_type == event_types.ADD_PRODUCT_REVIEW:
        product_id = payload.get("review", {}).get("entity_pk_value")
        add_product_review(token, product_id, payload)

        # if demo:
        #     display_product_pages(sku, payload["product"])

    elif event_type == event_types.RESTOCK_PRODUCT:
        sku = payload.get("sku")

        # First remove existing stock
        remove_payload = {
            "stockItem": {
                "qty": 0,
                "is_in_stock": False,
            }
        }
        update_stock_for_product(token, payload.get("sku"), remove_payload)

        del payload["sku"]  # Can't pass sku in the payload for stock update
        update_stock_for_product(token, sku, payload)

        if demo:
            display_product_pages(sku, payload["product"])


def output_events(events, output_path):
    """Sort events by time and write events to a JSONL file."""
    # Sort the items by their created_at key
    events.sort(key=lambda x: x["time"])

    output_path = Path(__file__).parent.absolute() / Path(output_path)

    # Write each event as a line in the output JSONL file
    with open(output_path, "w") as f:
        for event in events:
            f.write(json.dumps(event) + "\n")


def display_product_pages(sku, product):
    """Display specific product pages in Edge browser for demo purposes.

    Args:
        sku (str): The SKU of the product to display
        product (dict): The product details to display

    """
    url_key = list(
        filter(
            lambda x: x["attribute_code"] == "url_key",
            product["custom_attributes"],
        )
    )
    if len(url_key) > 0:
        url_key = url_key[0]["value"]
        sku = product.get("sku")

        # Open up Edge browser at the specified URL for demo purposes to show the product was added
        os_command = f"open -a 'Microsoft Edge' 'http://localhost:7770/{url_key}.html'"
        os.system(os_command)
        print(f"Opened Edge browser for product SKU: {sku}")

        # open advanced search page as well
        os_command = f"open -a 'Microsoft Edge' 'http://localhost:7770/catalogsearch/advanced/result/?sku={sku}'"
        os.system(os_command)


def display_product_in_cart(customer_token, sales_rule):
    """Display specific product added to the cart in Edge browser for demo purposes.

    Args:
        customer_token (str): The customer token to use for API calls
        sales_rule (dict): The sales rule to use for the product in the cart

    """
    sku = sales_rule.get("condition", {}).get("conditions", [])[0].get("value")
    if not sku:
        print("✗ Could not determine SKU from sales rule to display in cart.")
        return

    # get the cart idea
    cart = make_authenticated_request(
        customer_token,
        "/rest/V1/carts/mine",
    )

    if not cart:
        print("✗ Could not retrieve cart for customer.")
        return

    cart_id = cart.get("id")

    # Add the product to cart for the customer
    cart_payload = {
        "cartItem": {
            "qty": 1,
            "sku": sku,
            "quote_id": cart_id,  # assuming quote_id 1 for simplicity; in real cases, fetch/create cart for customer
        }
    }

    cart_result = make_authenticated_request(
        customer_token,
        "/rest/V1/carts/mine/items",
        method="POST",
        data=cart_payload,
    )

    if cart_result:
        # Open up Edge browser at the cart URL with the product added for demo purposes
        os_command = "open -a 'Microsoft Edge' 'http://localhost:7770/checkout/cart/'"
        os.system(os_command)
        print(
            "Opened Edge browser to show the product in the cart, where you can see the sale posted."
        )


if __name__ == "__main__":
    # Add arguments for add or remove products
    parser = argparse.ArgumentParser(description="Manage products in Adobe Commerce")
    parser.add_argument(
        "--option",
        type=str,
        help="Option to add or remove products",
        choices=["init", "add", "reset", "test"],
        required=True,
    )
    parser.add_argument(
        "--num-add-products",
        type=int,
        help="Number of products to add",
        default=0,
    )
    parser.add_argument(
        "--num-remove-products",
        type=int,
        help="Number of products to remove",
        default=0,
    )
    parser.add_argument(
        "--num-sales",
        type=int,
        help="Number of sales to add",
        default=0,
    )
    parser.add_argument(
        "--num-reviews",
        type=int,
        help="Number of product reviews to add",
        default=0,
    )
    parser.add_argument(
        "--num-restocks", type=int, help="Number of restock events", default=0
    )
    parser.add_argument(
        "--output-file",
        type=str,
        help="where to output the generated events JSON file",
        default="events.jsonl",
    )
    parser.add_argument(
        "--demo",
        action="store_true",
        help="Whether running this script for a demo (will open browser windows to view products)",
    )
    args = parser.parse_args()

    token = get_admin_token()

    if args.option == "test":
        print(f"Bearer Token: {token}")
        example_api_calls(token)

    if not token:
        print("\n✗ Authentication failed")
        exit(1)

    if args.option == "init":
        # Generate product add and product sale events
        all_events = generate_events(
            token,
            args.num_sales,
            args.num_add_products,
            args.num_remove_products,
            args.num_reviews,
            args.num_restocks,
        )

        # Combine and output all events to a single JSON file
        output_events(all_events, args.output_file)

    elif args.option == "add":
        # Read events from the output file and add them
        try:
            output_path = Path(__file__).parent.absolute() / Path(args.output_file)
            with open(output_path) as f:
                lines = f.readlines()
                events = [json.loads(line) for line in lines]

                previous_timestamp = None
                for event in events:
                    print(event)
                    created_at = event.get("time")
                    if previous_timestamp is not None:
                        # Calculate time difference and sleep accordingly to simulate original timing
                        created = datetime.fromisoformat(created_at)
                        previous = datetime.fromisoformat(previous_timestamp)
                        time_diff = created - previous
                        if time_diff.total_seconds() > 0:
                            print(
                                f"Sleeping for {time_diff} seconds to simulate original timing before executing next event..."
                            )
                            sleep(time_diff.total_seconds())

                    payload = event.get("payload", {})
                    event_type = event.get("type")

                    # Get the string value as the enum
                    event_type = event_types[event_type]

                    # Process payloads per event type
                    add_events(token, event_type, payload, demo=args.demo)

                    previous_timestamp = created_at

        except FileNotFoundError:
            print(
                f"✗ File {args.output_file} not found. Run init option first to generate products_added.json."
            )
            exit(1)
    elif args.option == "reset":
        try:
            with open(args.output_file) as f:
                lines = f.readlines()
                events = [json.loads(item) for item in lines]
                for event in events:
                    if event.get("type") == event_types.ADD_PRODUCT:
                        sku = event.get("payload").get("product").get("sku")
                        if sku:
                            remove_product(token, sku)

                            url_key = list(
                                filter(
                                    lambda x: x["attribute_code"] == "url_key",
                                    event["payload"]["product"]["custom_attributes"],
                                )
                            )
                            if len(url_key) > 0:
                                url_key = url_key[0]["value"]

                                if args.demo:
                                    # Open up Edge browser at the specified URL for demo purposes to show the product was removed
                                    os_command = f"open -a 'Microsoft Edge' 'http://localhost:7770/{url_key}.html'"
                                    os.system(os_command)
                                    print(
                                        f"Opened Edge browser for product SKU: {sku}. It should give a page not found message."
                                    )
                    elif event.get("type") == event_types.ADD_SALE:
                        product_id = (
                            event.get("payload").get("rule").get("product_ids")[0]
                        )
                        if product_id:
                            remove_product_sales_rule(token, product_id)

            # remove events.json file after removal of products
            os.remove(args.output_file)

        except FileNotFoundError:
            print(f"✗ File {args.output_file} not found.")
            exit(1)
