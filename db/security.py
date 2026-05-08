import base64, hashlib, hmac, json, os, time
from typing import Any

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
TOKEN_TTL_SECONDS = int(os.getenv("TOKEN_TTL_SECONDS", "86400"))


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def hash_password(password: str, salt: str | None = None) -> str:
    salt = salt or _b64(os.urandom(16))
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120_000)
    return f"pbkdf2_sha256${salt}${_b64(digest)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, salt, expected = stored.split("$", 2)
        return hmac.compare_digest(hash_password(password, salt).split("$", 2)[2], expected)
    except Exception:
        return False


def create_token(payload: dict[str, Any]) -> str:
    body = {**payload, "exp": int(time.time()) + TOKEN_TTL_SECONDS}
    header = {"alg": "HS256", "typ": "JWT"}
    signing_input = f"{_b64(json.dumps(header, separators=(',', ':')).encode())}.{_b64(json.dumps(body, separators=(',', ':')).encode())}"
    sig = hmac.new(SECRET_KEY.encode(), signing_input.encode(), hashlib.sha256).digest()
    return f"{signing_input}.{_b64(sig)}"


def decode_token(token: str) -> dict[str, Any] | None:
    try:
        h, p, s = token.split(".")
        expected = _b64(hmac.new(SECRET_KEY.encode(), f"{h}.{p}".encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(expected, s):
            return None
        payload = json.loads(_unb64(p))
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None
