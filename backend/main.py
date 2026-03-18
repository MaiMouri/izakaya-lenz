from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from db.models import init_db
from db.seed import seed_database
from routers import translate


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables and seed data
    init_db()
    seed_database()
    yield


app = FastAPI(
    title="Izakaya Lens API",
    description="Hand-written izakaya menu translator for foreign tourists",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(translate.router)


@app.get("/health")
async def health():
    return {"status": "ok"}


PROJECT_ROOT = Path(__file__).resolve().parent.parent
app.mount("/static", StaticFiles(directory=str(PROJECT_ROOT)), name="static")


@app.get("/", response_class=HTMLResponse)
async def upload_page():
    html = Path(__file__).parent / "upload.html"
    return html.read_text(encoding="utf-8")
