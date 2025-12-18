"""Issue requests to the Magento 2 REST API using a Bearer token."""

import json

import requests

from webarena.shopping.utils.auth import STORE_URL


def make_authenticated_request(token, endpoint, method="GET", data=None):
    """Make an authenticated API request using Bearer token.

    Args:
        token: Bearer token
        endpoint: API endpoint (e.g., '/rest/V1/products')
        method: HTTP method (GET, POST, PUT, DELETE)
        data: Request payload (for POST/PUT)

    Returns:
        Response JSON or None

    """
    url = f"{STORE_URL}{endpoint}"

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    try:
        if method == "GET":
            response = requests.get(url, headers=headers)
        elif method == "POST":
            response = requests.post(url, json=data, headers=headers)
        elif method == "PUT":
            response = requests.put(url, json=data, headers=headers)
        elif method == "DELETE":
            response = requests.delete(url, headers=headers)
        else:
            raise ValueError(f"Unsupported HTTP method: {method}")

        response.raise_for_status()
        try:
            return response.json()
        except ValueError:
            return response.text

    except requests.exceptions.RequestException as e:
        print(f"API Request Error: {e}")
        if data is not None:
            print("Payload sent:")
            print(json.dumps(data, indent=2))
        if hasattr(e, "response") and e.response is not None:
            print(f"Response: {e.response.text}")
        return None
