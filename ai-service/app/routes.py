from fastapi import APIRouter, UploadFile, File
from app.services import extract_text_from_pdf, generate_summary, generate_flashcards

router = APIRouter()

@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    file_bytes = await file.read()
    text = extract_text_from_pdf(file_bytes)
    
    if not text.strip():
        return {"error": "Could not extract text from PDF"}
    
    summary = generate_summary(text)
    flashcards = generate_flashcards(text)
    
    return {
        "summary": summary,
        "flashcards": flashcards
    }