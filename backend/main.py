"""
FastAPI Backend Application
Main entry point for the Python/FastAPI backend
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from datetime import datetime
from config import settings
from database import check_database_connection

# Import routers
from routers import auth, users, investments, transactions, withdrawals, admin

# Create FastAPI application
app = FastAPI(
    title="Robert Ventures InvestorDesk API",
    description="Backend API for Robert Ventures Investment Platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# ============================================================================
# CORS Configuration
# ============================================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print(f"✓ CORS enabled for origins: {', '.join(settings.CORS_ORIGINS)}")

# ============================================================================
# Exception Handlers
# ============================================================================

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler for unhandled errors"""
    print(f"❌ Unhandled exception: {exc}")
    print(f"   Request: {request.method} {request.url}")
    
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "Internal server error",
            "detail": str(exc) if settings.ENVIRONMENT != 'production' else None
        }
    )

# ============================================================================
# Health Check
# ============================================================================

@app.get("/health")
async def health_check():
    """
    Health check endpoint
    Returns service status and database connection
    """
    try:
        # Check database connection
        db_connected = await check_database_connection()
        
        return {
            "success": True,
            "status": "healthy" if db_connected else "degraded",
            "timestamp": datetime.utcnow().isoformat() + 'Z',
            "database": "connected" if db_connected else "disconnected",
            "environment": settings.ENVIRONMENT
        }
    except Exception as e:
        return {
            "success": False,
            "status": "unhealthy",
            "timestamp": datetime.utcnow().isoformat() + 'Z',
            "error": str(e)
        }

# ============================================================================
# Root Endpoint
# ============================================================================

@app.get("/")
async def root():
    """Root endpoint - API information"""
    return {
        "name": "Robert Ventures InvestorDesk API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "health": "/health"
    }

# ============================================================================
# Register Routers
# ============================================================================

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(investments.router)
app.include_router(transactions.router)
app.include_router(withdrawals.router)
app.include_router(admin.router)

print("✓ All routers registered")

# ============================================================================
# Startup Event
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """Run on application startup"""
    print("=" * 60)
    print("🚀 Robert Ventures InvestorDesk API Starting...")
    print("=" * 60)
    print(f"Environment: {settings.ENVIRONMENT}")
    print(f"Port: {settings.PORT}")
    print(f"CORS Origins: {', '.join(settings.CORS_ORIGINS)}")
    print(f"Test Mode: {'Enabled' if settings.TEST_MODE else 'Disabled'}")
    
    # Check database connection
    try:
        db_connected = await check_database_connection()
        if db_connected:
            print("✓ Database connected")
        else:
            print("❌ Database connection failed")
    except Exception as e:
        print(f"❌ Database error: {e}")
    
    print("=" * 60)
    print("✓ API Ready")
    print(f"📚 Docs: http://localhost:{settings.PORT}/docs")
    print(f"🏥 Health: http://localhost:{settings.PORT}/health")
    print("=" * 60)

# ============================================================================
# Shutdown Event
# ============================================================================

@app.on_event("shutdown")
async def shutdown_event():
    """Run on application shutdown"""
    print("=" * 60)
    print("👋 Robert Ventures InvestorDesk API Shutting Down...")
    print("=" * 60)

# ============================================================================
# Main Entry Point (for local development)
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=True,  # Auto-reload on code changes (development only)
        log_level="info"
    )

