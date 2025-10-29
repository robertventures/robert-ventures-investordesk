"""
Investments Router
Handles investment CRUD operations
"""

from fastapi import APIRouter, HTTPException, status, Request, Query
from typing import Optional
from models import CreateInvestmentRequest, UpdateInvestmentRequest
from utils.auth import verify_user_access
from database import (
    get_investments_by_user, create_investment,
    update_investment, delete_investment, create_activity
)
from services.id_generator import generate_investment_id
from services.app_time import get_current_app_time

router = APIRouter(prefix="/api/users", tags=["investments"])


@router.get("/{user_id}/investments")
async def list_investments(user_id: str, request: Request):
    """
    Get all investments for a user
    Requires authentication - must be same user or admin
    """
    try:
        # Verify access
        verify_user_access(request, user_id)
        
        # Get investments
        investments = get_investments_by_user(user_id)
        
        return {
            "success": True,
            "investments": investments
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"List investments error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list investments"
        )


@router.post("/{user_id}/investments")
async def create_new_investment(
    user_id: str,
    investment_data: CreateInvestmentRequest,
    request: Request
):
    """
    Create a new investment
    Requires authentication - must be same user or admin
    """
    try:
        # Verify access
        verify_user_access(request, user_id)
        
        # Validate amount
        amount = investment_data.amount
        if amount < 1000:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Minimum investment amount is $1,000"
            )
        
        if amount % 10 != 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Investment amount must be in $10 increments"
            )
        
        # Validate IRA account type
        if investment_data.accountType == 'ira' and investment_data.paymentFrequency == 'monthly':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="IRA accounts can only use compounding payment frequency"
            )
        
        # Generate investment ID
        investment_id = generate_investment_id()
        
        # Create investment
        # Bonds are priced at $10 each in the UI; store computed bond count
        bonds_count = int(amount // 10)

        # Determine payment method and manual approval flags
        # - IRA must use wire
        # - Amounts > $100,000 must use wire
        # - Otherwise ACH (auto-approved later when moving to pending)
        payment_method = 'wire' if (investment_data.accountType == 'ira' or amount > 100000) else 'ach'
        requires_manual_approval = payment_method == 'wire'
        manual_approval_reason = None
        if requires_manual_approval:
            if investment_data.accountType == 'ira':
                manual_approval_reason = 'IRA accounts must use wire transfer'
            elif amount > 100000:
                manual_approval_reason = 'Investments over $100,000 must use wire transfer'

        investment_payload = {
            'id': investment_id,
            'user_id': user_id,
            'amount': amount,
            'bonds': bonds_count,
            'lockup_period': investment_data.lockupPeriod,
            'payment_frequency': investment_data.paymentFrequency,
            'account_type': investment_data.accountType or 'individual',
            'payment_method': payment_method,
            'requires_manual_approval': requires_manual_approval,
            **({'manual_approval_reason': manual_approval_reason} if manual_approval_reason else {}),
            'status': 'draft',
            'created_at': get_current_app_time()
        }
        print(f"Creating investment with payload: {investment_payload}")
        investment = create_investment(investment_payload)
        
        if not investment:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create investment"
            )
        
        # Do not log activity for draft creation
        # Activity will be logged when investment is submitted
        
        return {
            "success": True,
            "investment": investment
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Create investment error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create investment"
        )


@router.patch("/{user_id}/investments")
async def update_existing_investment(
    user_id: str,
    update_data: UpdateInvestmentRequest,
    request: Request
):
    """
    Update an existing investment
    Only draft investments can be updated
    Requires authentication - must be same user or admin
    """
    try:
        # Verify access
        verify_user_access(request, user_id)
        
        investment_id = update_data.investmentId
        
        if not investment_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Investment ID is required"
            )
        
        # Build update fields
        update_fields = {}
        
        if update_data.amount is not None:
            if update_data.amount < 1000:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Minimum investment amount is $1,000"
                )
            if update_data.amount % 10 != 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Investment amount must be in $10 increments"
                )
            update_fields['amount'] = update_data.amount
            # Recalculate bonds when amount changes
            update_fields['bonds'] = int(update_data.amount // 10)
        
        if update_data.lockupPeriod:
            update_fields['lockup_period'] = update_data.lockupPeriod
        
        if update_data.paymentFrequency:
            update_fields['payment_frequency'] = update_data.paymentFrequency
        
        if update_data.accountType:
            update_fields['account_type'] = update_data.accountType
        
        if update_data.status:
            update_fields['status'] = update_data.status
        
        if not update_fields:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid fields to update"
            )
        
        # Update investment
        investment = update_investment(investment_id, update_fields)
        
        if not investment:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update investment"
            )
        
        # If investment status is being changed to pending or confirmed,
        # lock the user's account type if not already set
        if update_data.status and update_data.status in ['pending', 'confirmed']:
            from database import get_user_by_id, update_user
            user = get_user_by_id(user_id)
            if user and not user.get('account_type') and investment.get('account_type'):
                # Save the investment's account type to the user record
                update_user(user_id, {'account_type': investment['account_type']})
                print(f"Locked user {user_id} account type to {investment['account_type']}")
        
        # Do not log activity for investment updates via this endpoint
        # Activity logging is handled in users.py router when status changes
        
        return {
            "success": True,
            "investment": investment
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Update investment error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update investment"
        )


@router.delete("/{user_id}/investments")
async def delete_draft_investment(
    user_id: str,
    request: Request,
    investmentId: str = Query(...)
):
    """
    Delete a draft investment
    Only draft investments can be deleted
    Requires authentication - must be same user or admin
    """
    try:
        # Verify access
        verify_user_access(request, user_id)
        
        # TODO: Verify investment is draft before deleting
        # For now, database layer should handle this
        
        # Delete investment
        success = delete_investment(investmentId)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete investment"
            )
        
        # Do not log activity for draft deletion
        # User can freely create and delete drafts
        
        return {
            "success": True,
            "message": "Investment deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Delete investment error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete investment"
        )

