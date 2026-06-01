import os
import sqlite3
from openai import OpenAI
from dotenv import load_dotenv
from utils.prompts import SYSTEM_PROMPT_TEMPLATE
from utils.db_utils import extract_schema

load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
DB_PATH = "data/chinook.sqlite"
AUDIO_DIR = "audio_samples"


def print_table(columns, rows):
    if not rows:
        print("The database returned an empty result.\n")
        return

    col_widths = [len(str(col)) for col in columns]
    for row in rows:
        for i, cell in enumerate(row):
            col_widths[i] = max(col_widths[i], len(str(cell)))

    row_format = " | ".join([f"{{:<{w}}}" for w in col_widths])

    print("\n" + "=" * (sum(col_widths) + 3 * len(columns) - 1))
    print(row_format.format(*columns))
    print("-" * (sum(col_widths) + 3 * len(columns) - 1))

    for row in rows:
        safe_row = [str(cell) if cell is not None else 'NULL' for cell in row]
        print(row_format.format(*safe_row))

    print("=" * (sum(col_widths) + 3 * len(columns) - 1) + "\n")


def main():
    print("\n"+"="*50)
    print("Voice-to-SQL Console Assistant started")
    print("="*50)
    print("Instructions:")
    print("1. Enter a text query (example, 'show 5 longest tracks').")
    print("2. Type 'file' to select an audio file from the audio_samples folder.")
    print("3. Type 'exit' or 'quit' to close the application.\n")

    db_schema = extract_schema(DB_PATH)
    if not db_schema:
        print("Error: Failed to read the database schema. Check the path.")
        return

    final_system_prompt = SYSTEM_PROMPT_TEMPLATE.format(schema=db_schema)

    while True:
        try:
            user_input = input("🗣️ Your query: ").strip()
        except KeyboardInterrupt:
            break

        if user_input.lower() in ['exit', 'quit']:
            print("Shutting down. Goodbye!")
            break

        if not user_input:
            continue

        if user_input.lower() == 'file':
            if not os.path.exists(AUDIO_DIR):
                print(f"Error: Folder '{AUDIO_DIR}' not found.\n")
                continue

            files = [f for f in os.listdir(AUDIO_DIR) if f.endswith(('.mp3', '.wav', '.m4a', '.webm'))]

            if not files:
                print(f"No audio files found in '{AUDIO_DIR}'.\n")
                continue

            print("Available files:")
            valid_names = {}
            for f in files:
                name_without_ext = os.path.splitext(f)[0]
                valid_names[name_without_ext] = os.path.join(AUDIO_DIR, f)
                print(f"   - {name_without_ext}")

            chosen_name = input("Enter file name: ").strip()

            if chosen_name in valid_names:
                user_input = valid_names[chosen_name]
            else:
                print("File not found. Returning to main menu.\n")
                continue

        user_text = user_input

        if os.path.isfile(user_input) and user_input.lower().endswith(('.mp3', '.wav', '.m4a', '.webm')):
            print("Transcribing audio via Whisper...")
            try:
                with open(user_input, "rb") as audio_file:
                    transcription = client.audio.transcriptions.create(
                        model="whisper-1",
                        file=audio_file
                    )
                user_text = transcription.text
                print(f"Transcribed text: {user_text}")
            except Exception as e:
                print(f"Transcription error: {e}\n")
                continue

        print("Generating SQL...")

        try:
            response = client.chat.completions.create(
                model="gpt-5-chat-latest",
                messages=[
                    {"role": "system", "content": final_system_prompt},
                    {"role": "user", "content": user_text}
                ]
            )
            sql_query = response.choices[0].message.content.strip()
        except Exception as e:
            print(f"OpenAI API error: {e}\n")
            continue

        if sql_query.startswith("ERROR:"):
            print(f"AI Response: {sql_query}\n")
            continue

        print(f"Final SQL: \n{sql_query}\n")

        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute(sql_query)
            rows = cursor.fetchall()
            columns = [description[0] for description in cursor.description]
            conn.close()

            print("Result:")
            print_table(columns, rows)

        except sqlite3.Error as db_error:
            error_msg = str(db_error)
            print(f"⚠Database error: {error_msg}")
            print("Attempting to auto-fix the SQL query...")

            correction_prompt = (
                f"Your previous SQL query caused an error: {error_msg}\n"
                f"Fix it. 1 statement only. Use UNION ALL if needed. Use Subqueries if using ORDER BY with UNION."
            )

            try:
                response2 = client.chat.completions.create(
                    model="gpt-5-chat-latest",
                    messages=[
                        {"role": "system", "content": final_system_prompt},
                        {"role": "user", "content": user_text},
                        {"role": "assistant", "content": sql_query},
                        {"role": "user", "content": correction_prompt}
                    ]
                )
                fixed_sql = response2.choices[0].message.content.strip()
                print(f"🛠️ Fixed SQL: \n{fixed_sql}\n")
A
                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()
                cursor.execute(fixed_sql)
                rows = cursor.fetchall()
                columns = [description[0] for description in cursor.description]
                conn.close()

                print("Result (after fix):")
                print_table(columns, rows)

            except Exception as final_error:
                print(f"Failed to fix the error: {final_error}\n")


if __name__ == "__main__":
    main()