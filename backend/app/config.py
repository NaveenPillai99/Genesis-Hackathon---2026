import os
from pydantic import BaseModel

class Settings(BaseModel):
    PROJECT_NAME: str = "CampusConnect API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "campusconnect_hackathon_secret_key_2026_super_secure")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./campusconnect.db")
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "*"
    ]

settings = Settings()

# System Roles
ROLE_STUDENT = "student"
ROLE_CLASS_REP = "class_rep"
ROLE_CLASS_ADVISOR = "class_advisor"
ROLE_FACULTY = "faculty"
ROLE_LAB_ASSISTANT = "lab_assistant"
ROLE_LAB_ADMIN = "lab_admin"
ROLE_RESOURCE_ADMIN = "resource_admin"
ROLE_LOST_PROPERTY_HANDLER = "lost_property_handler"
ROLE_SYS_ADMIN = "sys_admin"

ALL_ROLES = [
    ROLE_STUDENT,
    ROLE_CLASS_REP,
    ROLE_CLASS_ADVISOR,
    ROLE_FACULTY,
    ROLE_LAB_ASSISTANT,
    ROLE_LAB_ADMIN,
    ROLE_RESOURCE_ADMIN,
    ROLE_LOST_PROPERTY_HANDLER,
    ROLE_SYS_ADMIN,
]
