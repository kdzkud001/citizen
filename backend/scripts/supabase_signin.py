"""
Dev helper: sign in to Supabase with an email/password and print the
resulting access token, for pasting into the Authorize button on /docs
(or into an Authorization: Bearer header by hand).

Credentials are read from the command line, never from a file -- your
password is not something to have sitting in .env.

Usage:
    python -m scripts.supabase_signin --email you@example.com --password ...
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import httpx
from dotenv import load_dotenv

_ROOT_ENV_FILE = Path(__file__).resolve().parent.parent.parent / ".env"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    args = parser.parse_args()

    load_dotenv(dotenv_path=_ROOT_ENV_FILE, override=False)
    supabase_url = os.environ["SUPABASE_URL"]
    anon_key = os.environ["SUPABASE_ANON_KEY"]

    response = httpx.post(
        f"{supabase_url}/auth/v1/token",
        params={"grant_type": "password"},
        headers={"apikey": anon_key},
        json={"email": args.email, "password": args.password},
    )
    if response.status_code != 200:
        print(f"Sign-in failed ({response.status_code}): {response.text}", file=sys.stderr)
        raise SystemExit(1)

    body = response.json()
    print(body["access_token"])


if __name__ == "__main__":
    main()
