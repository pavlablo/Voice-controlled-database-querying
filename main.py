import os
import shutil
import sqlite3
import json
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv
from utils.prompts import SYSTEM_PROMPT_TEMPLATE
from utils.db_utils import extract_schema

load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

app = FastAPI()

os.makedirs("static", exist_ok=True)
os.makedirs("data", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

DB_PATH = "data/chinook.sqlite"


class QueryRequest(BaseModel):
    text: str
    lang: str = "en"


def get_user_explanation(user_text, final_sql, lang):
    lang_names = {"ru": "Russian", "en": "English", "sk": "Slovak"}
    target_lang = lang_names.get(lang, "English")

    response = client.chat.completions.create(
        model="gpt-5-chat-latest",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system",
             "content": f"You are a voice assistant. Respond strictly in JSON format: {{\"explanation\": \"your short explanation in {target_lang} language\", \"chart_type\": \"bar|pie|line|none\"}}. Choose 'bar' or 'pie' if the query has aggregation (GROUP BY, COUNT, SUM). Otherwise, return 'none'."},
            {"role": "user", "content": f"User text: {user_text}\nSQL: {final_sql}"}
        ]
    )
    return json.loads(response.choices[0].message.content.strip())


@app.get("/")
async def get_frontend():
    with open("index.html", "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())


# === ЭТИ ДВА МАРШРУТА БЫЛИ ПОТЕРЯНЫ ===
@app.get("/schema")
async def get_db_schema():
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        schema_data = []
        for table in tables:
            if table[0].startswith("sqlite_"): continue
            cursor.execute(f"PRAGMA table_info('{table[0]}');")
            cols = cursor.fetchall()
            schema_data.append(
                {"name": table[0], "columns": [{"name": c[1], "type": c[2], "pk": c[5] > 0} for c in cols]})
        conn.close()
        return {"schema_json": schema_data}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.post("/upload-db")
async def upload_db(file: UploadFile = File(...)):
    global DB_PATH
    file_path = f"data/{file.filename}"

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    DB_PATH = file_path

    schema = extract_schema(DB_PATH)
    if not schema:
        DB_PATH = "data/chinook.sqlite"
        return {"status": "error", "message": "Invalid SQLite database file. Reverted to default."}

    return {"status": "success", "message": "Database successfully loaded!", "db_name": file.filename}


# ======================================


@app.post("/execute-sql")
async def execute_sql(request: QueryRequest):
    db_schema = extract_schema(DB_PATH)
    if not db_schema:
        return {"status": "error", "message": "Failed to read database schema."}

    final_system_prompt = SYSTEM_PROMPT_TEMPLATE.format(schema=db_schema)

    try:
        response = client.chat.completions.create(
            model="gpt-5-chat-latest",
            messages=[
                {"role": "system", "content": final_system_prompt},
                {"role": "user", "content": request.text}
            ]
        )
        sql_query = response.choices[0].message.content.strip()
    except Exception as e:
        return {"status": "error", "message": f"OpenAI error: {str(e)}"}

    if sql_query.startswith("ERROR:"):
        return {"status": "error", "message": sql_query}

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(sql_query)
        rows = cursor.fetchall()
        columns = [description[0] for description in cursor.description]
        conn.close()

        data = [dict(zip(columns, row)) for row in rows]
        meta = get_user_explanation(request.text, sql_query, request.lang)
        return {"status": "success", "sql": sql_query, "data": data, **meta}

    except sqlite3.Error as db_error:
        error_msg = str(db_error)
        correction_prompt = (
            f"Your previous SQL query caused an error: {error_msg}\n"
            f"Fix it. 1 statement only. Use UNION ALL if needed. Use Subqueries if using ORDER BY with UNION."
        )
        try:
            response2 = client.chat.completions.create(
                model="gpt-5-chat-latest",
                messages=[
                    {"role": "system", "content": final_system_prompt},
                    {"role": "user", "content": request.text},
                    {"role": "assistant", "content": sql_query},
                    {"role": "user", "content": correction_prompt}
                ]
            )
            fixed_sql = response2.choices[0].message.content.strip()

            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute(fixed_sql)
            rows = cursor.fetchall()
            columns = [description[0] for description in cursor.description]
            conn.close()

            data = [dict(zip(columns, row)) for row in rows]
            meta = get_user_explanation(request.text, fixed_sql, request.lang)
            return {"status": "success", "sql": fixed_sql, "data": data, **meta}
        except Exception as final_error:
            return {"status": "error", "message": f"Auto-fix failed: {str(final_error)} (Original error: {error_msg})"}


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    with open("temp.webm", "wb") as b:
        shutil.copyfileobj(file.file, b)
    try:
        with open("temp.webm", "rb") as a:
            t = client.audio.transcriptions.create(model="whisper-1", file=a)
        return {"text": t.text}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        if os.path.exists("temp.webm"):
            os.remove("temp.webm")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)