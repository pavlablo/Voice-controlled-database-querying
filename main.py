import os
import shutil
import sqlite3
import json
from fastapi import FastAPI, UploadFile, File, Query, Form
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
os.makedirs("user_data", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

KNOWN_DATABASES = {
    "booking_db.sqlite": {
        "label": "Hotel Reviews",
        "description_ru": "Отели, гости, отзывы с оценками по категориям",
        "description_en": "Hotels, guests, reviews with category ratings",
        "description_sk": "Hotely, hostia, recenzie s hodnoteniami",
        "emoji": "🏨"
    },
    "chinook.sqlite": {
        "label": "Music Store",
        "description_ru": "Треки, альбомы, артисты, продажи",
        "description_en": "Tracks, albums, artists, invoices",
        "description_sk": "Skladby, albumy, umelci, faktúry",
        "emoji": "🎵"
    },
    "comparedge_v1.sqlite": {
        "label": "SaaS Compare",
        "description_ru": "Продукты, категории, тарифы, история цен",
        "description_en": "Products, categories, pricing plans, price history",
        "description_sk": "Produkty, kategórie, tarify, história cien",
        "emoji": "📊"
    },
    "tenis.sqlite": {
        "label": "Tennis ATP/WTA",
        "description_ru": "Матчи, игроки, турниры, статистика",
        "description_en": "Matches, players, tournaments, statistics",
        "description_sk": "Zápasy, hráči, turnaje, štatistiky",
        "emoji": "🎾"
    },
}

BACKEND_ERRORS = {
    "ru": {
        "db_not_found": "Файл БД не найден",
        "invalid_db": "Неверный файл базы данных SQLite.",
        "schema_fail": "Не удалось прочитать структуру базы данных.",
        "auto_fix_fail": "Авто-исправление не удалось"
    },
    "en": {
        "db_not_found": "Database file not found",
        "invalid_db": "Invalid SQLite database file.",
        "schema_fail": "Failed to read database schema.",
        "auto_fix_fail": "Auto-fix failed"
    },
    "sk": {
        "db_not_found": "Súbor databázy nebol nájdený",
        "invalid_db": "Neplatný súbor databázy SQLite.",
        "schema_fail": "Nepodarilo sa načítať schému databázy.",
        "auto_fix_fail": "Automatická oprava zlyhala"
    }
}

class QueryRequest(BaseModel):
    text: str
    lang: str = "en"
    db: str = "chinook.sqlite"

class RawSqlRequest(BaseModel):
    sql: str
    db: str = "chinook.sqlite"
    lang: str = "en"

def resolve_db_path(db_filename: str) -> str:
    safe_name = os.path.basename(db_filename)
    path_data = os.path.join("data", safe_name)
    if os.path.exists(path_data):
        return path_data
    return os.path.join("user_data", safe_name)

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

@app.get("/databases")
async def list_databases():
    databases = []
    try:
        for folder in ["data", "user_data"]:
            if not os.path.exists(folder):
                continue
            for filename in sorted(os.listdir(folder)):
                if filename.endswith((".sqlite", ".db")):
                    filepath = os.path.join(folder, filename)
                    try:
                        conn = sqlite3.connect(filepath)
                        conn.execute("SELECT name FROM sqlite_master WHERE type='table' LIMIT 1;")
                        conn.close()
                        is_valid = True
                    except Exception:
                        is_valid = False

                    if not is_valid:
                        continue

                    meta = KNOWN_DATABASES.get(filename, {
                        "label": filename.replace(".sqlite", "").replace(".db", "").replace("_", " ").title(),
                        "description_ru": filename,
                        "description_en": filename,
                        "description_sk": filename,
                        "emoji": "🗄️"
                    })

                    databases.append({
                        "filename": filename,
                        "label": meta["label"],
                        "emoji": meta["emoji"],
                        "descriptions": {
                            "ru": meta["description_ru"],
                            "en": meta["description_en"],
                            "sk": meta["description_sk"],
                        }
                    })
    except Exception as e:
        return {"status": "error", "message": str(e)}

    return {"databases": databases}

@app.get("/schema")
async def get_db_schema(db: str = Query("chinook.sqlite"), lang: str = Query("en")):
    db_path = resolve_db_path(db)
    err_dict = BACKEND_ERRORS.get(lang, BACKEND_ERRORS["en"])

    if not os.path.exists(db_path):
        return {"status": "error", "message": f"{err_dict['db_not_found']}: {db_path}"}

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type IN ('table', 'view');")
        tables = cursor.fetchall()
        schema_data = []

        for table in tables:
            table_name = table[0]
            if table_name.startswith("sqlite_"):
                continue

            try:
                cursor.execute(f'PRAGMA table_info("{table_name}");')
                cols = cursor.fetchall()
                schema_data.append({
                    "name": table_name,
                    "columns": [{"name": c[1], "type": str(c[2]) if c[2] else "UNKNOWN", "pk": c[5] > 0} for c in cols]
                })
            except sqlite3.OperationalError:
                continue

        conn.close()
        return {"schema_json": schema_data}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/upload-db")
async def upload_db(file: UploadFile = File(...), lang: str = Form("en")):
    file_path = f"user_data/{os.path.basename(file.filename)}"
    err_dict = BACKEND_ERRORS.get(lang, BACKEND_ERRORS["en"])

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    schema = extract_schema(file_path)
    if not schema:
        os.remove(file_path)
        return {"status": "error", "message": err_dict["invalid_db"]}

    return {
        "status": "success",
        "message": "OK",
        "db_name": os.path.basename(file.filename)
    }

@app.post("/execute-sql")
async def execute_sql(request: QueryRequest):
    db_path = resolve_db_path(request.db)
    db_schema = extract_schema(db_path)
    err_dict = BACKEND_ERRORS.get(request.lang, BACKEND_ERRORS["en"])

    if not db_schema:
        return {"status": "error", "message": err_dict["schema_fail"]}

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
        conn = sqlite3.connect(db_path)
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

            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute(fixed_sql)
            rows = cursor.fetchall()
            columns = [description[0] for description in cursor.description]
            conn.close()

            data = [dict(zip(columns, row)) for row in rows]
            meta = get_user_explanation(request.text, fixed_sql, request.lang)
            return {"status": "success", "sql": fixed_sql, "data": data, **meta}
        except Exception as final_error:
            return {"status": "error", "message": f"{err_dict['auto_fix_fail']}: {str(final_error)} ({error_msg})"}

@app.post("/run-raw-sql")
async def run_raw_sql(request: RawSqlRequest):
    db_path = resolve_db_path(request.db)
    err_dict = BACKEND_ERRORS.get(request.lang, BACKEND_ERRORS["en"])

    if not os.path.exists(db_path):
        return {"status": "error", "message": err_dict["db_not_found"]}
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute(request.sql)
        rows = cursor.fetchall()
        columns = [description[0] for description in cursor.description]
        conn.close()
        data = [dict(zip(columns, row)) for row in rows]
        return {"status": "success", "data": data}
    except sqlite3.Error as e:
        return {"status": "error", "message": str(e)}

@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...), lang: str = Form("ru")):
    with open("temp.webm", "wb") as b:
        shutil.copyfileobj(file.file, b)
    try:
        with open("temp.webm", "rb") as a:
            t = client.audio.transcriptions.create(model="whisper-1", file=a, language=lang)
        return {"text": t.text}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        if os.path.exists("temp.webm"):
            os.remove("temp.webm")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)