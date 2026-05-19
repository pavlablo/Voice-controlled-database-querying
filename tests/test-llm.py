from openai import OpenAI
import os
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def generate_sql(user_text):
    schema = """
    CREATE TABLE routes (
        id INT PRIMARY KEY,
        bus_number VARCHAR(50),
        route_name VARCHAR(100),
        fuel_consumption DECIMAL,
        profit DECIMAL
    );
    """

    prompt = f"У тебя есть база данных:\n{schema}\n\nНапиши SQL запрос для задачи: {user_text}"

    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system",
             "content": "Ты SQL разработчик. Отвечай только кодом SQL запроса без форматирования и текста."},
            {"role": "user", "content": prompt}
        ]
    )

    result = response.choices[0].message.content
    print("Сгенерированный SQL:")
    print(result)

    return result


if __name__ == "__main__":
    text = "Покажи все маршруты где расход топлива больше 20 литров и прибыль меньше 1000"
    generate_sql(text)