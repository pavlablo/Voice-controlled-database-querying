import sqlite3
import os


def extract_schema(db_path):
    if not os.path.exists(db_path):
        return None

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("SELECT sql FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()

    if not tables:
        conn.close()
        return None

    schema_text = "DATABASE STRUCTURE:\n"
    for table in tables:
        if table[0]:
            schema_text += table[0] + "\n\n"

    try:
        cursor.execute("SELECT Name FROM Artist LIMIT 1000;")
        artists = [row[0] for row in cursor.fetchall() if row[0]]

        if artists:
            schema_text += "--- \n"
            schema_text += "CRITICAL DATA VALUES EXAMPLES (Use these EXACT spellings in WHERE clauses):\n"
            schema_text += "Table 'Artist' names: " + ", ".join(artists) + "\n"
    except sqlite3.Error:
        pass

    conn.close()
    return schema_text