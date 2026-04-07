# Simple unit tests - no database required
import pytest


def test_imports():
    """Test that main app modules can be imported."""
    from app.models.models import User, Auction, Bid, AuctionStatus
    from app.config.settings import Settings
    assert User is not None
    assert Auction is not None
    
    assert Bid is not None
    assert AuctionStatus.ACTIVE == "ACTIVE"


def test_settings_defaults():
    """Test settings have expected defaults."""
    from app.config.settings import Settings
    settings = Settings(
        DATABASE_URL="sqlite:///:memory:",
        DIRECT_URL="sqlite:///:memory:",
    )
    # Check default port
    assert settings.PORT == 5000
    # Check DATABASE_URL is set
    assert settings.DATABASE_URL == "sqlite:///:memory:"


def test_password_hashing():
    """Test password hashing works correctly."""
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    password = "testpassword123"
    hashed = pwd_context.hash(password)
    
    assert hashed != password
    assert pwd_context.verify(password, hashed)
    assert not pwd_context.verify("wrongpassword", hashed)


def test_jwt_token_creation():
    """Test JWT token creation and decoding."""
    from datetime import datetime, timedelta
    from jose import jwt
    
    secret = "test-secret"
    user_id = "test-user-123"
    expire = datetime.utcnow() + timedelta(days=7)
    
    token = jwt.encode(
        {"userId": user_id, "exp": expire},
        secret,
        algorithm="HS256"
    )
    
    decoded = jwt.decode(token, secret, algorithms=["HS256"])
    assert decoded["userId"] == user_id


def test_auction_status_enum():
    """Test auction status enum values."""
    from app.models.models import AuctionStatus
    
    assert AuctionStatus.DRAFT.value == "DRAFT"
    assert AuctionStatus.ACTIVE.value == "ACTIVE"
    assert AuctionStatus.ENDED.value == "ENDED"
    assert AuctionStatus.SOLD.value == "SOLD"


def test_model_types():
    """Test custom model types work correctly."""
    from app.models.models import JSONEncodedList, JSONEncodedDict
    
    # Test JSONEncodedList
    list_type = JSONEncodedList()
    encoded = list_type.process_bind_param(["a", "b", "c"], None)
    assert encoded == '["a", "b", "c"]'
    decoded = list_type.process_result_value(encoded, None)
    assert decoded == ["a", "b", "c"]
    
    # Test JSONEncodedDict
    dict_type = JSONEncodedDict()
    encoded = dict_type.process_bind_param({"key": "value"}, None)
    assert encoded == '{"key": "value"}'
    decoded = dict_type.process_result_value(encoded, None)
    assert decoded == {"key": "value"}
