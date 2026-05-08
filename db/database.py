import os, sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterable, Any

try:
    import psycopg
    from psycopg.rows import dict_row
except Exception:  # optional until requirements are installed
    psycopg = None
    dict_row = None

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./edusync.db")


def is_postgres() -> bool:
    return DATABASE_URL.startswith(("postgres://", "postgresql://"))


@contextmanager
def connect():
    if is_postgres():
        if psycopg is None:
            raise RuntimeError("psycopg is required for PostgreSQL. Install backend/requirements.txt")
        with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
            yield conn
    else:
        path = DATABASE_URL.replace("sqlite:///", "")
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()


def q(sql: str) -> str:
    return sql.replace("?", "%s") if is_postgres() else sql


def rows(cur) -> list[dict[str, Any]]:
    fetched = cur.fetchall()
    return [dict(r) for r in fetched]


def one(cur) -> dict[str, Any] | None:
    r = cur.fetchone()
    return dict(r) if r else None


def execute(conn, sql: str, params: Iterable[Any] = ()):
    cur = conn.cursor()
    cur.execute(q(sql), tuple(params))
    return cur


def init_db() -> None:
    schema = Path(__file__).with_name("schema.sql").read_text(encoding="utf-8")
    with connect() as conn:
        if is_postgres():
            pg_schema = schema.replace("INTEGER PRIMARY KEY AUTOINCREMENT", "SERIAL PRIMARY KEY")
            # PostgreSQL does not allow CURRENT_TIMESTAMP as a default for TEXT columns.
            pg_schema = pg_schema.replace("TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP", "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP")
            pg_schema = pg_schema.replace("TEXT DEFAULT CURRENT_TIMESTAMP", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
            for stmt in pg_schema.split(";"):
                if stmt.strip():
                    conn.execute(stmt)
        else:
            conn.executescript(schema)
