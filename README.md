# 🎙️ Voice-to-SQL AI Assistant

![Python](https://img.shields.io/badge/Python-3.9+-blue.svg?style=flat&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=flat&logo=fastapi)
![SQLite](https://img.shields.io/badge/SQLite-07405E?style=flat&logo=sqlite)
![OpenAI](https://img.shields.io/badge/OpenAI-Whisper%20%7C%20GPT-412991.svg?style=flat&logo=openai)
![Vanilla JS](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E.svg?style=flat&logo=javascript&logoColor=black)
![Chart.js](https://img.shields.io/badge/Chart.js-FF6384?style=flat&logo=chartdotjs&logoColor=white)
![i18next](https://img.shields.io/badge/i18next-26A69A?style=flat&logo=i18next&logoColor=white)


<img src="assets/show.gif" width="750" alt="Voice-to-SQL Demo">

An intelligent web-based Data Science and Analytics assistant that empowers users to query SQLite databases using natural voice commands. The application leverages Large Language Models (LLMs) to seamlessly transcribe speech, convert natural language into precise SQL queries, execute them, and visualize the results dynamically.

## ✨ Key Features

* **Voice-Driven Analytics:** Captures audio directly from the browser and transcribes it using OpenAI's Whisper model. Supports English, Russian, and Slovak.
* **Intelligent Text-to-SQL:** Utilizes advanced LLMs to intelligently map natural language onto the uploaded database schema, ensuring accurate SQL generation.
* **Self-Healing SQL Execution:** Features an automated feedback loop. If the generated SQL encounters a database error, the AI analyzes the exception and automatically rewrites the query.
* **Dynamic Data Visualization:** Automatically detects aggregation queries (e.g., `GROUP BY`, `COUNT`) and renders responsive Bar, Pie, or Line charts.

![Generated Chart and Table](assets/stat2.png)

* **Custom Database Uploads:** Upload any `.sqlite` or `.db` file directly through the minimalist UI. The system automatically extracts and registers the database schema.
* **Built-in SQL Editor:** Inspect, edit, and manually execute the generated SQL queries for full transparency and control.
* **Internationalization (i18n):** Fully localized interface powered by `i18next`, dynamically switching between RU, EN, and SK without page reloads.
* **CSV Export:** Download query results instantly for further data analysis.

## 🏗️ Architecture

```mermaid
flowchart TD
    A["🎤 Browser\n(MediaRecorder API)"]
    B["POST /transcribe\nwhisper-1"]
    C["Transcribed Text"]
    D["POST /execute-sql\nGPT-4o"]
    E["DB Schema\n(extract_schema)"]
    F{"SQL\nValid?"}
    G["POST /execute-sql\nGPT-4o auto-fix"]
    H["SQLite Execute"]
    I["JSON Result"]
    J{"Aggregation?\nGROUP BY / COUNT"}
    K["📊 Chart.js\n(Bar / Pie / Line)"]
    L["📋 Table + CSV Export"]

    A -->|audio blob| B
    B --> C
    C --> D
    E -->|schema context| D
    D -->|SQL query| F
    F -->|✅ OK| H
    F -->|❌ Error| G
    G -->|fixed SQL| H
    H --> I
    I --> J
    J -->|yes| K
    J -->|no| L
```

## 🛠 Comprehensive Tech Stack

**Backend & Architecture**
* **Python 3.9+** — Core backend language.
* **FastAPI** — High-performance, asynchronous web framework.
* **Uvicorn** — Lightning-fast ASGI server.
* **Pydantic** — Strict data validation and settings management using Python type annotations.
* **SQLite3** — Native database engine for executing dynamic queries and extracting schemas.
* **python-multipart** — Handling raw database file uploads.
* **python-dotenv** — Secure environment variable management.

**AI & Machine Learning**
* **OpenAI API** — Core AI integration.
* **Whisper-1** — State-of-the-art automatic speech recognition (ASR) model.
* **GPT-4o / GPT-5** — Advanced reasoning models for natural language understanding and SQL synthesis.

**Frontend & UI/UX**
* **Vanilla JavaScript (ES6+)** — No heavy frontend frameworks, ensuring maximum performance and a lightweight bundle.
* **MediaRecorder API** — Native browser API for capturing raw audio streams.
* **Fetch API** — Modern asynchronous network requests.
* **Chart.js** — HTML5 canvas-based data visualization.
* **i18next & i18next-http-backend** — Industry-standard internationalization library.
* **HTML5 & CSS3** — Clean, responsive, and minimalist UI utilizing modern Flexbox and Grid layouts.

---

## 🧠 How the AI Works

The application uses a two-stage LLM pipeline:

**Stage 1 — SQL Generation**

The LLM receives a structured system prompt containing the full database schema (tables, columns, types, primary keys) and the user's natural language query. It returns a raw SQL statement with no explanation.

**Stage 2 — Self-Healing**

If the generated SQL raises a `sqlite3.Error`, the original query, the failed SQL, and the error message are sent back to the model in a follow-up turn with a correction instruction. This feedback loop runs once and surfaces a clear error if it still fails.

**Stage 3 — Explanation & Chart Type**

A separate lightweight call asks the model to produce a short natural-language explanation of the result and to classify the chart type (`bar`, `pie`, `line`, or `none`) based on whether the query contains aggregation.

The prompts live in `utils/prompts.py` (system prompt template) and are assembled at request time with the live schema injected via `.format(schema=db_schema)`.

---

## 🚀 Installation & Setup

1. **Clone the repository:**
```bash
   git clone https://github.com/pavlablo/Voice-to-SQL.git
   cd your-repo-name
   ```

2. **Create and activate a virtual environment (Recommended):**
```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```

3. **Install dependencies:**
```bash
   pip install fastapi uvicorn openai python-dotenv pydantic python-multipart
   ```

4. **Configure environment variables:**
Create a `.env` file in the root directory and add your OpenAI API key:
```env
   OPENAI_API_KEY=sk-your_secret_api_key_here
   ```

5. **Run the application:**
```bash
   uvicorn main:app --reload
   ```

6. **Access the web interface:**
   Open your browser and navigate to [http://127.0.0.1:8000](http://127.0.0.1:8000).

## 🗄️ Download Databases

The sample databases (including the large Tennis ATP/WTA dataset) are available in the Releases section.

📥 **[Download Databases Archive (ZIP)](https://github.com/pavlablo/Voice-to-SQL/releases/download/v1.0/voice-to-sql-databases.zip)**

**How to use:**
1. Download and extract the `.zip` file.
2. Place the `.sqlite` files inside the `data/` folder in the root of the project.

## 📂 Project Structure

* `data/` — Built-in sample databases (e.g., Music Store, Hotel Reviews).
* `user_data/` — Secure directory for runtime user-uploaded databases.
* `static/` — Frontend assets (`style.css`, `script.js`) and localization files (`locales/`).
* `utils/` — Core utility modules, including schema extraction logic (`db_utils.py`) and engineered LLM prompts (`prompts.py`).
* `tests/` — Standalone test scripts for validating Whisper and LLM API integrations.

## 💡 Usage Examples

![Query Input Example](assets/stats1.png)

To trigger the charting engine, try asking analytical questions:
* *"Show the top 10 tennis players by the number of wins on clay."* (Tennis ATP/WTA Database)
* *"What is the track distribution by genre?"* (Music Store Database)
* *"Compare the average cleanliness rating of hotels across different cities."* (Hotel Reviews Database)


---

## 🔒 Security Considerations

This project is intended for **local or trusted-network use only**. Before deploying in any shared or public environment, be aware of the following:

**SQL Execution**
All queries — including those generated by the LLM and those typed manually in the built-in SQL editor — are executed directly against the database. There is no query allowlist or read-only enforcement by default. To restrict execution to `SELECT` statements only, validate the statement type before running it.

**File Uploads**
Uploaded `.sqlite` / `.db` files are saved to `user_data/` and opened with `sqlite3.connect()`. Malformed or crafted SQLite files could trigger unexpected behavior in the SQLite engine. Consider validating the file header (first 16 bytes must equal `SQLite format 3\000`) before accepting the upload.

**API Key**
Your `OPENAI_API_KEY` is loaded from `.env` and never sent to the frontend. Make sure `.env` is listed in `.gitignore` (it is by default) and never committed to version control.

**No Authentication**
The application has no user authentication layer. Do not expose port `8000` to the public internet without adding authentication (e.g., HTTP Basic Auth via a reverse proxy, or a FastAPI dependency).

---

## 🗺️ Roadmap

- [ ] PostgreSQL and MySQL support via configurable connection strings
- [ ] Read-only connection mode toggle in the UI
- [ ] Query history and session persistence
- [ ] Docker image for one-command setup
