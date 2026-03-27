from pathlib import Path

from garud_drishti.backend.utils.db import get_db


def main():
    schema_path = Path(__file__).parent / "schema_v2.sql"
    sql = schema_path.read_text(encoding="utf-8")
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            conn.commit()
    print("Schema created/verified.")


if __name__ == "__main__":
    main()
