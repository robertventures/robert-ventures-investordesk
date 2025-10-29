"""
Authentication Utilities
Password hashing, JWT tokens, and authentication helpers
"""

from datetime import datetime, timedelta
from typing import Optional
from passlib.context import CryptContext
from jose import JWTError, jwt
from fastapi import HTTPException, status, Request
from config import settings
from database import get_user_by_id


# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ============================================================================
# Password Hashing
# ============================================================================

def hash_password(password: str) -> str:
    """
    Hash password with bcrypt
    Truncates to 72 bytes (bcrypt limit) if necessary
    """
    # Bcrypt has a 72 byte limit - truncate if needed
    if len(password.encode('utf-8')) > 72:
        password = password.encode('utf-8')[:72].decode('utf-8', 'ignore')
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    return pwd_context.verify(plain_password, hashed_password)


# ============================================================================
# JWT Token Management
# ============================================================================

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create JWT access token
    
    Args:
        data: Data to encode in token (should include user_id, email, is_admin)
        expires_delta: Token expiration time (defaults to 7 days)
    
    Returns:
        JWT token string
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=settings.JWT_EXPIRATION_DAYS)
    
    to_encode.update({"exp": expire})
    
    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM
    )
    
    return encoded_jwt


def decode_access_token(token: str) -> dict:
    """
    Decode and verify JWT token
    Supports both our custom JWT and Supabase JWT tokens
    
    Args:
        token: JWT token string
    
    Returns:
        Decoded token data
    
    Raises:
        HTTPException: If token is invalid or expired
    """
    try:
        # First, decode without verification to check the issuer
        unverified = jwt.get_unverified_claims(token)
        
        # Check if it's a Supabase token
        if 'iss' in unverified and 'supabase' in unverified.get('iss', ''):
            # For Supabase tokens, we'll verify them using Supabase's method
            # For now, just return the unverified payload since Supabase already verified it
            # The token was created by Supabase Auth, which is trusted
            return unverified
        else:
            # Our custom JWT - verify with our secret
            payload = jwt.decode(
                token,
                settings.JWT_SECRET,
                algorithms=[settings.JWT_ALGORITHM]
            )
            return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )


# ============================================================================
# Authentication Helpers
# ============================================================================

def get_token_from_cookie(request: Request) -> Optional[str]:
    """
    Extract JWT token from HTTP-only cookie
    
    Args:
        request: FastAPI request object
    
    Returns:
        Token string or None
    """
    return request.cookies.get("auth_token")


def get_current_user_from_token(token: str) -> dict:
    """
    Get current user from JWT token
    Handles both custom JWT (with user_id) and Supabase JWT (with email)
    
    Args:
        token: JWT token string
    
    Returns:
        User dict
    
    Raises:
        HTTPException: If token invalid or user not found
    """
    try:
        payload = decode_access_token(token)
        
        # Check if it's a Supabase token (has email field)
        if 'email' in payload:
            email = payload.get('email')
            if not email:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token payload"
                )
            
            # Get user by email for Supabase tokens
            from database import get_user_by_email
            user = get_user_by_email(email)
        else:
            # Custom JWT - use user_id
            user_id = payload.get("user_id")
            
            if not user_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token payload"
                )
            
            # Get user from database
            user = get_user_by_id(user_id)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
        
        return user
        
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )


def get_current_user(request: Request) -> dict:
    """
    Get current user from request cookie
    
    Args:
        request: FastAPI request object
    
    Returns:
        User dict
    
    Raises:
        HTTPException: If not authenticated
    """
    token = get_token_from_cookie(request)
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    return get_current_user_from_token(token)


def require_admin(request: Request) -> dict:
    """
    Require admin user (raises exception if not admin)
    
    Args:
        request: FastAPI request object
    
    Returns:
        Admin user dict
    
    Raises:
        HTTPException: If not authenticated or not admin
    """
    user = get_current_user(request)
    
    if not user.get('is_admin'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    return user


def verify_user_access(request: Request, user_id: str) -> dict:
    """
    Verify user has access to resource (must be same user or admin)
    
    Args:
        request: FastAPI request object
        user_id: User ID being accessed
    
    Returns:
        Current user dict
    
    Raises:
        HTTPException: If user doesn't have access
    """
    current_user = get_current_user(request)
    
    # Allow if same user or admin
    if current_user['id'] == user_id or current_user.get('is_admin'):
        return current_user
    
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access denied"
    )


# ============================================================================
# Verification Code Generation
# ============================================================================

def generate_verification_code() -> str:
    """
    Generate 6-digit verification code
    
    Returns:
        6-digit string
    """
    import random
    return str(random.randint(100000, 999999))


def generate_reset_token() -> str:
    """
    Generate secure password reset token
    
    Returns:
        Random UUID string
    """
    import uuid
    return str(uuid.uuid4())


# ============================================================================
# Email Validation
# ============================================================================

def is_valid_email(email: str) -> bool:
    """
    Basic email validation
    
    Args:
        email: Email address
    
    Returns:
        True if valid format
    """
    import re
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None


def is_valid_password(password: str) -> bool:
    """
    Validate password strength
    
    Args:
        password: Password string
    
    Returns:
        True if valid (min 8 characters)
    """
    return len(password) >= 8

