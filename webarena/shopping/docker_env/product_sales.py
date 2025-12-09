"""Functions to add and remove product sales rules in Magento using the REST API."""

from datetime import datetime, timedelta

from store_requests import make_authenticated_request


def add_product_sales_rule(token, name, rule_data):
    """Post a product sale event for a given product as specified in the payload."""
    # Post a salesrule for this product
    result = make_authenticated_request(
        token,
        "/rest/V1/salesRules",
        method="POST",
        data=rule_data,
    )

    if result:
        print(f"✓ Created sales rule for product: {name}")
    else:
        print(f"✗ Failed to create sales rule for product: {name}")
    return result


def remove_product_sales_rule(token, product_id):
    """Remove a product sale event for a given product."""
    # Use the API to get the sales rules
    sales_rules = make_authenticated_request(
        token,
        "/rest/V1/salesRules/search?searchCriteria[pageSize]=100",
        method="GET",
    )

    if not sales_rules:
        print("✗ Failed to retrieve sales rules")
        return

    # Removing all sales rules
    for rule in sales_rules.get("items", []):
        rule_id = rule.get("rule_id")
        print(f"\nRemoving sales rule with ID: {rule_id}...")
        result = make_authenticated_request(
            token,
            f"/rest/V1/salesRules/{rule_id}",
            method="DELETE",
        )

        if result is not None:
            print(f"✓ Removed sales rule with ID: {rule_id}")
        else:
            print(f"✗ Failed to remove sales rule with ID: {rule_id}")

    # # Find the sales rule ID for the given product_id
    # KEEP FOR LATER -- This is not working as expected and is commented out for now, and instead we are removing all sales rules instead of product specific ones.
    # rule_id = None
    # for rule in sales_rules.get("items", []):
    #     product_ids = rule.get("product_ids", [])
    #     print(product_ids)
    #     if product_id in product_ids:
    #         rule_id = rule.get("rule_id")
    #         break

    # if rule_id is None:
    #     print(f"✗ No sales rule found for product ID: {product_id}")
    #     return

    # print(f"\nRemoving sales rule with ID: {rule_id}...")
    # # Delete a salesrule by ID
    # result = make_authenticated_request(
    #     token,
    #     f"/rest/V1/salesRules/{rule_id}",
    #     method="DELETE",
    # )

    # if result is not None:
    #     print(f"✓ Removed sales rule with ID: {rule_id}")
    # else:
    #     print(f"✗ Failed to remove sales rule with ID: {rule_id}")


def generate_sales_rule_for_product(product):
    """Post a product sale event for a given product ID."""
    # Use the API to get the product info
    sku = product.get("sku")
    name = product.get("name")
    product_id = product.get("id")
    rule_data = {
        "rule": {
            "name": f"Huge discount on {name}",
            "store_labels": [{"store_id": 1, "store_label": "HalfPrice"}],
            "description": f"Automatic sale rule for product {sku}",
            # "condition": { # This part is commented out as it is not working as expected to apply the discount to the specific product
            #     "condition_type": "Magento\\SalesRule\\Model\\Rule\\Condition\\Combine",
            #     "conditions": [
            #         {
            #             "condition_type": "Magento\\SalesRule\\Model\\Rule\\Condition\\Product",
            #             "operator": "==",
            #             "attribute_name": "sku",
            #             "value": sku,
            #         }
            #     ],
            #     "aggregator_type": "all",
            #     "operator": None,
            #     "value": None,
            # },
            "customer_group_ids": [0, 1, 2, 3],
            "uses_per_customer": 2,
            "is_active": True,
            "website_ids": [1],
            "stop_rules_processing": True,
            "is_advanced": True,
            "sort_order": 0,
            "simple_action": "by_percent",
            "discount_amount": 50,
            "discount_qty": 1,
            "discount_step": 0,
            "is_rss": True,
            "apply_to_shipping": False,
            "times_used": 1,
            "product_ids": [product_id],
            "from_date": datetime.now().strftime("%Y-%m-%d"),
            "to_date": (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d"),
        }
    }

    print(f"✓ Created sales rule data for product SKU: {sku}")

    return rule_data
