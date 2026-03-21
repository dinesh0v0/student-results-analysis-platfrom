# =============================================================================
# FastAPI Main Application
# =============================================================================
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import get_settings
from routers import auth, admin, student, ai_assistant

settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    description="A data-driven web platform for managing and analyzing student academic results",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS configuration
origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(student.router)
app.include_router(ai_assistant.router)


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "ok",
        "message": "Student Result Analysis Platform API",
        "version": "1.0.0",
    }


@app.get("/api/health")
async def health_check():
    """API health check."""
    return {"status": "healthy"}
