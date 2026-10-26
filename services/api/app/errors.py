from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str) -> None:
        self.status, self.code, self.message = status, code, message


def not_found(what: str = "resource") -> ApiError:
    # Cross-tenant lookups deliberately look identical to missing rows.
    return ApiError(404, "not_found", f"{what} not found")


def forbidden(message: str = "You do not have permission to do that") -> ApiError:
    return ApiError(403, "forbidden", message)


def conflict(code: str, message: str) -> ApiError:
    return ApiError(409, code, message)


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _handler(_: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status, content={"error": {"code": exc.code, "message": exc.message}}
        )
