"""Module for acquiring and creating Magento tokens to interact with the Magento REST API endpoints."""

import os

import requests

# Configuration so that use the correct URL both locally and in Docker
PORT = os.environ.get("MAGENTO_PORT", "7770")
URL = os.environ.get("MAGENTO_URL", "localhost")
STORE_URL = f"http://{URL}:{PORT}"  # Your Adobe Commerce store URL

ADMIN_USERNAME = "admin"  # Admin username
ADMIN_PASSWORD = "admin1234"  # Admin password

CUSTOMER_USERNAME = "sentineluser@sentinel.com"
CUSTOMER_PASSWORD = "test1234!"


def create_customer_account():
    """Get customer account using customer email and password.

    Returns:
        Customer account details in JSON format.

    """
    url = f"{STORE_URL}/rest/V1/customers"

    payload = {
        "customer": {
            "email": CUSTOMER_USERNAME,
            "firstname": "Sentinel",
            "lastname": "User",
            "store_id": 1,
            "website_id": 1,
        },
        "password": CUSTOMER_PASSWORD,
    }

    headers = {"Content-Type": "application/json"}

    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        print("✓ Successfully created customer account")
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error creating customer account: {e}")
        if hasattr(e, "response") and e.response is not None:
            print(f"Response: {e.response.text}")
        return None


def get_customer_token():
    """Get customer token using customer email and password.

    Returns:
        Bearer token string

    """
    url = f"{STORE_URL}/rest/V1/integration/customer/token"

    payload = {"username": CUSTOMER_USERNAME, "password": CUSTOMER_PASSWORD}

    headers = {"Content-Type": "application/json"}

    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        token = response.json()
        print("✓ Successfully obtained customer token")
        return token
    except requests.exceptions.RequestException as e:
        print(f"Error getting customer token: {e}")
        if hasattr(e, "response") and e.response is not None:
            print(f"Response: {e.response.text}")
        return None


def get_admin_token():
    """Get admin token using username and password.

    Returns:
        Bearer token string for the admin account.

    """
    url = f"{STORE_URL}/rest/V1/integration/admin/token"

    payload = {"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD}

    headers = {"Content-Type": "application/json"}

    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        token = response.json()
        print("✓ Successfully obtained admin token")
        return token
    except requests.exceptions.RequestException as e:
        print(f"Error getting admin token: {e}")
        if hasattr(e, "response") and e.response is not None:
            print(f"Response: {e.response.text}")
        return None
