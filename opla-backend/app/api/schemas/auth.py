from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional
from datetime import datetime
import uuid as uuid_pkg

# ============= Auth Request Schemas =============

class RegisterEmailRequest(BaseModel):
    """Email/password registration request"""
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str = Field(..., min_length=2, max_length=100)
    
    @validator('password')
    def password_strength(cls, v):
        if not any(char.isdigit() for char in v):
            raise ValueError('Password must contain at least one digit')
        if not any(char.isupper() for char in v):
            raise ValueError('Password must contain at least one uppercase letter')
        return v


class RegisterPhoneRequest(BaseModel):
    """Phone registration request (triggers OTP)"""
    phone: str = Field(..., min_length=10, max_length=15)
    full_name: str = Field(..., min_length=2, max_length=100)
    
    @validator('phone')
    def phone_format(cls, v):
        # Remove spaces, dashes, parentheses
        cleaned = ''.join(filter(str.isdigit, v))
        if len(cleaned) < 10:
            raise ValueError('Phone number must be at least 10 digits')
        return cleaned


class LoginEmailRequest(BaseModel):
    """Email/password login request"""
    email: EmailStr
    password: str


class OTPRequest(BaseModel):
    """Request OTP for phone login"""
    phone: str = Field(..., min_length=10, max_length=15)
    
    @validator('phone')
    def phone_format(cls, v):
        cleaned = ''.join(filter(str.isdigit, v))
        if len(cleaned) < 10:
            raise ValueError('Phone number must be at least 10 digits')
        return cleaned


class OTPVerifyRequest(BaseModel):
    """Verify OTP and login"""
    phone: str
    otp: str = Field(..., min_length=6, max_length=6)


class RefreshTokenRequest(BaseModel):
    """Refresh access token"""
    refresh_token: str


# ============= Response Schemas =============

class UserResponse(BaseModel):
    """User data response"""
    id: uuid_pkg.UUID
    email: Optional[str] = None
    phone: Optional[str] = None
    full_name: str
    is_platform_admin: bool
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class AuthTokenResponse(BaseModel):
    """Authentication response with tokens"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class MessageResponse(BaseModel):
    """Generic message response"""
    message: str
    success: bool = True
    data: Optional[dict] = None
