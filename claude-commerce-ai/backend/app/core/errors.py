class CommerceError(Exception):
    """Erro de domínio base."""

    status_code = 400

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class KillSwitchActive(CommerceError):
    status_code = 423


class BudgetExceeded(CommerceError):
    status_code = 429


class ApprovalRequired(CommerceError):
    status_code = 409


class IntegrationNotAvailable(CommerceError):
    status_code = 503


class NotFound(CommerceError):
    status_code = 404


class AIRefused(CommerceError):
    status_code = 422


class AIError(CommerceError):
    status_code = 502
