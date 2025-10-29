"""
Withdrawals Router
Handles withdrawal requests
"""

from fastapi import APIRouter, HTTPException, status, Request
from models import CreateWithdrawalRequest
from utils.auth import get_current_user, verify_user_access
from database import (
    get_withdrawals_by_user, create_withdrawal,
    update_investment, create_activity, get_user_by_id
)
from services.id_generator import generate_withdrawal_id
from services.calculations import calculate_investment_value
from services.app_time import get_current_app_time

router = APIRouter(prefix="/api", tags=["withdrawals"])


@router.get("/users/{user_id}/withdrawals")
async def list_withdrawals(user_id: str, request: Request):
    """
    Get all withdrawals for a user
    Requires authentication - must be same user or admin
    """
    try:
        # Verify access
        verify_user_access(request, user_id)
        
        # Get withdrawals
        withdrawals = get_withdrawals_by_user(user_id)
        
        return {
            "success": True,
            "withdrawals": withdrawals
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"List withdrawals error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list withdrawals"
        )


@router.post("/withdrawals")
async def create_withdrawal_request(
    withdrawal_data: CreateWithdrawalRequest,
    request: Request
):
    """
    Create a withdrawal request
    Checks lockup period and creates withdrawal
    Requires authentication
    """
    try:
        # Get current user
        current_user = get_current_user(request)
        
        # Verify access to investment
        verify_user_access(request, withdrawal_data.userId)
        
        # Get user with investments
        user = get_user_by_id(withdrawal_data.userId)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Find investment
        investment = None
        for inv in user.get('investments', []):
            if inv['id'] == withdrawal_data.investmentId:
                investment = inv
                break
        
        if not investment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Investment not found"
            )
        
        # Check investment status
        if investment['status'] != 'active':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Investment must be active to withdraw"
            )
        
        # Calculate current value and check lockup
        calculation = calculate_investment_value(investment)
        
        if not calculation['is_withdrawable']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Lockup period not ended. Available from {calculation['lockup_end_date']}"
            )
        
        # Generate withdrawal ID
        withdrawal_id = generate_withdrawal_id()
        
        # Create withdrawal
        withdrawal = create_withdrawal({
            'id': withdrawal_id,
            'user_id': withdrawal_data.userId,
            'investment_id': withdrawal_data.investmentId,
            'status': 'pending',
            'requested_amount': calculation['current_value'],
            'requested_at': get_current_app_time()
        })
        
        if not withdrawal:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create withdrawal"
            )
        
        # Update investment status
        update_investment(withdrawal_data.investmentId, {
            'status': 'withdrawal_notice',
            'withdrawal_notice_start_at': get_current_app_time()
        })
        
        # Log activity
        create_activity({
            'user_id': withdrawal_data.userId,
            'investment_id': withdrawal_data.investmentId,
            'type': 'withdrawal_requested',
            'date': get_current_app_time(),
            'description': f"Withdrawal requested for investment {withdrawal_data.investmentId}"
        })
        
        return {
            "success": True,
            "withdrawal": withdrawal
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Create withdrawal error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create withdrawal"
        )

