from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.core.config import settings

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AuthService:
    """Service for JWT token management and password hashing"""
    
    @staticmethod
    def hash_password(password: str) -> str:
        """Hash a password using bcrypt"""
        return pwd_context.hash(password)
    
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash"""
        return pwd_context.verify(plain_password, hashed_password)
    
    @staticmethod
    def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
        """
        Create a JWT access token
        
        Args:
            data: Payload to encode (should include user_id, email/phone)
            expires_delta: Optional custom expiry time
        
        Returns:
            Encoded JWT token
        """
        to_encode = data.copy()
        
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        
        to_encode.update({
            "exp": expire,
            "iat": datetime.utcnow(),
            "type": "access"
        })
        
        encoded_jwt = jwt.encode(
            to_encode,
            settings.JWT_SECRET_KEY,
            algorithm=settings.JWT_ALGORITHM
        )
        
        return encoded_jwt
    
    @staticmethod
    def create_refresh_token(data: dict) -> str:
        """
        Create a JWT refresh token with longer expiry
        
        Args:
            data: Payload to encode (should include user_id)
        
        Returns:
            Encoded JWT refresh token
        """
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        
        to_encode.update({
            "exp": expire,
            "iat": datetime.utcnow(),
            "type": "refresh"
        })
        
        encoded_jwt = jwt.encode(
            to_encode,
            settings.JWT_REFRESH_SECRET_KEY,
            algorithm=settings.JWT_ALGORITHM
        )
        
        return encoded_jwt
    
    @staticmethod
    def verify_token(token: str, token_type: str = "access") -> Optional[dict]:
        """
        Verify and decode a JWT token
        
        Args:
            token: JWT token to verify
            token_type: Either "access" or "refresh"
        
        Returns:
            Decoded token payload or None if invalid
        """
        try:
            secret_key = (
                settings.JWT_SECRET_KEY 
                if token_type == "access" 
                else settings.JWT_REFRESH_SECRET_KEY
            )
            
            payload = jwt.decode(
                token,
                secret_key,
                algorithms=[settings.JWT_ALGORITHM]
            )
            
            # Verify token type matches
            if payload.get("type") != token_type:
                return None
            
            return payload
            
        except JWTError:
            return None


# Singleton instance
auth_service = AuthService()
