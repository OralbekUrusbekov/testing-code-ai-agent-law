import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_openai import ChatOpenAI
from langchain_chroma import Chroma
from langchain_core.prompts import PromptTemplate
from langchain_core.runnables import RunnablePassthrough, RunnableParallel
from langchain_core.output_parsers import StrOutputParser
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Insurance AI Assistant KZ")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_DIR = "./chroma_db"
embeddings = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001")
vectorstore = Chroma(persist_directory=DB_DIR, embedding_function=embeddings)
retriever = vectorstore.as_retriever(search_kwargs={"k": 5})

prompt_template = """You are a professional legal consultant specialized in the insurance legislation of the Republic of Kazakhstan.
Your task is to provide accurate, clear, and legally sound advice based on the provided documents.

Context from legislation:
{context}

Question: {question}

Instructions:
1. Use only the provided context to answer. If the answer is not in the context, say that you don't have this specific information but can help with general insurance principles.
2. Cite the document name (source) when providing information.
3. Use professional legal language (Russian/Kazakh as requested).
4. If the question is in Kazakh, answer in Kazakh. If in Russian, answer in Russian.

Assistant Answer:"""

PROMPT = PromptTemplate(template=prompt_template, input_variables=["context", "question"])

llm = ChatOpenAI(
    model="deepseek/deepseek-chat-v3-0324",
    openai_api_key=os.getenv("OPENROUTER_API_KEY"),
    openai_api_base="https://openrouter.ai/api/v1",
    temperature=0.1,
)

def format_docs(docs):
    return "\n\n".join(
        f"[{doc.metadata.get('source', 'unknown')}]\n{doc.page_content}" for doc in docs
    )

qa_chain = RunnableParallel(
    answer=(
        RunnableParallel(
            context=retriever | format_docs,
            question=RunnablePassthrough()
        )
        | PROMPT
        | llm
        | StrOutputParser()
    ),
    source_documents=retriever,
)

class QueryRequest(BaseModel):
    question: str

class QueryResponse(BaseModel):
    answer: str
    sources: list

@app.post("/query", response_model=QueryResponse)
async def query_insurance(request: QueryRequest):
    try:
        result = qa_chain.invoke(request.question)
        sources = list(set(doc.metadata["source"] for doc in result["source_documents"]))
        return QueryResponse(answer=result["answer"], sources=sources)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health():
    return {"status": "ok"}

app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
