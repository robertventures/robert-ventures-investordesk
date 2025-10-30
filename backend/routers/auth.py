"""
Authentication Router
Handles user authentication endpoints
"""

from fastapi import APIRouter, HTTPException, status, Response, Request
from datetime import timedelta
from models import (
    LoginRequest, RegisterRequest, VerifyRequest,
    PasswordResetRequest, PasswordResetConfirm,
    LoginResponse, RegisterResponse, SuccessResponse
)
from utils.auth import (
    hash_password, verify_password, create_access_token,
    generate_verification_code, generate_reset_token,
    is_valid_email, is_valid_password, get_current_user
)
from database import (
    get_user_by_email, create_user, update_user,
    get_pending_user, create_pending_user, delete_pending_user,
    create_activity, supabase
)
from services.id_generator import generate_user_id
from services.app_time import get_current_app_time
from config import settings

router = APIRouter(prefix="/api/auth", tags=["authentication"])


@router.post("/login")
async def login(credentials: LoginRequest, response: Response):
    """
    User login
    Returns user data and sets HTTP-only cookie with JWT token
    Supports master password for admin testing
    """
    try:
        # Check for master password first (admin testing feature)
        master_password_used = False
        from database import get_app_settings
        from datetime import datetime
        
        settings_data = get_app_settings()
        if settings_data:
            stored_master_password = settings_data.get('master_password')
            master_password_expires_at = settings_data.get('master_password_expires_at')
            
            # If master password is provided and matches
            if stored_master_password and credentials.password == stored_master_password:
                print(f"[Login] Master password detected for {credentials.email}")
                
                # Check if expired
                if master_password_expires_at:
                    expires_at = datetime.fromisoformat(master_password_expires_at.replace('Z', '+00:00'))
                    now = datetime.utcnow()
                    
                    if now < expires_at:
                        # Master password is valid and not expired
                        master_password_used = True
                        print(f"[Login] ✅ Master password valid, bypassing normal auth for {credentials.email}")
                    else:
                        print(f"[Login] ⚠️ Master password expired at {master_password_expires_at}")
        
        # If master password was not used, do normal authentication
        auth_response = None
        if not master_password_used:
            # Authenticate with Supabase Auth
            auth_response = supabase.auth.sign_in_with_password({
                "email": credentials.email,
                "password": credentials.password
            })
            
            if not auth_response.user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid email or password"
                )
        
        # Get user data from public.users table
        user = get_user_by_email(credentials.email)
        
        if not user:
            # User authenticated but not in our users table
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="User profile not found"
            )
        
        # Check if verified (skip for master password)
        if not master_password_used and not user.get('is_verified'):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account not verified"
            )
        
        # Use Supabase session token (or create our own if master password was used)
        session_token = None
        if auth_response and auth_response.session:
            session_token = auth_response.session.access_token
        
        if not session_token:
            # Fallback: create our own JWT token
            token_data = {
                "user_id": user['id'],
                "email": user['email'],
                "is_admin": user.get('is_admin', False)
            }
            session_token = create_access_token(token_data)
        
        # Set HTTP-only cookie
        response.set_cookie(
            key="auth_token",
            value=session_token,
            httponly=True,
            secure=settings.ENVIRONMENT == 'production',
            samesite="none" if settings.ENVIRONMENT == 'production' else "lax",
            max_age=7 * 24 * 60 * 60,  # 7 days
            path="/"
        )
        
        # Do not log login activity - too noisy
        # Only track significant events like account creation, investment submission
        
        # Remove sensitive data and convert to camelCase for frontend
        user_response = {k: v for k, v in user.items() if k not in ('hashed_password', 'password', 'ssn')}
        
        # Convert critical fields to camelCase for frontend compatibility
        user_response['isAdmin'] = user_response.pop('is_admin', False)
        user_response['isVerified'] = user_response.pop('is_verified', False)
        user_response['needsOnboarding'] = user_response.pop('needs_onboarding', False)
        user_response['authId'] = user_response.pop('auth_id', None)
        user_response['firstName'] = user_response.pop('first_name', None)
        user_response['lastName'] = user_response.pop('last_name', None)
        user_response['phoneNumber'] = user_response.pop('phone_number', None)
        user_response['createdAt'] = user_response.pop('created_at', None)
        user_response['updatedAt'] = user_response.pop('updated_at', None)
        user_response['verifiedAt'] = user_response.pop('verified_at', None)
        user_response['accountType'] = user_response.pop('account_type', None)
        user_response['jointHolder'] = user_response.pop('joint_holder', None)
        user_response['jointHoldingType'] = user_response.pop('joint_holding_type', None)
        user_response['entityName'] = user_response.pop('entity_name', None)
        user_response['authorizedRepresentative'] = user_response.pop('authorized_representative', None)
        user_response['taxInfo'] = user_response.pop('tax_info', None)
        user_response['onboardingToken'] = user_response.pop('onboarding_token', None)
        user_response['onboardingTokenExpires'] = user_response.pop('onboarding_token_expires', None)
        user_response['onboardingCompletedAt'] = user_response.pop('onboarding_completed_at', None)
        
        return {
            "success": True,
            "user": user_response
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"❌ Login error: {e}")
        print(f"❌ Full traceback:")
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )


@router.get("/me")
async def get_current_user_info(request: Request):
    """
    Get current authenticated user
    Used by frontend to check auth status
    """
    try:
        user = get_current_user(request)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated"
            )
        
        # Remove sensitive fields and convert to camelCase
        safe_user = {k: v for k, v in user.items() if k not in ('hashed_password', 'password', 'ssn')}
        
        # Convert critical fields to camelCase for frontend compatibility
        safe_user['isAdmin'] = safe_user.pop('is_admin', False)
        safe_user['isVerified'] = safe_user.pop('is_verified', False)
        safe_user['needsOnboarding'] = safe_user.pop('needs_onboarding', False)
        safe_user['authId'] = safe_user.pop('auth_id', None)
        safe_user['firstName'] = safe_user.pop('first_name', None)
        safe_user['lastName'] = safe_user.pop('last_name', None)
        safe_user['phoneNumber'] = safe_user.pop('phone_number', None)
        safe_user['createdAt'] = safe_user.pop('created_at', None)
        safe_user['updatedAt'] = safe_user.pop('updated_at', None)
        safe_user['verifiedAt'] = safe_user.pop('verified_at', None)
        safe_user['accountType'] = safe_user.pop('account_type', None)
        safe_user['jointHolder'] = safe_user.pop('joint_holder', None)
        safe_user['jointHoldingType'] = safe_user.pop('joint_holding_type', None)
        safe_user['entityName'] = safe_user.pop('entity_name', None)
        safe_user['authorizedRepresentative'] = safe_user.pop('authorized_representative', None)
        safe_user['taxInfo'] = safe_user.pop('tax_info', None)
        safe_user['onboardingToken'] = safe_user.pop('onboarding_token', None)
        safe_user['onboardingTokenExpires'] = safe_user.pop('onboarding_token_expires', None)
        safe_user['onboardingCompletedAt'] = safe_user.pop('onboarding_completed_at', None)
        
        return {
            "success": True,
            "user": safe_user
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Get current user error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )


@router.post("/logout")
async def logout(response: Response, request: Request):
    """
    User logout
    Clears authentication cookie
    """
    try:
        # Do not log logout activity - too noisy
        # Only track significant events like account creation, investment submission
        
        # Clear cookie with same parameters as set_cookie to ensure proper deletion
        response.delete_cookie(
            key="auth_token",
            httponly=True,
            secure=settings.ENVIRONMENT == 'production',
            samesite="none" if settings.ENVIRONMENT == 'production' else "lax",
            path="/"
        )
        
        return {"success": True, "message": "Logged out successfully"}
        
    except Exception as e:
        print(f"Logout error: {e}")
        # Always succeed for logout
        response.delete_cookie(
            key="auth_token",
            httponly=True,
            secure=settings.ENVIRONMENT == 'production',
            samesite="none" if settings.ENVIRONMENT == 'production' else "lax",
            path="/"
        )
        return {"success": True, "message": "Logged out"}


@router.post("/register-pending")
async def register_pending(register_data: RegisterRequest):
    """
    Create pending user (before email verification)
    In test mode, returns verification code directly
    """
    try:
        # Validate email
        if not is_valid_email(register_data.email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid email format"
            )
        
        # Validate password
        if not is_valid_password(register_data.password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 8 characters"
            )
        
        # Check if email already exists in users table
        existing_user = get_user_by_email(register_data.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Check if pending user exists (delete old one)
        existing_pending = get_pending_user(register_data.email)
        if existing_pending:
            delete_pending_user(register_data.email)
        
        # Generate verification code
        if settings.TEST_MODE:
            verification_code = settings.TEST_VERIFICATION_CODE
        else:
            verification_code = generate_verification_code()
        
        # Store plain password so we can sign up the Supabase Auth user after verification
        # Note: Column name is 'hashed_password' for historical reasons in the pending_users table
        # but in test/dev we intentionally store the plain password to allow seamless signup.
        plain_password = register_data.password
        
        # Create pending user (store plain password for later Supabase Auth signup)
        pending_user = create_pending_user({
            'email': register_data.email,
            'hashed_password': plain_password,
            'verification_code': verification_code,
            'created_at': get_current_app_time()
        })
        
        if not pending_user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create pending user"
            )
        
        # In test mode, return code directly
        # In production, send email
        if settings.TEST_MODE:
            return {
                "success": True,
                "message": f"Verification code: {verification_code}",
                "email": register_data.email,
                "code": verification_code  # Only in test mode!
            }
        else:
            # TODO: Send verification email
            # send_verification_email(register_data.email, verification_code)
            return {
                "success": True,
                "message": "Verification code sent to email",
                "email": register_data.email
            }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Register error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed"
        )


@router.post("/verify-and-create")
async def verify_and_create(verify_data: VerifyRequest, response: Response):
    """
    Verify code and create actual user account
    """
    try:
        # Get pending user
        pending_user = get_pending_user(verify_data.email)

        if not pending_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pending registration not found"
            )

        # Extract verification code (handle both field names)
        submitted_code = verify_data.code or verify_data.verificationCode

        # Special bypass for testing: allow "000000" to bypass verification
        if submitted_code == "000000":
            print(f"🔓 Test bypass: allowing verification code '000000' for {verify_data.email}")
        else:
            # Verify code matches stored code
            if pending_user['verification_code'] != submitted_code:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid verification code"
                )
        
        # 1) Create Supabase Auth user using the stored plain password
        try:
            auth_res = supabase.auth.admin.create_user({
                "email": verify_data.email,
                "password": pending_user['hashed_password'],
                "email_confirm": True
            })
            auth_user = getattr(auth_res, 'user', None)
        except Exception as e:
            error_msg = str(e)
            print(f"Supabase Admin create_user error: {error_msg}")
            
            # Check if error is due to email already existing
            if 'already' in error_msg.lower() or 'exists' in error_msg.lower() or 'registered' in error_msg.lower():
                # Clean up the pending user since this email is already registered
                delete_pending_user(verify_data.email)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email already registered. Please sign in instead."
                )
            
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create auth user"
            )

        if not auth_user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create auth user"
            )

        # 2) Create application user record
        user_id = generate_user_id()
        timestamp = get_current_app_time()
        user = create_user({
            'id': user_id,
            'auth_id': auth_user.id,
            'email': verify_data.email.lower(),
            'first_name': '',
            'last_name': '',
            'phone_number': '',
            'dob': '',
            'ssn': '',
            'is_verified': True,
            'verified_at': timestamp,
            'is_admin': False,
            'account_type': 'individual',
            'created_at': timestamp,
            'updated_at': timestamp
        })
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create user"
            )
        
        # Delete pending user
        delete_pending_user(verify_data.email)
        
        # Create activity log
        create_activity({
            'user_id': user['id'],
            'type': 'account_created',
            'date': get_current_app_time(),
            'description': 'User account created'
        })
        
        # Create JWT token and set cookie (auto-login)
        token_data = {
            "user_id": user['id'],
            "email": user['email'],
            "is_admin": False
        }
        token = create_access_token(token_data)
        
        response.set_cookie(
            key="auth_token",
            value=token,
            httponly=True,
            secure=settings.ENVIRONMENT == 'production',
            samesite="none" if settings.ENVIRONMENT == 'production' else "lax",
            max_age=7 * 24 * 60 * 60,
            path="/"
        )
        
        # Remove sensitive data
        user_response = {k: v for k, v in user.items() if k not in ('hashed_password', 'password')}
        
        return {
            "success": True,
            "user": user_response
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Verify error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Verification failed"
        )


@router.post("/request-reset")
async def request_password_reset(reset_request: PasswordResetRequest):
    """
    Request password reset email
    Always returns success (security: don't reveal if email exists)
    """
    try:
        # Get user
        user = get_user_by_email(reset_request.email)
        
        if user:
            # Generate reset token
            reset_token = generate_reset_token()
            
            # Store token with expiry (1 hour)
            # TODO: Implement password_reset_tokens table or use existing mechanism
            # For now, store in user record temporarily
            update_user(user['id'], {
                'password_reset_token': reset_token,
                'password_reset_expires': (
                    datetime.utcnow() + timedelta(hours=1)
                ).isoformat()
            })
            
            # TODO: Send reset email
            # send_password_reset_email(user['email'], reset_token)
            
            # Do not log password reset activity - too noisy
        
        # Always return success (security)
        return {
            "success": True,
            "message": "Password reset email sent (if account exists)"
        }
        
    except Exception as e:
        print(f"Password reset request error: {e}")
        # Always return success (security)
        return {
            "success": True,
            "message": "Password reset email sent (if account exists)"
        }


@router.post("/reset-password")
async def reset_password(reset_data: PasswordResetConfirm):
    """
    Reset password with token
    """
    try:
        # TODO: Implement proper password reset token validation
        # For now, this is a placeholder
        
        # Validate new password
        if not is_valid_password(reset_data.new_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 8 characters"
            )
        
        # Find user by reset token
        # TODO: Query users where password_reset_token = reset_data.token
        # and password_reset_expires > now()
        
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Password reset not yet implemented"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Password reset error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password reset failed"
        )


# Import at end to avoid circular dependency
from services.app_time import get_current_app_time

