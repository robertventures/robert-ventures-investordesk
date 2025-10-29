"""
Pydantic Data Models
Request and response schemas with validation
"""

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from pydantic import ConfigDict
from typing import Optional, List, Literal
from datetime import datetime


# ============================================================================
# Request Models
# ============================================================================

class LoginRequest(BaseModel):
    """Login request"""
    email: EmailStr
    password: str = Field(..., min_length=8)


class RegisterRequest(BaseModel):
    """Registration request"""
    email: EmailStr
    password: str = Field(..., min_length=8)


class VerifyRequest(BaseModel):
    """Verification request"""
    email: EmailStr
    code: Optional[str] = Field(None, min_length=6, max_length=6)
    verificationCode: Optional[str] = Field(None, min_length=6, max_length=6)

    # Allow any extra fields to avoid 422 from unknown keys sent by clients
    model_config = ConfigDict(extra='allow')

    @field_validator('code', 'verificationCode')
    @classmethod
    def validate_verification_fields(cls, v):
        """Validate verification code format"""
        if v is None:
            return v
        if len(v) != 6 or not v.isdigit():
            raise ValueError('Verification code must be exactly 6 digits')
        return v

    @model_validator(mode='after')
    def validate_at_least_one_field(self):
        """Ensure at least one verification field is provided"""
        code = self.code
        verification_code = self.verificationCode

        # If both are None, raise error
        if code is None and verification_code is None:
            raise ValueError('Either code or verificationCode must be provided')

        return self

    # Pydantic v2 uses model_config; keep backward-compat behaviour


class PasswordResetRequest(BaseModel):
    """Password reset request"""
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    """Password reset confirmation"""
    token: str
    new_password: str = Field(..., min_length=8)


class UpdateUserRequest(BaseModel):
    """Update user details"""
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    phoneNumber: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zipCode: Optional[str] = None
    dateOfBirth: Optional[str] = None


class CreateInvestmentRequest(BaseModel):
    """Create investment request"""
    amount: float = Field(..., ge=1000, le=10000000)
    lockupPeriod: Literal['1-year', '3-year']
    paymentFrequency: Literal['compounding', 'monthly']
    accountType: Optional[Literal['individual', 'joint', 'entity', 'ira']] = 'individual'
    
    @field_validator('amount')
    @classmethod
    def validate_amount(cls, v):
        """Validate amount is in $10 increments"""
        if v % 10 != 0:
            raise ValueError('Amount must be in $10 increments')
        return v
    
    @model_validator(mode='after')
    def validate_ira_frequency(self):
        """IRA accounts can only use compounding"""
        if self.accountType == 'ira' and self.paymentFrequency == 'monthly':
            raise ValueError('IRA accounts can only use compounding payment frequency')
        return self


class UpdateInvestmentRequest(BaseModel):
    """Update investment request"""
    investmentId: str
    amount: Optional[float] = Field(None, ge=1000, le=10000000)
    lockupPeriod: Optional[Literal['1-year', '3-year']] = None
    paymentFrequency: Optional[Literal['compounding', 'monthly']] = None
    accountType: Optional[Literal['individual', 'joint', 'entity', 'ira']] = None
    status: Optional[str] = None
    
    @field_validator('amount')
    @classmethod
    def validate_amount(cls, v):
        """Validate amount is in $10 increments"""
        if v is not None and v % 10 != 0:
            raise ValueError('Amount must be in $10 increments')
        return v


class CreateWithdrawalRequest(BaseModel):
    """Create withdrawal request"""
    userId: str
    investmentId: str


class TimeMachineRequest(BaseModel):
    """Time machine request"""
    timestamp: Optional[str] = None  # ISO format - optional for auto-approve toggle
    autoApproveDistributions: Optional[bool] = None  # Toggle auto-approve setting


# ============================================================================
# Response Models
# ============================================================================

class UserResponse(BaseModel):
    """User response"""
    id: str
    email: str
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    phoneNumber: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zipCode: Optional[str] = None
    accountType: str = 'individual'
    dateOfBirth: Optional[str] = None
    isAdmin: bool = False
    isVerified: bool = False
    createdAt: str
    updatedAt: Optional[str] = None
    
    class Config:
        from_attributes = True


class InvestmentResponse(BaseModel):
    """Investment response"""
    id: str
    userId: str
    amount: float
    lockupPeriod: str
    paymentFrequency: str
    accountType: str = 'individual'
    status: str = 'draft'
    confirmedAt: Optional[str] = None
    lockupEndDate: Optional[str] = None
    signedAt: Optional[str] = None
    createdAt: str
    updatedAt: Optional[str] = None
    
    class Config:
        from_attributes = True


class TransactionResponse(BaseModel):
    """Transaction response"""
    id: str
    userId: str
    investmentId: str
    type: str
    amount: float
    balance: float
    date: str
    description: Optional[str] = None
    createdAt: str
    
    class Config:
        from_attributes = True


class WithdrawalResponse(BaseModel):
    """Withdrawal response"""
    id: str
    userId: str
    investmentId: str
    status: str
    requestedAmount: float
    requestedAt: str
    processedAt: Optional[str] = None
    processedBy: Optional[str] = None
    
    class Config:
        from_attributes = True


class SuccessResponse(BaseModel):
    """Generic success response"""
    success: bool = True
    message: Optional[str] = None
    data: Optional[dict] = None


class ErrorResponse(BaseModel):
    """Error response"""
    success: bool = False
    error: str
    code: Optional[str] = None
    details: Optional[dict] = None


class HealthResponse(BaseModel):
    """Health check response"""
    success: bool = True
    status: str = "healthy"
    timestamp: str


class LoginResponse(BaseModel):
    """Login response"""
    success: bool = True
    user: UserResponse


class RegisterResponse(BaseModel):
    """Registration response"""
    success: bool = True
    message: str = "Verification code sent to email"
    email: str


class UserDetailResponse(BaseModel):
    """User with related data"""
    success: bool = True
    user: dict  # Complex nested structure


class InvestmentsListResponse(BaseModel):
    """List of investments"""
    success: bool = True
    investments: List[InvestmentResponse]


class TransactionsListResponse(BaseModel):
    """List of transactions"""
    success: bool = True
    transactions: List[TransactionResponse]


class WithdrawalsListResponse(BaseModel):
    """List of withdrawals"""
    success: bool = True
    withdrawals: List[WithdrawalResponse]


class TimeMachineResponse(BaseModel):
    """Time machine response"""
    success: bool = True
    appTime: str
    isOverridden: bool = False
    realTime: Optional[str] = None


# ============================================================================
# Internal Models
# ============================================================================

class TokenData(BaseModel):
    """JWT token data"""
    user_id: str
    email: str
    is_admin: bool = False


class InvestmentCalculation(BaseModel):
    """Investment calculation result"""
    current_value: float
    total_earnings: float
    months_elapsed: float
    is_withdrawable: bool
    lockup_end_date: str
    monthly_interest_amount: float = 0.0

