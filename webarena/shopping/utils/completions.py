"""Functions for interacting with the OpenAI API to generate completions and structured completions to generate synthetic product and review data."""

from openai import OpenAI
from pydantic import BaseModel


class ProductReview(BaseModel):
    """Schema describing information required for product review metadata."""

    rating: int
    review_text: str
    review_title: str
    nickname: str


def get_completion_from_openai(prompt, model="gpt-5", format="text"):
    """Return the completion text for the given prompt using the appropriate OpenAI API.

    Args:
        prompt (str): The input prompt to generate the completion for.
        model (str, optional): The OpenAI model to use for generating the completion. Defaults to "gpt-5".
        format (str, optional): The format of the completion. Defaults to "text".

    """
    client = OpenAI()
    completion = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        reasoning_effort="minimal",
    )
    message = completion.choices[0].message.content
    return message if isinstance(message, str) else message or ""


def get_structured_completion_from_openai(prompt, model="gpt-5", format=ProductReview):
    """Return the structured completion for the given prompt using the appropriate OpenAI API.

    Args:
        prompt (str): The input prompt to generate the completion for.
        model (str, optional): The OpenAI model to use for generating the completion. Defaults to "gpt-5".
        format (BaseModel, optional): The format of the completion. Defaults to `ProductReview`.

    """
    client = OpenAI()
    completion = client.chat.completions.parse(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        reasoning_effort="minimal",
        response_format=format,
    )
    return completion.choices[0].message.parsed
