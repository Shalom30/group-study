import PyPDF2
import io
from openai import OpenAI
from dotenv import load_dotenv
import os

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def extract_text_from_pdf(file_bytes):
    reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
    text = ""
    for page in reader.pages:
        text += page.extract_text() or ""
    return text

def generate_summary(text):
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": "You are a study assistant. Summarize the following study material clearly and concisely for a university student."},
            {"role": "user", "content": f"Summarize this:\n\n{text[:4000]}"}
        ]
    )
    return response.choices[0].message.content

def generate_flashcards(text):
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": "You are a study assistant. Generate 10 flashcards from the following study material. Return them as a JSON array where each item has a 'question' and 'answer' field. Return only the JSON array, nothing else."},
            {"role": "user", "content": f"Generate flashcards from this:\n\n{text[:4000]}"}
        ]
    )
    import json
    content = response.choices[0].message.content
    return json.loads(content)