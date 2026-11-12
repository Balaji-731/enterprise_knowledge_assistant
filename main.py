"""Application entrypoint to launch TechNova Enterprise AI API server."""

import sys
import uvicorn


def main():
    print("\n" + "=" * 70, flush=True)
    print(" TechNova Enterprise AI Knowledge Platform - Full Stack Server", flush=True)
    print("=" * 70, flush=True)
    print(" [*] Web App UI:    http://127.0.0.1:8000 (React Frontend)", flush=True)
    print(" [*] API Base:      http://127.0.0.1:8000/api/v1", flush=True)
    print(" [*] Swagger UI:    http://127.0.0.1:8000/docs", flush=True)
    print(" [*] Health Check:  http://127.0.0.1:8000/health", flush=True)
    print(" [*] Status:        Starting HTTP engine...", flush=True)
    print(" [*] Press CTRL+C to stop the server at any time.", flush=True)
    print("=" * 70 + "\n", flush=True)

    uvicorn.run(
        "src.api.app:app",
        host="127.0.0.1",
        port=8000,
        log_level="info",
        access_log=True,
    )


if __name__ == "__main__":
    main()
