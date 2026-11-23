class CommerceError(Exception):
    """Erro de domínio base; `status_code` é usado pela API."""

    status_code = 400

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class NotFound(CommerceError):
    status_code = 404


class Conflict(CommerceError):
    status_code = 409


class PermissionDenied(CommerceError):
    status_code = 403


class ApprovalRequired(CommerceError):
    status_code = 409


class EmergencyStopActive(CommerceError):
    status_code = 423


class BudgetExceeded(CommerceError):
    status_code = 429


class LimitExceeded(CommerceError):
    status_code = 429


class ServiceUnavailable(CommerceError):
    status_code = 503


class NotConfigured(CommerceError):
    status_code = 503


class AIRefused(CommerceError):
    status_code = 422


class AIError(CommerceError):
    status_code = 502
