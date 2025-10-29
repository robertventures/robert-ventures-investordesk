"""
Transactions Router
Handles transaction queries
"""

from fastapi import APIRouter, HTTPException, status, Request, Query
from typing import Optional
from utils.auth import verify_user_access
from database import get_transactions_by_user

router = APIRouter(prefix="/api/users", tags=["transactions"])


@router.get("/{user_id}/transactions")
async def list_transactions(
    user_id: str,
    request: Request,
    investmentId: Optional[str] = Query(None)
):
    """
    Get all transactions for a user
    Optionally filter by investment
    Requires authentication - must be same user or admin
    """
    try:
        # Verify access
        verify_user_access(request, user_id)
        
        # Get transactions
        transactions = get_transactions_by_user(user_id, investmentId)
        
        return {
            "success": True,
            "transactions": transactions
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"List transactions error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list transactions"
        )

