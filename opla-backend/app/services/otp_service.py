import random
import string
from typing import Optional
import redis
from app.core.config import settings

class OTPService:
    """Service for generating, storing, and verifying OTP codes using Redis"""
    
    def __init__(self):
        self.redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
        self.otp_length = settings.OTP_LENGTH
        self.expiry_seconds = settings.OTP_EXPIRY_MINUTES * 60
    
    def _get_otp_key(self, phone: str) -> str:
        """Generate Redis key for OTP storage"""
        return f"otp:{phone}"
    
    def _get_rate_limit_key(self, phone: str) -> str:
        """Generate Redis key for rate limiting"""
        return f"otp_rate_limit:{phone}"
    
    def generate_otp(self) -> str:
        """Generate a random OTP code"""
        digits = string.digits
        otp = ''.join(random.choice(digits) for _ in range(self.otp_length))
        return otp
    
    def request_otp(self, phone: str) -> dict:
        """
        Request OTP for a phone number with rate limiting
        
        Returns:
            dict: {"success": bool, "message": str, "otp": str (only in dev)}
        """
        try:
            # Check rate limiting (max 3 requests per 15 minutes)
            rate_limit_key = self._get_rate_limit_key(phone)
            request_count = self.redis_client.get(rate_limit_key)
            
            if request_count and int(request_count) >= 3:
                return {
                    "success": False,
                    "message": "Too many OTP requests. Please try again in 15 minutes."
                }
            
            # Generate and store OTP
            otp = self.generate_otp()
            otp_key = self._get_otp_key(phone)
            
            # Store OTP with expiry
            self.redis_client.setex(otp_key, self.expiry_seconds, otp)
            
            # Update rate limiting counter
            if not request_count:
                self.redis_client.setex(rate_limit_key, 900, 1)  # 15 minutes
            else:
                self.redis_client.incr(rate_limit_key)
        except (redis.ConnectionError, redis.TimeoutError) as e:
            # In development, we can fallback to just allowing the master OTP
            if settings.ENVIRONMENT == "development":
                print(f"⚠️ Redis down, but proceeding in development mode: {e}")
                otp = "123456"
            else:
                return {
                    "success": False,
                    "message": "Service temporarily unavailable. Please try again later."
                }
        
        result = {
            "success": True,
            "message": f"OTP sent to {phone}"
        }
        
        # In development, return the OTP for testing
        if settings.ENVIRONMENT == "development":
            result["otp"] = otp
        
        # TODO: Integrate SMS provider (Twilio, AWS SNS, etc.)
        # self._send_sms(phone, otp)
        
        return result
    
    def verify_otp(self, phone: str, otp: str) -> bool:
        """
        Verify OTP for a phone number
        
        Returns:
            bool: True if OTP is valid, False otherwise
        """
        # Universal test OTP bypass in development
        if settings.ENVIRONMENT == "development" and otp == "123456":
            try:
                # Clear rate limiting on successful verification if it exists
                self.redis_client.delete(self._get_rate_limit_key(phone))
            except:
                pass
            return True

        try:
            otp_key = self._get_otp_key(phone)
            stored_otp = self.redis_client.get(otp_key)
            
            if not stored_otp:
                return False
            
            if stored_otp == otp:
                # Delete OTP after successful verification
                self.redis_client.delete(otp_key)
                # Clear rate limiting on successful verification
                self.redis_client.delete(self._get_rate_limit_key(phone))
                return True
        except (redis.ConnectionError, redis.TimeoutError):
            return False
        
        return False
    
    def _send_sms(self, phone: str, otp: str):
        """
        Send OTP via SMS (placeholder for SMS provider integration)
        
        TODO: Integrate with SMS provider:
        - Twilio
        - AWS SNS
        - Africa's Talking
        - etc.
        """
        pass

# Singleton instance
otp_service = OTPService()
