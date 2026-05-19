import sqlite3


def extract_schema(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("SELECT sql FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()

    conn.close()

    if not tables:
        return None

    schema_text = ""
    for table in tables:
        if table[0]:
            schema_text += table[0] + "\n\n"

    return schema_text