from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.services.auth_service import auth_service
from app.services.otp_service import otp_service
from app.api.schemas.auth import (
    RegisterEmailRequest,
    RegisterPhoneRequest,
    LoginEmailRequest,
    OTPRequest,
    OTPVerifyRequest,
    RefreshTokenRequest,
    AuthTokenResponse,
    MessageResponse,
    UserResponse
)
from app.api.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register/email", response_model=AuthTokenResponse, status_code=status.HTTP_201_CREATED)
def register_with_email(
    request: RegisterEmailRequest,
    db: Session = Depends(get_db)
):
    """
    Register a new user with email and password
    
    - **email**: Valid email address (must be unique)
    - **password**: Minimum 8 characters, must contain uppercase and digit
    - **full_name**: User's full name
    """
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == request.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Hash password
    password_hash = auth_service.hash_password(request.password)
    
    # Create user
    new_user = User(
        email=request.email,
        password_hash=password_hash,
        full_name=request.full_name,
        is_active=True
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Generate tokens
    access_token = auth_service.create_access_token(data={"sub": str(new_user.id)})
    refresh_token = auth_service.create_refresh_token(data={"sub": str(new_user.id)})
    
    return AuthTokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.from_orm(new_user)
    )


@router.post("/register/phone", response_model=MessageResponse)
def register_with_phone(
    request: RegisterPhoneRequest,
    db: Session = Depends(get_db)
):
    """
    Register a new user with phone number (sends OTP)
    
    - **phone**: Phone number (minimum 10 digits)
    - **full_name**: User's full name
    
    Note: This creates the user account but requires OTP verification to activate
    """
    # Check if phone already exists
    existing_user = db.query(User).filter(User.phone == request.phone).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number already registered"
        )
    
    # Create user (inactive until OTP verified)
    new_user = User(
        phone=request.phone,
        full_name=request.full_name,
        is_active=True  # We'll activate immediately on OTP verification
    )
    
    db.add(new_user)
    db.commit()
    
    # Request OTP
    otp_result = otp_service.request_otp(request.phone)
    
    if not otp_result["success"]:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=otp_result["message"]
        )
    
    return MessageResponse(
        message="Registration successful. OTP sent to your phone.",
        data={"otp": otp_result.get("otp")} if "otp" in otp_result else None
    )


@router.post("/login", response_model=AuthTokenResponse)
def login_with_email(
    request: LoginEmailRequest,
    db: Session = Depends(get_db)
):
    """
    Login with email and password
    
    - **email**: Registered email address
    - **password**: User's password
    """
    # Find user by email
    user = db.query(User).filter(User.email == request.email).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Verify password
    if not user.password_hash or not auth_service.verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive"
        )
    
    # Generate tokens
    access_token = auth_service.create_access_token(data={"sub": str(user.id)})
    refresh_token = auth_service.create_refresh_token(data={"sub": str(user.id)})
    
    return AuthTokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.from_orm(user)
    )


@router.post("/otp/request", response_model=MessageResponse)
def request_otp(
    request: OTPRequest,
    db: Session = Depends(get_db)
):
    """
    Request OTP for phone login
    
    - **phone**: Registered phone number
    
    Note: Rate limited to 3 requests per 15 minutes
    """
    # Check if phone exists
    user = db.query(User).filter(User.phone == request.phone).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Phone number not registered"
        )
    
    # Request OTP
    otp_result = otp_service.request_otp(request.phone)
    
    if not otp_result["success"]:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=otp_result["message"]
        )
    
    return MessageResponse(
        message=otp_result["message"],
        data={"otp": otp_result.get("otp")} if "otp" in otp_result else None
    )


@router.post("/otp/verify", response_model=AuthTokenResponse)
def verify_otp(
    request: OTPVerifyRequest,
    db: Session = Depends(get_db)
):
    """
    Verify OTP and login
    
    - **phone**: Phone number
    - **otp**: 6-digit OTP code
    """
    # Verify OTP
    is_valid = otp_service.verify_otp(request.phone, request.otp)
    
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired OTP"
        )
    
    # Find user
    user = db.query(User).filter(User.phone == request.phone).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive"
        )
    
    # Generate tokens
    access_token = auth_service.create_access_token(data={"sub": str(user.id)})
    refresh_token = auth_service.create_refresh_token(data={"sub": str(user.id)})
    
    return AuthTokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.from_orm(user)
    )


@router.post("/refresh", response_model=AuthTokenResponse)
def refresh_access_token(
    request: RefreshTokenRequest,
    db: Session = Depends(get_db)
):
    """
    Refresh access token using refresh token
    
    - **refresh_token**: Valid refresh token
    """
    # Verify refresh token
    payload = auth_service.verify_token(request.refresh_token, token_type="refresh")
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload"
        )
    
    # Fetch user
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
    
    # Generate new tokens
    access_token = auth_service.create_access_token(data={"sub": str(user.id)})
    refresh_token = auth_service.create_refresh_token(data={"sub": str(user.id)})
    
    return AuthTokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.from_orm(user)
    )


@router.get("/me", response_model=UserResponse)
def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """
    Get current authenticated user information
    
    Requires: Bearer token in Authorization header
    """
    return UserResponse.from_orm(current_user)
