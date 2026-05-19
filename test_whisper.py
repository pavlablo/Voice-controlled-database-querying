from openai import OpenAI
import os
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def recognize_audio(file_path):
    print("Starting ...", file_path)

    with open(file_path, "rb") as audio_file:
        response = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            language="ru"
        )

    print("Text:")
    print(response.text)

    return response.text


if __name__ == "__main__":
    audio_path = "test2.mp3"
    recognize_audio(audio_path)