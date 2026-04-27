import os
import time
from docx import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_chroma import Chroma
from dotenv import load_dotenv

load_dotenv()

# Configuration
DOCS_DIR = "."
DB_DIR = "./chroma_db"
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

def extract_text_from_docx(file_path):
    doc = Document(file_path)
    full_text = []
    for para in doc.paragraphs:
        full_text.append(para.text)
    return "\n".join(full_text)

def ingest_docs():
    all_texts = []
    metadatas = []
    
    for filename in os.listdir(DOCS_DIR):
        if filename.endswith(".docx"):
            print(f"Processing {filename}...")
            file_path = os.path.join(DOCS_DIR, filename)
            text = extract_text_from_docx(file_path)
            all_texts.append(text)
            metadatas.append({"source": filename})

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=100,
        separators=["\n\n", "\n", ".", " ", ""]
    )
    
    docs = text_splitter.create_documents(all_texts, metadatas=metadatas)
    
    print(f"Created {len(docs)} chunks. Initializing Vector Store...")
    
    embeddings = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001")

    BATCH_SIZE = 80
    total_batches = (len(docs) + BATCH_SIZE - 1) // BATCH_SIZE
    vectorstore = None

    for i in range(0, len(docs), BATCH_SIZE):
        batch = docs[i:i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        print(f"Embedding batch {batch_num}/{total_batches} ({len(batch)} chunks)...")
        if vectorstore is None:
            vectorstore = Chroma.from_documents(
                documents=batch,
                embedding=embeddings,
                persist_directory=DB_DIR
            )
        else:
            vectorstore.add_documents(batch)
        if i + BATCH_SIZE < len(docs):
            print("Rate limit pause (65s)...")
            time.sleep(65)

    print("Ingestion complete. Database persisted at", DB_DIR)

if __name__ == "__main__":
    if not GOOGLE_API_KEY:
        print("Error: GOOGLE_API_KEY not found in .env file.")
    else:
        ingest_docs()
