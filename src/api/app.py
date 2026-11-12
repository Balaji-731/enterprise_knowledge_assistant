"""FastAPI application entrypoint for TechNova Enterprise AI Knowledge Platform."""

from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from src.api.routers import audit, auth, documents, query
from src.database.seed import init_db

# Initialize database tables and seed users on startup
init_db()

app = FastAPI(
    title="TechNova Enterprise AI Knowledge Assistant",
    description="A Secure, Permission-Aware Enterprise RAG Knowledge Platform",
    version="1.0.0",
)

# Enable CORS for frontend applications
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers with /api/v1 prefix
app.include_router(auth.router, prefix="/api/v1")
app.include_router(query.router, prefix="/api/v1")
app.include_router(documents.router, prefix="/api/v1")
app.include_router(audit.router, prefix="/api/v1")


@app.get("/health", tags=["System"])
def health_check():
    """System health check endpoint."""
    return {
        "status": "healthy",
        "service": "TechNova Enterprise AI Knowledge Assistant",
        "version": "1.0.0",
    }


# Mount built React frontend static assets if available
FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists() and (FRONTEND_DIST / "index.html").exists():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_react_app(full_path: str):
        # Do not catch API endpoints, health, or interactive docs
        if (
            full_path.startswith("api")
            or full_path.startswith("docs")
            or full_path.startswith("openapi.json")
            or full_path.startswith("redoc")
        ):
            raise HTTPException(status_code=404, detail="Not Found")

        file_candidate = FRONTEND_DIST / full_path
        if full_path and file_candidate.exists() and file_candidate.is_file():
            return FileResponse(file_candidate)

        return FileResponse(FRONTEND_DIST / "index.html")
