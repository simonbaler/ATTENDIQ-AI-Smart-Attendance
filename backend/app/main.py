"""
SITS SmartAttend AI - Main FastAPI Application
Siddhartha Institute of Technology and Sciences
SIH 2026 Smart Attendance Core
"""

import os
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

app = FastAPI(
    title="SITS SmartAttend AI",
    description="Siddhartha Institute of Technology and Sciences - Real-Time AI Face Recognition Attendance System",
    version="1.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static student face images
os.makedirs("data/students", exist_ok=True)
os.makedirs("data/encodings", exist_ok=True)
os.makedirs("data/attendance", exist_ok=True)
os.makedirs("data/exports", exist_ok=True)
os.makedirs("data/logs", exist_ok=True)

app.mount("/data/students", StaticFiles(directory="data/students"), name="students")

@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "system": "SITS SmartAttend AI",
        "institution": "Siddhartha Institute of Technology and Sciences",
        "version": "1.0.0",
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
