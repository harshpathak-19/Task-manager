"""
Verifies the Supabase access token sent by the frontend.

How it works:
- When a user logs in with Google via Supabase Auth, Supabase issues a
  JWT (the "access_token") to the frontend.
- The frontend sends that token in the Authorization header on every
  API call: "Authorization: Bearer <token>".
- Supabase signs these tokens with a project-specific secret (found in
  Project Settings > API > JWT Settings). We use that same secret here
  to verify the token wasn't forged, and to read who the user is
  (their Supabase user id + email) straight out of the token — no
  extra network call needed.
"""
import os
import jwt
from functools import wraps
from flask import request, jsonify, g

SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET")


def decode_token(token: str):
    return jwt.decode(
        token,
        SUPABASE_JWT_SECRET,
        algorithms=["HS256"],
        audience="authenticated",
    )


def require_auth(f):
    """Decorator: rejects the request unless a valid Supabase JWT is
    present, and makes the caller's user id/email available as
    g.user_id / g.user_email inside the route."""

    @wraps(f)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing bearer token"}), 401

        token = auth_header.split(" ", 1)[1]
        try:
            payload = decode_token(token)
        except jwt.PyJWTError as e:
            return jsonify({"error": f"Invalid token: {str(e)}"}), 401

        g.user_id = payload.get("sub")
        g.user_email = payload.get("email")
        return f(*args, **kwargs)

    return wrapper
