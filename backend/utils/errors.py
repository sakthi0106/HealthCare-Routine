"""A single error type for problems we want to show to the user in plain words."""


class AppError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message = message
        self.status = status
