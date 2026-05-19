import os
import shutil
import sqlite3
from fastapi import FastAPI, UploadFile, File
from openai import OpenAI
from dotenv import load_dotenv
from prompts import SYSTEM_PROMPT_TEMPLATE
from db_utils import extract_schema

load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

app = FastAPI()

DB_PATH = "chinook.sqlite"

@app.post("/process-voice")
async def process_voice(file: UploadFile = File(...)):
    temp_audio_path = f"temp_{file.filename}"
    with open(temp_audio_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    with open(temp_audio_path, "rb") as audio_file:
        transcription = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            language="ru"
        )

    user_text = transcription.text
    os.remove(temp_audio_path)

    db_schema = extract_schema(DB_PATH)
    if not db_schema:
        return {"status": "error", "message": "Database schema is empty or missing"}

    final_system_prompt = SYSTEM_PROMPT_TEMPLATE.format(schema=db_schema)

    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": final_system_prompt},
            {"role": "user", "content": user_text}
        ]
    )

    sql_query = response.choices[0].message.content.strip()

    if sql_query.startswith("ERROR:"):
        return {"status": "error", "message": sql_query, "text": user_text}

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(sql_query)
        rows = cursor.fetchall()
        columns = [description[0] for description in cursor.description]
        conn.close()

        result_data = [dict(zip(columns, row)) for row in rows]
        return {"status": "success", "text": user_text, "sql": sql_query, "data": result_data}


    except sqlite3.Error as db_error:

        error_msg = str(db_error)

        correction_prompt = (

            f"Your previous SQL query caused an error in SQLite: {error_msg}\n"

            f"Previous query was:\n{sql_query}\n\n"

            f"Fix the query. Critical requirements:\n"

            f"1. Output exactly ONE single valid SQL statement.\n"

            f"2. Do not use semicolons to chain multiple queries.\n"

            f"3. If the user asked for multiple unrelated things, combine them using UNION or prioritize the first request so it fits into a single SELECT statement."

        )

        response2 = client.chat.completions.create(

            model="gpt-3.5-turbo",

            messages=[

                {"role": "system", "content": final_system_prompt},

                {"role": "user", "content": user_text},

                {"role": "assistant", "content": sql_query},

                {"role": "user", "content": correction_prompt}

            ]

        )

        fixed_sql = response2.choices[0].message.content.strip()

        try:

            conn = sqlite3.connect(DB_PATH)

            cursor = conn.cursor()

            cursor.execute(fixed_sql)

            rows = cursor.fetchall()

            columns = [description[0] for description in cursor.description]

            conn.close()

            result_data = [dict(zip(columns, row)) for row in rows]

            explanation_response = client.chat.completions.create(

                model="gpt-3.5-turbo",

                messages=[

                    {"role": "system",
                     "content": "Ты голосовой ассистент. Объясни пользователю на русском языке в одном коротком предложении, почему его сложный запрос был изменен или упрощен для базы данных и что именно ты сейчас вывел на экран. Будь краток."},

                    {"role": "user", "content": f"Пользователь просил: {user_text}\nИтоговый SQL запрос: {fixed_sql}"}

                ]

            )

            explanation = explanation_response.choices[0].message.content.strip()

            return {

                "status": "success_after_correction",

                "text": user_text,

                "explanation": explanation,

                "fixed_sql": fixed_sql,

                "data": result_data

            }

        except Exception as final_error:

            return {

                "status": "db_error",

                "text": user_text,

                "sql": fixed_sql,

                "message": str(final_error)

            }