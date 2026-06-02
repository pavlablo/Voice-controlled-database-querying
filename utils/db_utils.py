import sqlite3
import os


def extract_schema(db_path):
    if not os.path.exists(db_path):
        return None

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("SELECT name, sql FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()

    if not tables:
        conn.close()
        return None

    schema_text = "DATABASE STRUCTURE:\n"
    for table_name, table_sql in tables:
        if table_sql and not table_name.startswith("sqlite_"):
            schema_text += table_sql + "\n\n"

    # Universal sampling: first 3 non-system tables, 5 rows each
    schema_text += "---\n"
    schema_text += "CRITICAL DATA VALUES EXAMPLES (Use these EXACT spellings in WHERE clauses):\n"

    sampled = 0
    for table_name, _ in tables:
        if table_name.startswith("sqlite_"):
            continue
        if sampled >= 3:
            break
        try:
            cursor.execute(f"SELECT * FROM '{table_name}' LIMIT 5;")
            rows = cursor.fetchall()
            col_names = [desc[0] for desc in cursor.description]

            if rows:
                schema_text += f"\nTable '{table_name}' sample rows:\n"
                schema_text += "  Columns: " + ", ".join(col_names) + "\n"
                for row in rows:
                    schema_text += "  " + str(dict(zip(col_names, row))) + "\n"
            sampled += 1
        except sqlite3.Error:
            continue

    conn.close()
    return schema_text