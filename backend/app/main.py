from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, Base
from app.seed import seed_database
from app.routers import (
    auth_routes, classroom_routes, timetable_routes, event_routes,
    facility_routes, hpc_routes, lost_found_routes, notification_routes,
    audit_routes, analytics_routes, egovernance_routes
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB schema and seed synthetic data
    Base.metadata.create_all(bind=engine)
    seed_database()
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="CampusConnect: Unified Campus Resource Management, Academic Scheduling, and Lost & Found Platform",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth_routes.router, prefix=settings.API_V1_STR)
app.include_router(classroom_routes.router, prefix=settings.API_V1_STR)
app.include_router(timetable_routes.router, prefix=settings.API_V1_STR)
app.include_router(event_routes.router, prefix=settings.API_V1_STR)
app.include_router(facility_routes.router, prefix=settings.API_V1_STR)
app.include_router(hpc_routes.router, prefix=settings.API_V1_STR)
app.include_router(lost_found_routes.router, prefix=settings.API_V1_STR)
app.include_router(notification_routes.router, prefix=settings.API_V1_STR)
app.include_router(audit_routes.router, prefix=settings.API_V1_STR)
app.include_router(analytics_routes.router, prefix=settings.API_V1_STR)
app.include_router(egovernance_routes.router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {
        "title": "CampusConnect API",
        "status": "operational",
        "documentation": "/docs",
        "version": settings.VERSION
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
