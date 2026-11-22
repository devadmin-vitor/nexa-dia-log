from app.core.logging import mask_secrets


def test_mask_secrets():
    s = mask_secrets('key sk-ant-api03-abcDEF123 token=abc123 "authorization": "Bearer xyz"')
    assert "abcDEF123" not in s
    assert "abc123" not in s
    assert "sk-ant-***" in s
