"""Functions for managing products in a magento catalog using the REST API."""

import base64
import copy
import random
from pathlib import Path
from urllib.parse import urljoin
from uuid import uuid4

import requests
from bs4 import BeautifulSoup

from webarena.shopping.utils.auth import STORE_URL
from webarena.shopping.utils.completions import get_completion_from_openai
from webarena.shopping.utils.store_requests import make_authenticated_request


def get_image_sources(url):
    """Fetch all <img> tag src attributes from a given URL using BeautifulSoup."""
    response = requests.get(url, timeout=10)

    # Select all <img> elements
    try:
        # Fetch the HTML content
        response = requests.get(url, timeout=10)
        response.raise_for_status()  # Raise HTTPError for bad responses

        soup = BeautifulSoup(response.text, "html.parser")
        img_elements = soup.find_all("img", class_="gallery-placeholder__image")
        image_urls = []
        for img_tag in img_elements:
            src = img_tag.get("src")
            if not src:
                continue

            image_urls.append(src)

        return image_urls

    except requests.exceptions.RequestException as e:
        print(f"Error fetching page: {e}")
        return []


def post_product_image(token, sku, img_data):
    """Post product image to the catalog.

    Args:
        token: Bearer token
        sku: Product SKU of the product to which the image will be added
        img_data: Base64 encoded image data

    Returns:
        Response JSON or None

    """
    image_payload = {
        "entry": {
            "media_type": "image",
            "label": "Product Image",
            "position": 1,
            "disabled": False,
            "types": ["image", "small_image", "thumbnail", "swatch_image"],
            "content": {
                "base64_encoded_data": img_data,
                "type": "image/jpeg",
                "name": f"product_image_{sku}.jpg",
            },
        }
    }

    endpoint = f"/rest/V1/products/{sku}/media"
    result = make_authenticated_request(
        token, endpoint, method="POST", data=image_payload
    )

    if result:
        print(f"✓ Added image to product with SKU: {sku}")
    else:
        print(f"✗ Failed to add image to product with SKU: {sku}")

    return result


def update_product(token, sku, payload):
    """Update the price of a product in the catalog."""
    result = make_authenticated_request(
        token,
        f"/rest/V1/products/{sku}",
        method="PUT",
        data=payload,
    )

    if result:
        print(f"Updated product with SKU: {sku}")
    else:
        print(f"Failed to update product with SKU: {sku}")

    return result


def remove_product(token, sku):
    """Remove a product from the catalog using the REST API.

    Args:
        token: Bearer token
        sku: Product SKU to be removed

    """
    print(f"\nRemoving product with SKU: {sku}...")
    endpoint = f"/rest/V1/products/{sku}"
    result = make_authenticated_request(token, endpoint, method="DELETE")
    if result is not None:
        print(f"Removed product with SKU: {sku}")
    else:
        print(f"Failed to remove product with SKU: {sku}")


def add_product(token, sku, product):
    """Add a new product to the catalog, along with its image data encoded in base64.

    Args:
        token: Bearer token
        sku: Product SKU
        product: Product data as a JSON object

    """
    img_data = product.get("image_data_base64", None)
    if img_data:
        # Remove image data from product payload before adding the product
        del product["image_data_base64"]

    print(f"\nAdding product with SKU: {sku}...")
    result = make_authenticated_request(
        token,
        "/rest/V1/products",
        method="POST",
        data=product,
    )

    if result:
        print(f"Created product: {result.get('name')}")
        print(f"  SKU: {result.get('sku')}")
        print(f"  ID: {result.get('id')}")

        # Post product image as a separate REST call after creating the product
        if not img_data:
            # If no image data provided, try to read from local file for default events
            image_path = Path.cwd() / Path(f"product_images/{sku}.jpg")
            with open(image_path, "rb") as image_file:
                # Read and encode image data to base64
                image_data = image_file.read()
                img_data = base64.b64encode(image_data).decode("utf-8")

        post_product_image(token, sku, img_data)
    else:
        print("Failed to create product")


def get_random_product_from_catalog(token, in_stock=True):
    """Get a random product from the catalog.

    Args:
        token: Bearer token for authentication
        in_stock: Boolean indicating whether to filter for in-stock products (not implemented yet)

    Returns:
        Random product from the catalog or None if no product is found.

    """
    print("Fetching products from catalog...")
    endpoint = "/rest/V1/products?searchCriteria[pageSize]=100"

    result = make_authenticated_request(token, endpoint)

    if result:
        items = result.get("items", [])
        total = result.get("total_count", 0)
        print(
            f"✓ Found {total} total products, In stock={in_stock}, showing {len(items)}"
        )

        # Request a range of products
        pages = total // 10
        random_page = random.randint(1, pages)
        print(f"Fetching products from random page: {random_page + 1}...")
        endpoint = f"/rest/V1/products?searchCriteria[pageSize]=10&searchCriteria[currentPage]={random_page}"
        result = make_authenticated_request(token, endpoint)
        if result:
            items = result.get("items", [])

            # filter out products that are not simple products
            items = [item for item in items if item.get("type_id") == "simple"]

            # Select a random item
            random_item = random.choice(items)
            print(
                f"Randomly selected product: SKU={random_item.get('sku')}, Name={random_item.get('name')}"
            )
            return random_item

        return None
    else:
        print("✗ Failed to fetch products from catalog")
        return None


def get_product_by_sku(token, sku):
    """Get a product from the catalog by SKU.

    Args:
        token: Bearer token for authentication
        sku: Product SKU to search for

    """
    endpoint = f"/rest/V1/products/{sku}"
    result = make_authenticated_request(token, endpoint)

    if result:
        print(f"Found product: SKU={result.get('sku')}, Name={result.get('name')}")
        return result
    else:
        print(f"Failed to find product with SKU: {sku}")
        return None


def get_product_name_from_description(original_name, description):
    """Generate a new product name based on the original name and description, using an LLM."""
    prompt = """Using the following product description and original name from an online store,
    generate a concise and catchy test product name that accurately reflects the product's features and benefits.

    Original Product Name: "{original_name}"
    Product Description: "{description}"""

    # Get API provider for GPT-5
    response = get_completion_from_openai(
        prompt.format(original_name=original_name, description=description),
        model="gpt-5",
    )

    return response.strip()


def download_product_image(url_key, sku):
    """Download the main product image for a given SKU.

    Args:
        url_key: The URL key of the product page.
        sku: The SKU for the product to be used for naming the image.

    Returns:
        Path to the downloaded image file or None if no image is found.

    """
    # Get the image data using the product URL and beautifulsoup
    product_url = urljoin(STORE_URL, f"{url_key}.html")

    images = get_image_sources(product_url)
    if images:
        first_url = images[0]

        # Download the image using requests
        response = requests.get(first_url)
        if response.status_code == 200:
            # Create product_images directory if it doesn't exist
            Path.cwd().joinpath("product_images").mkdir(parents=True, exist_ok=True)

            # Save the image under the new SKU name
            image_path = Path.cwd() / Path(f"product_images/{sku}.jpg")
            with open(image_path, "wb") as f:
                f.write(response.content)
            print(f"✓ Downloaded image to {image_path}")
            return image_path

    else:
        print("No image found on the product page.")
        return None


def clone_product(product):
    """Create a cloned product of the given product with modified name, description, and SKU."""
    url_key = list(
        filter(
            lambda x: x["attribute_code"] == "url_key",
            product["custom_attributes"],
        )
    )

    # Update the SKU and name of the product to make it unique
    new_product = copy.deepcopy(product)
    del new_product["created_at"]
    del new_product["updated_at"]
    del new_product["extension_attributes"]["website_ids"]
    del new_product["id"]
    del new_product["options"]  # not handling options for now.

    # Add random quantity
    new_product["extension_attributes"]["stock_item"] = {
        "qty": random.randint(10, 100),
        "is_in_stock": True,
    }

    # Clear out prior image content from custom_attributes. Otherwise this will cause issues when adding the product.
    custom_attributes = list(
        filter(
            lambda x: x["attribute_code"]
            not in ["image", "small_image", "thumbnail", "swatch_image"],
            new_product["custom_attributes"],
        )
    )
    new_product["custom_attributes"] = custom_attributes

    del new_product["media_gallery_entries"]

    new_product = {"product": new_product}
    product_id = uuid4()
    new_product["product"]["sku"] = f"{new_product['product']['sku']}-{product_id}"

    image_path = download_product_image(
        url_key[0]["value"], new_product["product"]["sku"]
    )
    if image_path is None:
        return None

    product_description = list(
        filter(
            lambda x: x["attribute_code"] == "description",
            new_product["product"]["custom_attributes"],
        )
    )
    if len(product_description) > 0:
        product_description = product_description[0]["value"]
    else:
        product_description = ""

    new_product["product"]["name"] = get_product_name_from_description(
        new_product["product"]["name"], product_description
    )
    print(f"Generated new product name: {new_product['product']['name']}")

    # Make URL key unique
    url_key = list(
        filter(
            lambda x: x["attribute_code"] == "url_key",
            new_product["product"]["custom_attributes"],
        )
    )
    if url_key:
        url_key[0]["value"] = f"{url_key[0]['value']}-{product_id}"

    return new_product


def generate_product_from_catalog(token):
    """Create a new product in the catalog, as a JSON."""
    random_product = get_random_product_from_catalog(token)
    if not random_product:
        return None

    new_product = clone_product(random_product)
    return new_product


def generate_restock_event(token, sku, qty=None):
    """Generate a restock event payload for a given product SKU."""
    endpoint = f"/rest/V1/stockItems/{sku}"
    stock_item_response = make_authenticated_request(token, endpoint)

    if stock_item_response:
        if qty is not None:
            new_qty = qty
        else:
            additional_quantity = random.randint(20, 100)
            current_qty = stock_item_response.get("qty", 0)
            new_qty = current_qty + additional_quantity

        stock_payload = {
            "stockItem": {
                "qty": new_qty,
                "is_in_stock": True,
            },
            "sku": sku,
        }
        return stock_payload
    else:
        print(f"Failed to fetch stock item for SKU: {sku}")
        return None


def update_stock_for_product(token, sku, payload):
    """Restock a product by increasing its quantity.

    Args:
        token: Bearer token
        sku: Product SKU
        payload: Payload containing updated stock information

    Returns:
        Response JSON or None

    """
    print(f"\nRestocking product with SKU: {sku}...")

    # Update the stock item with the new quantity
    result = make_authenticated_request(
        token,
        f"/rest/V1/products/{sku}/stockItems/1",
        method="PUT",
        data=payload,
    )

    if result:
        print(
            f"Restocked product with SKU: {sku}. New quantity: {payload['stockItem']['qty']}"
        )
    else:
        print(f"Failed to restock product with SKU: {sku}")

    return result
