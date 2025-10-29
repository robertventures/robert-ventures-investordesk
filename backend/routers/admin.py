"""
Admin Router
Handles admin-only operations
"""

from fastapi import APIRouter, HTTPException, status, Request
from models import TimeMachineRequest
from utils.auth import require_admin
from services.app_time import (
    get_app_time_status, set_app_time, reset_app_time
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/withdrawals")
async def get_admin_withdrawals(request: Request):
    """
    Get all withdrawal requests (admin only)
    """
    try:
        # Require admin
        require_admin(request)
        
        # Get all withdrawals from database
        from database import supabase
        response = supabase.table('withdrawals').select('*').execute()
        withdrawals = response.data if response.data else []
        
        return {
            "success": True,
            "withdrawals": withdrawals
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Get withdrawals error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get withdrawals"
        )


@router.post("/withdrawals")
async def manage_withdrawal(request: Request, action_data: dict):
    """
    Manage withdrawal requests - complete or reject
    Admin only
    
    Body: { action: 'complete' | 'reject', userId: str, withdrawalId: str }
    """
    try:
        print(f"\n[POST /api/admin/withdrawals] Starting withdrawal action...")
        
        # Require admin
        require_admin(request)
        
        action = action_data.get('action')
        user_id = action_data.get('userId')
        withdrawal_id = action_data.get('withdrawalId')
        
        if not action or not user_id or not withdrawal_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required fields: action, userId, withdrawalId"
            )
        
        if action not in ['complete', 'reject']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid action. Must be: complete or reject"
            )
        
        from database import supabase
        from datetime import datetime
        from services.app_time import get_current_app_time
        
        print(f"[Withdrawal Action] Action: {action}, User: {user_id}, Withdrawal: {withdrawal_id}")
        
        # Get withdrawal from database
        withdrawal_response = supabase.table('withdrawals').select('*, investments!inner(id, user_id, status)').eq('id', withdrawal_id).eq('user_id', user_id).maybe_single().execute()
        
        withdrawal = withdrawal_response.data if withdrawal_response.data else None
        
        if not withdrawal:
            print(f"[Withdrawal Action] ❌ Withdrawal not found: {withdrawal_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Withdrawal not found"
            )
        
        investment_id = withdrawal.get('investment_id')
        current_status = withdrawal.get('status')
        
        print(f"[Withdrawal Action] Found withdrawal - Investment: {investment_id}, Current status: {current_status}")
        
        # Prepare updates
        now = get_current_app_time()
        withdrawal_updates = {'updated_at': now}
        investment_updates = {}
        activity_type = None
        activity_description = None
        
        if action == 'complete':
            if current_status == 'approved':
                return {
                    "success": True,
                    "message": "Withdrawal already completed",
                    "withdrawal": withdrawal
                }
            
            # Mark withdrawal as approved (completed)
            withdrawal_updates['status'] = 'approved'
            withdrawal_updates['approved_at'] = now
            
            # Update investment to withdrawn status
            investment_updates['status'] = 'withdrawn'
            investment_updates['withdrawn_at'] = now
            
            activity_type = 'withdrawal_completed'
            activity_description = f"Withdrawal {withdrawal_id} completed by admin"
            
            print(f"[Withdrawal Action] ✅ Completing withdrawal and marking investment as withdrawn")
        
        elif action == 'reject':
            if current_status == 'rejected':
                return {
                    "success": True,
                    "message": "Withdrawal already rejected",
                    "withdrawal": withdrawal
                }
            
            # Mark withdrawal as rejected
            withdrawal_updates['status'] = 'rejected'
            withdrawal_updates['rejected_at'] = now
            
            # Revert investment back to active
            investment_updates['status'] = 'active'
            investment_updates['withdrawal_notice_start_at'] = None
            
            activity_type = 'withdrawal_rejected'
            activity_description = f"Withdrawal {withdrawal_id} rejected by admin"
            
            print(f"[Withdrawal Action] ❌ Rejecting withdrawal and reverting investment to active")
        
        # Update withdrawal
        print(f"[Withdrawal Action] Updating withdrawal...")
        update_withdrawal_response = supabase.table('withdrawals').update(withdrawal_updates).eq('id', withdrawal_id).execute()
        
        if not update_withdrawal_response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update withdrawal"
            )
        
        print(f"[Withdrawal Action] ✅ Withdrawal updated")
        
        # Update investment if needed
        if investment_updates:
            print(f"[Withdrawal Action] Updating investment {investment_id}...")
            update_investment_response = supabase.table('investments').update(investment_updates).eq('id', investment_id).execute()
            
            if not update_investment_response.data:
                print(f"[Withdrawal Action] ⚠️ Warning: Failed to update investment status")
            else:
                print(f"[Withdrawal Action] ✅ Investment updated")
        
        # Create activity log
        if activity_type:
            print(f"[Withdrawal Action] Creating activity log...")
            activity_data = {
                'user_id': user_id,
                'investment_id': investment_id,
                'type': activity_type,
                'date': now,
                'description': activity_description
            }
            supabase.table('activity').insert(activity_data).execute()
            print(f"[Withdrawal Action] ✅ Activity logged")
        
        updated_withdrawal = update_withdrawal_response.data[0] if update_withdrawal_response.data else None
        
        print(f"[Withdrawal Action] ✅ Successfully {action}d withdrawal {withdrawal_id}")
        
        return {
            "success": True,
            "withdrawal": updated_withdrawal,
            "message": f"Withdrawal {action}d successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Manage withdrawal error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to manage withdrawal"
        )


@router.post("/withdrawals/terminate")
async def terminate_investment(request: Request, action_data: dict):
    """
    Immediately terminate an active investment (admin only)
    Bypasses 90-day notice period and processes withdrawal immediately
    
    Body: {
        userId: str,
        investmentId: str,
        adminUserId: str,
        overrideLockup: bool (optional, required if lockup period is not yet expired)
    }
    """
    try:
        print(f"\n[POST /api/admin/withdrawals/terminate] Starting investment termination...")
        
        # Require admin
        require_admin(request)
        
        user_id = action_data.get('userId')
        investment_id = action_data.get('investmentId')
        admin_user_id = action_data.get('adminUserId')
        override_lockup = action_data.get('overrideLockup', False)
        
        if not user_id or not investment_id or not admin_user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required fields: userId, investmentId, adminUserId"
            )
        
        from database import supabase
        from services.app_time import get_current_app_time
        from services.calculations import calculate_final_withdrawal_payout
        from services.id_generator import generate_id
        
        print(f"[Terminate Investment] User: {user_id}, Investment: {investment_id}, Admin: {admin_user_id}")
        
        # Get investment from database
        investment_response = supabase.table('investments').select('*').eq('id', investment_id).eq('user_id', user_id).maybe_single().execute()
        
        investment = investment_response.data if investment_response.data else None
        
        if not investment:
            print(f"[Terminate Investment] ❌ Investment not found: {investment_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Investment not found"
            )
        
        current_status = investment.get('status')
        
        # Validate investment can be terminated
        if current_status not in ['active', 'withdrawal_notice']:
            print(f"[Terminate Investment] ❌ Investment cannot be terminated - status: {current_status}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Investment cannot be terminated. Status must be 'active' or 'withdrawal_notice' (current: {current_status})"
            )
        
        print(f"[Terminate Investment] Investment status: {current_status}")
        
        # Get current app time for calculations
        now = get_current_app_time()
        
        # Check lockup period
        lockup_end_date = investment.get('lockup_end_date')
        if lockup_end_date:
            from datetime import datetime
            lockup_end = datetime.fromisoformat(lockup_end_date.replace('Z', '+00:00'))
            current_time = datetime.fromisoformat(now.replace('Z', '+00:00'))
            
            if current_time < lockup_end:
                if not override_lockup:
                    print(f"[Terminate Investment] ❌ Lockup period not expired and override not confirmed")
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Investment is still in lockup period (ends {lockup_end_date}). Set overrideLockup=true to proceed."
                    )
                print(f"[Terminate Investment] ⚠️ Overriding lockup period (ends {lockup_end_date})")
        
        # Calculate final payout (principal + all accrued earnings including partial month)
        print(f"[Terminate Investment] Calculating final payout...")
        final_payout = calculate_final_withdrawal_payout(investment, now)
        
        print(f"[Terminate Investment] Final Payout - Total: ${final_payout['final_value']:.2f}, "
              f"Principal: ${final_payout['principal_amount']:.2f}, "
              f"Earnings: ${final_payout['total_earnings']:.2f}")
        
        # Create withdrawal record (status: approved for immediate processing)
        withdrawal_id = generate_id('W')
        withdrawal_data = {
            'id': withdrawal_id,
            'user_id': user_id,
            'investment_id': investment_id,
            'amount': final_payout['final_value'],
            'status': 'approved',
            'requested_at': now,
            'approved_at': now,
            'created_at': now,
            'updated_at': now,
            'termination_type': 'admin_immediate',
            'override_lockup': override_lockup,
            'admin_user_id': admin_user_id
        }
        
        print(f"[Terminate Investment] Creating withdrawal record: {withdrawal_id}")
        withdrawal_response = supabase.table('withdrawals').insert(withdrawal_data).execute()
        
        if not withdrawal_response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create withdrawal record"
            )
        
        print(f"[Terminate Investment] ✅ Withdrawal created")
        
        # Update investment status to withdrawn
        investment_updates = {
            'status': 'withdrawn',
            'withdrawn_at': now,
            'updated_at': now
        }
        
        print(f"[Terminate Investment] Updating investment status to withdrawn...")
        update_investment_response = supabase.table('investments').update(investment_updates).eq('id', investment_id).execute()
        
        if not update_investment_response.data:
            print(f"[Terminate Investment] ⚠️ Warning: Failed to update investment status")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update investment status"
            )
        
        print(f"[Terminate Investment] ✅ Investment updated")
        
        # Create activity logs
        print(f"[Terminate Investment] Creating activity logs...")
        
        # Log termination
        termination_description = f"Investment terminated by admin (ID: {admin_user_id})"
        if override_lockup:
            termination_description += " - Lockup period overridden"
        
        activity_termination = {
            'user_id': user_id,
            'investment_id': investment_id,
            'type': 'investment_terminated',
            'date': now,
            'description': termination_description
        }
        supabase.table('activity').insert(activity_termination).execute()
        
        # Log withdrawal completion
        activity_withdrawal = {
            'user_id': user_id,
            'investment_id': investment_id,
            'type': 'withdrawal_completed',
            'date': now,
            'description': f"Withdrawal {withdrawal_id} processed immediately (admin termination)"
        }
        supabase.table('activity').insert(activity_withdrawal).execute()
        
        print(f"[Terminate Investment] ✅ Activity logged")
        
        print(f"[Terminate Investment] ✅ Successfully terminated investment {investment_id}")
        
        return {
            "success": True,
            "message": "Investment terminated successfully",
            "withdrawal": withdrawal_response.data[0] if withdrawal_response.data else None,
            "finalPayout": {
                "finalValue": final_payout['final_value'],
                "principalAmount": final_payout['principal_amount'],
                "totalEarnings": final_payout['total_earnings'],
                "withdrawalDate": final_payout['withdrawal_date'],
                "monthsElapsed": final_payout['months_elapsed']
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Terminate investment error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to terminate investment: {str(e)}"
        )


@router.get("/pending-payouts")
async def get_pending_payouts(request: Request):
    """
    Get pending interest payouts (admin only)
    Returns list of pending/approved distribution transactions that require admin approval
    """
    try:
        # Require admin
        require_admin(request)
        
        # Get current app time to filter out future-dated distributions
        from services.app_time import get_current_app_time
        from database import supabase
        
        current_app_time = get_current_app_time()
        print(f"🕐 Pending Payouts - Current App Time: {current_app_time}")
        
        # Get all pending/approved distribution transactions with investment and user info
        response = supabase.table('transactions').select(
            '*,'
            'investments!inner('
                'id,'
                'amount,'
                'lockup_period,'
                'payment_frequency,'
                'user_id,'
                'users!inner('
                    'id,'
                    'email,'
                    'first_name,'
                    'last_name,'
                    'is_admin'
                ')'
            ')'
        ).eq('type', 'distribution').in_('status', ['pending', 'approved']).lte('date', current_app_time).order('date', desc=False).execute()
        
        transactions = response.data if response.data else []
        
        # Filter out compounding investments and format response
        pending_payouts = []
        for tx in transactions:
            investment = tx.get('investments', {})
            users = investment.get('users', {})
            
            # Exclude compounding investments - they don't require manual approval
            if investment.get('payment_frequency') == 'compounding' or tx.get('payment_frequency') == 'compounding':
                continue
            
            # Exclude admin users
            if users.get('is_admin'):
                continue
            
            # Format payout data
            payout = {
                'id': tx.get('id'),
                'type': tx.get('type'),
                'amount': tx.get('amount'),
                'date': tx.get('date'),
                'status': tx.get('status'),
                'month_index': tx.get('month_index'),
                'userId': users.get('id'),
                'userEmail': users.get('email'),
                'userName': f"{users.get('first_name', '')} {users.get('last_name', '')}".strip(),
                'investmentId': investment.get('id'),
                'investmentAmount': investment.get('amount', 0),
                'lockupPeriod': investment.get('lockup_period') or tx.get('lockup_period'),
                'paymentFrequency': investment.get('payment_frequency') or tx.get('payment_frequency'),
                'payoutBankNickname': tx.get('payout_bank_nickname', 'Unknown'),
                'failureReason': tx.get('failure_reason'),
                'retryCount': tx.get('retry_count', 0),
                'lastRetryAt': tx.get('last_retry_at')
            }
            pending_payouts.append(payout)
        
        return {
            "success": True,
            "pendingPayouts": pending_payouts,
            "count": len(pending_payouts)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Get pending payouts error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get pending payouts"
        )


@router.post("/pending-payouts")
async def manage_payout(request: Request, action_data: dict):
    """
    Manage pending payouts - retry, complete manually, or mark as failed
    Body: { action: 'retry' | 'complete' | 'fail', userId: str, transactionId: str, failureReason?: str }
    """
    try:
        # Require admin
        require_admin(request)
        
        action = action_data.get('action')
        user_id = action_data.get('userId')
        transaction_id = action_data.get('transactionId')
        failure_reason = action_data.get('failureReason')
        
        if not action or not user_id or not transaction_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required fields: action, userId, transactionId"
            )
        
        if action not in ['retry', 'complete', 'fail']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid action. Must be: retry, complete, or fail"
            )
        
        from database import supabase
        from datetime import datetime
        
        # Get transaction from database
        tx_response = supabase.table('transactions').select(
            '*, investments!inner(id, user_id)'
        ).eq('id', transaction_id).eq('investments.user_id', user_id).maybe_single().execute()
        
        transaction = tx_response.data if tx_response.data else None
        
        if not transaction:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaction not found"
            )
        
        if transaction.get('type') != 'distribution':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only distribution transactions can be managed"
            )
        
        now = datetime.utcnow().isoformat()
        updates = {'updated_at': now}
        
        if action == 'retry':
            # TESTING MODE: Simulate retry logic with mock bank transfer
            # In production, this would call the actual bank API
            # For testing, we simulate an 80% success rate
            
            import random
            retry_count = (transaction.get('retry_count') or 0) + 1
            retry_success = random.random() > 0.2
            
            updates['retry_count'] = retry_count
            updates['last_retry_at'] = now
            
            if retry_success:
                updates['status'] = 'received'
                updates['completed_at'] = now
                updates['failure_reason'] = None
            else:
                updates['status'] = 'rejected'
                updates['failure_reason'] = failure_reason or 'Mock bank transfer failed during retry'
        
        elif action == 'complete':
            updates['status'] = 'received'
            updates['completed_at'] = now
            updates['manually_completed'] = True
            updates['failure_reason'] = None
        
        elif action == 'fail':
            updates['status'] = 'rejected'
            updates['failed_at'] = now
            updates['failure_reason'] = failure_reason or 'Manually marked as failed by admin'
        
        # Update transaction in database
        update_response = supabase.table('transactions').update(updates).eq('id', transaction_id).execute()
        
        if not update_response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update transaction"
            )
        
        updated_transaction = update_response.data[0] if update_response.data else None
        
        message = f"Payout {'retried' if action == 'retry' else 'marked as completed' if action == 'complete' else 'marked as failed'} successfully"
        
        return {
            "success": True,
            "transaction": updated_transaction,
            "message": message
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Manage payout error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to manage payout"
        )


@router.get("/time-machine")
async def get_time_machine_status(request: Request):
    """
    Get current app time status including auto-approve setting
    Requires authentication (any user can read, only admin can modify)
    """
    try:
        # Any authenticated user can read the app time
        from utils.auth import get_current_user
        get_current_user(request)  # Just verify they're authenticated
        
        from database import get_app_settings
        
        # Get time status
        status_data = get_app_time_status()
        
        # Get auto-approve status
        settings = get_app_settings()
        status_data['autoApproveDistributions'] = settings.get('auto_approve_distributions', False) if settings else False
        
        return status_data
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Get time machine error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get app time"
        )


@router.post("/time-machine")
async def set_time_machine(
    time_data: TimeMachineRequest,
    request: Request
):
    """
    Set app time override or toggle auto-approve distributions
    Requires admin authentication
    
    Body can contain:
    - timestamp: ISO timestamp to set as app time
    - autoApproveDistributions: boolean to toggle auto-approve
    """
    try:
        # Require admin
        require_admin(request)
        
        from database import update_app_settings, get_app_settings
        
        # Handle auto-approve toggle
        if time_data.autoApproveDistributions is not None:
            print(f"[Time Machine] Setting auto-approve distributions to: {time_data.autoApproveDistributions}")
            result = update_app_settings({
                'auto_approve_distributions': time_data.autoApproveDistributions
            })
            
            if not result:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to update auto-approve setting"
                )
            
            # Get current settings to return full status
            settings = get_app_settings()
            current_time_status = get_app_time_status()
            
            return {
                'success': True,
                'autoApproveDistributions': time_data.autoApproveDistributions,
                'appTime': current_time_status.get('app_time'),
                'isActive': current_time_status.get('is_overridden', False),
                'message': f'Auto-approve distributions {("enabled" if time_data.autoApproveDistributions else "disabled")}'
            }
        
        # Handle time setting
        if time_data.timestamp:
            result = set_app_time(time_data.timestamp)
            
            if not result.get('success'):
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=result.get('error', 'Failed to set app time')
                )
            
            # Get auto-approve status to include in response
            settings = get_app_settings()
            result['autoApproveDistributions'] = settings.get('auto_approve_distributions', False) if settings else False
            
            return result
        
        # Neither timestamp nor autoApproveDistributions provided
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must provide either timestamp or autoApproveDistributions"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Set time machine error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to set app time"
        )


@router.delete("/time-machine")
async def reset_time_machine(request: Request):
    """
    Reset app time to real time
    Requires admin authentication
    """
    try:
        # Require admin
        require_admin(request)
        
        # Reset time
        result = reset_app_time()
        
        if not result.get('success'):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result.get('error', 'Failed to reset app time')
            )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Reset time machine error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset app time"
        )


@router.delete("/accounts")
async def delete_all_accounts(request: Request, action_data: dict):
    """
    Delete all non-admin accounts (admin only)
    WARNING: This is a destructive operation that removes all user data
    
    Body: { adminUserId: str }
    """
    try:
        print(f"\n[DELETE /api/admin/accounts] Starting bulk account deletion...")
        
        # Require admin
        current_user = require_admin(request)
        
        admin_user_id = action_data.get('adminUserId')
        if not admin_user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="adminUserId is required"
            )
        
        print(f"[Delete All Accounts] Admin: {admin_user_id}")
        
        from database import supabase
        
        # Get all non-admin users
        users_response = supabase.table('users').select('id, auth_id, email, is_admin').execute()
        all_users = users_response.data if users_response.data else []
        
        non_admin_users = [u for u in all_users if not u.get('is_admin')]
        
        print(f"[Delete All Accounts] Found {len(non_admin_users)} non-admin users to delete")
        
        if len(non_admin_users) == 0:
            return {
                "success": True,
                "message": "No non-admin accounts to delete",
                "deletedCount": 0
            }
        
        deleted_count = 0
        auth_deletion_failures = []
        
        for user in non_admin_users:
            user_id = user['id']
            auth_id = user.get('auth_id')
            email = user.get('email', 'unknown')
            
            try:
                print(f"[Delete All Accounts] Deleting user {user_id} ({email})...")
                
                # Get investments for this user
                investments_response = supabase.table('investments').select('id').eq('user_id', user_id).execute()
                investments = investments_response.data if investments_response.data else []
                investment_ids = [inv['id'] for inv in investments]
                
                # Delete transactions for these investments
                if investment_ids:
                    supabase.table('transactions').delete().in_('investment_id', investment_ids).execute()
                
                # Delete activity
                supabase.table('activity').delete().eq('user_id', user_id).execute()
                
                # Delete withdrawals
                supabase.table('withdrawals').delete().eq('user_id', user_id).execute()
                
                # Delete bank accounts
                supabase.table('bank_accounts').delete().eq('user_id', user_id).execute()
                
                # Delete investments
                if investment_ids:
                    supabase.table('investments').delete().in_('id', investment_ids).execute()
                
                # Delete user from database
                supabase.table('users').delete().eq('id', user_id).execute()
                
                # Try to delete from Supabase Auth
                if auth_id:
                    try:
                        auth_delete_response = supabase.auth.admin.delete_user(auth_id)
                        if hasattr(auth_delete_response, 'error') and auth_delete_response.error:
                            auth_deletion_failures.append({
                                'userId': user_id,
                                'authId': auth_id,
                                'email': email,
                                'error': str(auth_delete_response.error)
                            })
                            print(f"[Delete All Accounts] ⚠️ Failed to delete auth for {email}: {auth_delete_response.error}")
                    except Exception as auth_error:
                        auth_deletion_failures.append({
                            'userId': user_id,
                            'authId': auth_id,
                            'email': email,
                            'error': str(auth_error)
                        })
                        print(f"[Delete All Accounts] ⚠️ Exception deleting auth for {email}: {auth_error}")
                
                deleted_count += 1
                print(f"[Delete All Accounts] ✅ Deleted user {user_id} ({email})")
                
            except Exception as e:
                print(f"[Delete All Accounts] ❌ Failed to delete user {user_id}: {e}")
                # Continue with next user
                continue
        
        print(f"[Delete All Accounts] ✅ Completed: {deleted_count} users deleted")
        
        if auth_deletion_failures:
            print(f"[Delete All Accounts] ⚠️ {len(auth_deletion_failures)} auth deletion failures")
            return {
                "success": True,
                "message": f"Deleted {deleted_count} accounts from database, but {len(auth_deletion_failures)} auth deletions failed",
                "deletedCount": deleted_count,
                "authDeletionFailures": auth_deletion_failures
            }
        
        return {
            "success": True,
            "message": f"Successfully deleted {deleted_count} non-admin accounts",
            "deletedCount": deleted_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Delete all accounts error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete accounts"
        )


@router.post("/seed")
async def seed_test_accounts(request: Request, action_data: dict):
    """
    Seed test accounts with sample data (admin only)
    Creates multiple test users with investments and transactions
    
    Body: { adminUserId: str }
    """
    try:
        print(f"\n[POST /api/admin/seed] Starting test account seeding...")
        
        # Require admin
        current_user = require_admin(request)
        
        admin_user_id = action_data.get('adminUserId')
        if not admin_user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="adminUserId is required"
            )
        
        print(f"[Seed Accounts] Admin: {admin_user_id}")
        
        # Import the seeding functionality
        # Note: This assumes you have a seed script in the backend
        # For now, I'll return a placeholder that indicates the feature needs implementation
        
        return {
            "success": False,
            "error": "Seed functionality not yet implemented in Python backend. Please create seed data directly in Supabase or implement seeding in this endpoint."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Seed accounts error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to seed accounts"
        )


@router.get("/generate-master-password")
async def get_master_password_info(request: Request):
    """
    Get current master password info (admin only)
    Returns whether a password exists and when it expires
    """
    try:
        print(f"\n[GET /api/admin/generate-master-password] Checking master password status...")
        
        # Require admin
        require_admin(request)
        
        from database import get_app_settings
        from datetime import datetime
        
        # Get settings
        settings = get_app_settings()
        
        if not settings:
            return {
                "success": True,
                "hasPassword": False
            }
        
        master_password = settings.get('master_password')
        master_password_expires_at = settings.get('master_password_expires_at')
        
        if not master_password or not master_password_expires_at:
            return {
                "success": True,
                "hasPassword": False
            }
        
        # Check if expired
        expires_at = datetime.fromisoformat(master_password_expires_at.replace('Z', '+00:00'))
        now = datetime.utcnow()
        
        is_expired = now >= expires_at
        time_remaining_ms = int((expires_at - now).total_seconds() * 1000) if not is_expired else 0
        
        if is_expired:
            print(f"[Master Password] Password expired at {master_password_expires_at}")
            return {
                "success": True,
                "hasPassword": False
            }
        
        print(f"[Master Password] Active password found, expires at {master_password_expires_at}")
        
        return {
            "success": True,
            "hasPassword": True,
            "expiresAt": master_password_expires_at,
            "isExpired": False,
            "timeRemainingMs": time_remaining_ms
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Get master password info error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get master password info"
        )


@router.post("/generate-master-password")
async def generate_master_password(request: Request):
    """
    Generate a new master password (admin only)
    Creates a temporary password that can be used to access any investor account
    Password expires in 30 minutes
    """
    try:
        print(f"\n[POST /api/admin/generate-master-password] Generating new master password...")
        
        # Require admin
        require_admin(request)
        
        from database import update_app_settings
        from datetime import datetime, timedelta
        import secrets
        import string
        
        # Generate a secure random password (16 characters)
        alphabet = string.ascii_letters + string.digits
        password = ''.join(secrets.choice(alphabet) for i in range(16))
        
        # Set expiration to 30 minutes from now
        now = datetime.utcnow()
        expires_at = now + timedelta(minutes=30)
        expires_at_iso = expires_at.isoformat() + 'Z'
        
        print(f"[Master Password] Generated password, expires at {expires_at_iso}")
        
        # Store in app_settings
        result = update_app_settings({
            'master_password': password,
            'master_password_expires_at': expires_at_iso
        })
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to store master password"
            )
        
        print(f"[Master Password] ✅ Password generated and stored")
        
        return {
            "success": True,
            "password": password,
            "expiresAt": expires_at_iso,
            "message": "Master password generated successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Generate master password error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate master password"
        )

