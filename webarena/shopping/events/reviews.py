"""Functions for generating and managing product reviews in the Magento store."""

from webarena.shopping.utils.completions import (
    get_structured_completion_from_openai,
)
from webarena.shopping.utils.store_requests import make_authenticated_request


def get_product_review_from_description(original_name, description):
    """Generate a new product review based on the original name and description, using an LLM."""
    prompt = """Using the following product description and original name from an online store,
    generate a detailed and engaging product review that highlights the key features and benefits of the product.
    The review should include a rating out of 5, a title, a nickname for the person posting the review,
    and a descriptive text that would help potential customers make an informed purchasing decision,
    and can be either positive or negative based on the description.

    Original Product Name: "{original_name}"
    Product Description: "{description}"""

    response = get_structured_completion_from_openai(
        prompt.format(original_name=original_name, description=description),
        model="gpt-5",
    )

    return response


def generate_product_review(token, sku):
    """Generate a new product review for a given product SKU using an LLM and product description to synthesize a new review.

    Args:
        token: Authentication token for making requests to the API.
        sku: The SKU of the product for which to generate a review.

    Returns:
        A dictionary containing the generated review details, or None if no product is found.

    """
    print(f"\nGet the entity value for product with SKU: {sku}...")
    endpoint = f"/rest/V1/products?searchCriteria[filter_groups][0][filters][0][field]=sku&searchCriteria[filter_groups][0][filters][0][value]={sku}"
    result = make_authenticated_request(token, endpoint, method="GET")

    if result:
        # After getting the product, get the id from the first item
        items = result.get("items", [])
        if not items:
            print(f"✗ No product found with SKU: {sku}")
            return None
        first_product = items[0]
        entity_pk_value = first_product.get("id")

        product_description = list(
            filter(
                lambda x: x["attribute_code"] == "description",
                first_product["custom_attributes"],
            )
        )
        if len(product_description) > 0:
            product_description = product_description[0]["value"]
        else:
            product_description = ""

        # Generate a new review for this product
        review = get_product_review_from_description(
            first_product["name"], product_description
        )

        print(
            f"\nGenerated review: Title={review.review_title}, Rating={review.rating}, Text={review.review_text}"
        )
        review_payload = {
            "review": {
                "entity_pk_value": entity_pk_value,  # Product ID
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
    else:
        print(f"✗ Failed to get product with SKU: {sku}")
        return None


def add_product_review(token, product_id, review):
    """Post a new review for a given product product_id."""
    print("\nPosting review for product")
    endpoint = "/rest/V1/reviews"
    result = make_authenticated_request(
        token,
        endpoint,
        method="POST",
        data=review,
    )
    if result:
        print(f"✓ Posted review for product with ID: {product_id}")
    else:
        print(f"✗ Failed to post review for product with ID: {product_id}")
    return result


def remove_product_review(token, rule_id):
    """Remove a product review by its ID."""
    print(f"\nRemoving product review with ID: {rule_id}...")
    # Delete a review by ID
    result = make_authenticated_request(
        token,
        f"/rest/V1/reviews/{rule_id}",
        method="DELETE",
    )
    if result is not None:
        print(f"✓ Removed product review with ID: {rule_id}")
    else:
        print(f"✗ Failed to remove product review with ID: {rule_id}")
    return result
