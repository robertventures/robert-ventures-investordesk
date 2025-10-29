"""
Users Router
Handles user management endpoints
"""

from fastapi import APIRouter, HTTPException, status, Request, Body
from typing import Optional
from models import UpdateUserRequest, SuccessResponse
from utils.auth import get_current_user, verify_user_access
from database import get_user_by_id, update_user, create_activity
from services.app_time import get_current_app_time

router = APIRouter(prefix="/api/users", tags=["users"])


def convert_user_to_camel_case(user: dict) -> dict:
    """Convert user object from snake_case to camelCase"""
    if not user:
        return user
    
    user_copy = user.copy()
    
    # Remove sensitive data
    for sensitive_field in ['hashed_password', 'password', 'ssn', 'password_reset_token']:
        user_copy.pop(sensitive_field, None)
    
    # Convert to camelCase
    user_copy['isAdmin'] = user_copy.pop('is_admin', False)
    user_copy['isVerified'] = user_copy.pop('is_verified', False)
    user_copy['needsOnboarding'] = user_copy.pop('needs_onboarding', False)
    user_copy['authId'] = user_copy.pop('auth_id', None)
    user_copy['firstName'] = user_copy.pop('first_name', None)
    user_copy['lastName'] = user_copy.pop('last_name', None)
    user_copy['phoneNumber'] = user_copy.pop('phone_number', None)
    user_copy['createdAt'] = user_copy.pop('created_at', None)
    user_copy['updatedAt'] = user_copy.pop('updated_at', None)
    user_copy['verifiedAt'] = user_copy.pop('verified_at', None)
    user_copy['accountType'] = user_copy.pop('account_type', None)
    user_copy['jointHolder'] = user_copy.pop('joint_holder', None)
    user_copy['jointHoldingType'] = user_copy.pop('joint_holding_type', None)
    user_copy['entityName'] = user_copy.pop('entity_name', None)
    user_copy['authorizedRepresentative'] = user_copy.pop('authorized_representative', None)
    user_copy['taxInfo'] = user_copy.pop('tax_info', None)
    user_copy['onboardingToken'] = user_copy.pop('onboarding_token', None)
    user_copy['onboardingTokenExpires'] = user_copy.pop('onboarding_token_expires', None)
    user_copy['onboardingCompletedAt'] = user_copy.pop('onboarding_completed_at', None)
    user_copy['displayCreatedAt'] = user_copy.pop('display_created_at', None)
    user_copy['bankAccounts'] = user_copy.pop('bank_accounts', None)
    
    # Convert nested investments if present
    if user_copy.get('investments'):
        investments_camel = []
        for inv in user_copy['investments']:
            inv_copy = inv.copy()
            # Convert investment fields to camelCase
            inv_copy['userId'] = inv_copy.pop('user_id', None)
            inv_copy['createdAt'] = inv_copy.pop('created_at', None)
            inv_copy['updatedAt'] = inv_copy.pop('updated_at', None)
            inv_copy['confirmedAt'] = inv_copy.pop('confirmed_at', None)
            inv_copy['accountType'] = inv_copy.pop('account_type', None)
            inv_copy['lockupPeriod'] = inv_copy.pop('lockup_period', None)
            inv_copy['paymentFrequency'] = inv_copy.pop('payment_frequency', None)
            inv_copy['paymentMethod'] = inv_copy.pop('payment_method', None)
            inv_copy['jointHolder'] = inv_copy.pop('joint_holder', None)
            inv_copy['jointHoldingType'] = inv_copy.pop('joint_holding_type', None)
            inv_copy['bankAccount'] = inv_copy.pop('bank_account', None)
            
            # Convert nested transactions if present
            if inv_copy.get('transactions'):
                transactions_camel = []
                for txn in inv_copy['transactions']:
                    txn_copy = txn.copy()
                    txn_copy['userId'] = txn_copy.pop('user_id', None)
                    txn_copy['investmentId'] = txn_copy.pop('investment_id', None)
                    txn_copy['createdAt'] = txn_copy.pop('created_at', None)
                    txn_copy['monthIndex'] = txn_copy.pop('month_index', None)
                    txn_copy['failureReason'] = txn_copy.pop('failure_reason', None)
                    transactions_camel.append(txn_copy)
                inv_copy['transactions'] = transactions_camel
            
            investments_camel.append(inv_copy)
        user_copy['investments'] = investments_camel
    
    return user_copy


@router.get("")
async def get_all_users(request: Request):
    """
    Get all users (admin only)
    Returns list of all users with their data including investments, transactions, and activity
    """
    try:
        # Verify admin access
        current_user = get_current_user(request)
        if not current_user.get('is_admin'):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required"
            )
        
        # Get all users from database with related data
        from database import supabase
        response = supabase.table('users').select(
            '*,'
            'investments(*),'
            'bank_accounts(*),'
            'withdrawals(*)'
        ).execute()
        users = response.data if response.data else []
        
        # Get transactions and activity for each user
        for user in users:
            # Get transactions for each investment
            if user.get('investments'):
                for investment in user['investments']:
                    txn_response = supabase.table('transactions').select('*').eq(
                        'investment_id', investment['id']
                    ).order('date', desc=False).execute()
                    investment['transactions'] = txn_response.data or []
            
            # Get activity events for user
            activity_response = supabase.table('activity').select('*').eq(
                'user_id', user['id']
            ).order('date', desc=True).execute()
            user['activity'] = activity_response.data or []
        
        # Convert all users to camelCase
        users_camel = [convert_user_to_camel_case(user) for user in users]
        
        return {
            "success": True,
            "users": users_camel
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Get all users error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get users"
        )


@router.get("/{user_id}")
async def get_user(user_id: str, request: Request, fresh: Optional[bool] = False):
    """
    Get user details with related data (investments, transactions, etc.)
    Requires authentication - must be same user or admin
    """
    try:
        # Verify access
        current_user = verify_user_access(request, user_id)
        
        # Get user with related data
        user = get_user_by_id(user_id)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Convert to camelCase
        user_camel = convert_user_to_camel_case(user)
        
        return {
            "success": True,
            "user": user_camel
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Get user error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get user"
        )


@router.put("/{user_id}")
async def update_user_details(user_id: str, request: Request, update_data: dict = Body(...)):
    """
    Update user details
    Requires authentication - must be same user or admin
    
    Special actions:
    - _action: 'updateInvestment' - Update investment
    - _action: 'completeProfile' - Mark profile complete
    """
    try:
        # Debug: Log received data
        print(f"\n=== UPDATE USER {user_id} ===")
        print(f"Received data keys: {list(update_data.keys())}")
        print(f"Received data: {update_data}")
        print("=" * 50)
        
        # Verify access
        current_user = verify_user_access(request, user_id)
        
        # Check for special actions
        action = update_data.get('_action')
        
        if action == 'updateInvestment':
            # Update investment
            from database import update_investment, supabase
            
            investment_id = update_data.get('investmentId')
            fields = update_data.get('fields', {})
            
            if not investment_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Investment ID required"
                )
            
            print(f"Updating investment {investment_id} with fields: {fields}")
            
            # Get the current investment to detect status changes
            old_investment_response = supabase.table('investments').select('status').eq('id', investment_id).maybe_single().execute()
            old_status = old_investment_response.data.get('status') if old_investment_response.data else None
            new_status = fields.get('status')
            
            # Extract only fields that exist as columns in the investments table
            # Other fields (compliance, banking, documents) are ignored - they're UI state only
            valid_investment_fields = {
                'amount', 'lockupPeriod', 'paymentFrequency', 'accountType', 
                'paymentMethod', 'status', 'confirmedAt', 'lockupEndDate', 
                'signedAt', 'submittedAt', 'updatedAt', 'requiresManualApproval'
            }
            
            # Extract only valid fields for the investments table
            investment_updates = {k: v for k, v in fields.items() if k in valid_investment_fields}
            
            # Log ignored fields for debugging
            ignored_fields = {k for k in fields.keys() if k not in valid_investment_fields}
            if ignored_fields:
                print(f"Ignoring non-column fields (UI state only): {list(ignored_fields)}")
            
            # If no valid fields to update (e.g., for individual accounts where personal data 
            # is stored at user level), just return success
            if not investment_updates:
                print(f"No fields to update for investment {investment_id} (normal for individual accounts)")
                # No activity logging for this case
                return {
                    "success": True,
                    "message": "Investment information confirmed"
                }
            
            print(f"Actual investment table updates: {investment_updates}")
            investment = update_investment(investment_id, investment_updates)
            
            if not investment:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to update investment"
                )
            
            # If investment status is being changed to pending or confirmed,
            # lock the user's account type if not already set
            if new_status in ['pending', 'active']:
                user = get_user_by_id(user_id)
                if user and not user.get('account_type') and investment.get('account_type'):
                    # Save the investment's account type to the user record
                    update_user(user_id, {'account_type': investment['account_type']})
                    print(f"Locked user {user_id} account type to {investment['account_type']}")
            
            # CRITICAL: Set confirmedAt timestamp when investment is approved
            if new_status == 'active' and old_status != 'active':
                confirmation_time = get_current_app_time()
                # Update investment with confirmedAt timestamp
                update_investment(investment_id, {'confirmedAt': confirmation_time})
                print(f"Set confirmedAt for investment {investment_id} to {confirmation_time}")
                
                # Calculate lockup end date based on confirmation date and lockup period
                # This ensures proper tracking of when funds can be withdrawn
                if investment.get('lockup_period'):
                    from datetime import datetime
                    from dateutil.relativedelta import relativedelta
                    
                    confirm_date = datetime.fromisoformat(confirmation_time.replace('Z', '+00:00'))
                    
                    if investment['lockup_period'] == '1-year':
                        lockup_end = confirm_date + relativedelta(years=1)
                    elif investment['lockup_period'] == '3-year':
                        lockup_end = confirm_date + relativedelta(years=3)
                    else:
                        lockup_end = None
                    
                    if lockup_end:
                        lockup_end_str = lockup_end.isoformat()
                        update_investment(investment_id, {'lockupEndDate': lockup_end_str})
                        print(f"Set lockupEndDate for investment {investment_id} to {lockup_end_str}")
            
            # Log activity based on status change
            if new_status and new_status != old_status:
                if new_status == 'pending':
                    # User submitted investment (draft -> pending)
                    create_activity({
                        'user_id': user_id,
                        'investment_id': investment_id,
                        'type': 'investment_submitted',
                        'date': get_current_app_time(),
                        'description': f"Investment {investment_id} submitted for review"
                    })
                    print(f"Created investment_submitted activity for {investment_id}")
                elif new_status == 'active':
                    # Admin confirmed investment (pending -> active)
                    create_activity({
                        'user_id': user_id,
                        'investment_id': investment_id,
                        'type': 'investment_confirmed',
                        'date': get_current_app_time(),
                        'description': f"Investment {investment_id} confirmed"
                    })
                    print(f"Created investment_confirmed activity for {investment_id}")
                elif new_status == 'rejected':
                    # Admin rejected investment (pending -> rejected)
                    create_activity({
                        'user_id': user_id,
                        'investment_id': investment_id,
                        'type': 'investment_rejected',
                        'date': get_current_app_time(),
                        'description': f"Investment {investment_id} rejected"
                    })
                    print(f"Created investment_rejected activity for {investment_id}")
            
            return {
                "success": True,
                "investment": investment
            }
        
        if action == 'addBankAccount':
            # Add bank account to bank_accounts table
            from database import create_bank_account, get_bank_accounts_by_user, update_bank_account
            
            bank_account = update_data.get('bankAccount')
            
            if not bank_account:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Bank account data required"
                )
            
            print(f"Adding bank account for user {user_id}: {bank_account.get('nickname', 'Unknown')}")
            
            # Map frontend fields to database columns
            bank_data = {
                'id': bank_account.get('id'),
                'user_id': user_id,
                'nickname': bank_account.get('nickname'),
                'type': bank_account.get('type', 'ach'),
                'last_used_at': bank_account.get('lastUsedAt') or bank_account.get('createdAt'),
                'is_default': bank_account.get('isDefault', False),
                'metadata': {},  # Store any additional fields as JSON
                'created_at': bank_account.get('createdAt'),
                'bank_id': bank_account.get('bankId'),
                'bank_name': bank_account.get('bankName'),
                'bank_logo': bank_account.get('bankLogo'),
                'bank_color': bank_account.get('bankColor'),
                'account_type': bank_account.get('accountType'),
                'account_name': bank_account.get('accountName'),
                'last4': bank_account.get('last4')
            }
            
            # Check if account already exists
            existing_accounts = get_bank_accounts_by_user(user_id)
            existing_account = next((acc for acc in existing_accounts if acc.get('id') == bank_data['id']), None)
            
            if existing_account:
                # Update existing account
                print(f"Updating existing bank account: {bank_data['id']}")
                saved_account = update_bank_account(bank_data['id'], bank_data)
            else:
                # Create new account
                print(f"Creating new bank account: {bank_data['id']}")
                saved_account = create_bank_account(bank_data)
            
            if not saved_account:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to save bank account"
                )
            
            # Do not log activity for bank account addition
            # Too noisy - only track significant events
            
            # Get updated list of all bank accounts
            all_bank_accounts = get_bank_accounts_by_user(user_id)
            
            # Get updated user data
            user = get_user_by_id(user_id)
            user_camel = convert_user_to_camel_case(user) if user else {}
            
            return {
                "success": True,
                "message": "Bank account saved successfully",
                "user": user_camel,
                "bankAccounts": all_bank_accounts
            }
        
        # Regular user update
        # Remove fields that shouldn't be updated
        # Note: bankAccounts is NOT a column - it's a separate table
        update_fields_raw = {k: v for k, v in update_data.items() if k not in [
            'id', 'email', 'hashed_password', 'is_admin', 'is_verified',
            'created_at', '_action', 'bankAccounts', 'investments', 'withdrawals', 
            'activity', 'transactions'
        ]}
        
        if not update_fields_raw:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid fields to update"
            )
        
        # Convert camelCase to snake_case for database
        update_fields = {}
        field_mapping = {
            'firstName': 'first_name',
            'lastName': 'last_name',
            'phoneNumber': 'phone_number',
            'dateOfBirth': 'dob',
            'accountType': 'account_type',
            'jointHolder': 'joint_holder',
            'jointHoldingType': 'joint_holding_type',
            'authorizedRepresentative': 'authorized_representative',
            'entityName': 'entity_name'
        }
        
        for key, value in update_fields_raw.items():
            # Convert field name if mapping exists
            db_key = field_mapping.get(key, key)
            
            # Handle nested entity object
            if key == 'entity' and isinstance(value, dict):
                # Extract entity fields and flatten them
                if 'name' in value:
                    update_fields['entity_name'] = value['name']
                if 'registrationDate' in value:
                    update_fields['dob'] = value['registrationDate']
                if 'taxId' in value:
                    update_fields['tax_id'] = value['taxId']
                continue
            
            # Keep address, jointHolder, and authorizedRepresentative as JSON - the database supports it
            update_fields[db_key] = value
        
        print(f"Updating user {user_id} with fields: {list(update_fields.keys())}")
        
        # Update user
        updated_user = update_user(user_id, update_fields)
        
        if not updated_user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update user"
            )
        
        # Do not log activity for profile updates
        # Too noisy - only track significant events
        
        # Remove sensitive data
        if 'hashed_password' in updated_user:
            del updated_user['hashed_password']
        
        return {
            "success": True,
            "user": updated_user
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Update user error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update user: {str(e)}"
        )


@router.get("/profile")
async def get_current_user_profile(request: Request):
    """
    Get current logged-in user's profile
    Requires authentication
    """
    try:
        # Get current user from token
        user = get_current_user(request)
        
        # Get full user data
        full_user = get_user_by_id(user['id'])
        
        if not full_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Convert to camelCase
        user_camel = convert_user_to_camel_case(full_user)
        
        return {
            "success": True,
            "user": user_camel
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Get profile error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get profile"
        )


@router.delete("/{user_id}")
async def delete_user(user_id: str, request: Request):
    """
    Delete user account from both database and Supabase Auth
    Admin only - permanently removes all user data
    
    Deletes in order:
    1. Transactions (for user's investments)
    2. Activity events
    3. Withdrawals
    4. Bank accounts
    5. Investments
    6. User record
    7. Supabase Auth account
    """
    try:
        print(f"\n[DELETE /api/users/{user_id}] Starting deletion...")
        
        # Require admin authentication
        from utils.auth import require_admin
        current_user = require_admin(request)
        
        if not current_user.get('is_admin'):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required"
            )
        
        print(f"[DELETE /api/users/{user_id}] ✅ Admin authenticated: {current_user.get('id')}")
        
        from database import supabase
        
        # First, get the user to retrieve auth_id
        print(f"[DELETE /api/users/{user_id}] Fetching user from database...")
        user_response = supabase.table('users').select('auth_id, email').eq('id', user_id).maybe_single().execute()
        
        user = user_response.data if user_response.data else None
        
        if not user:
            print(f"[DELETE /api/users/{user_id}] ❌ User not found in database")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        print(f"[DELETE /api/users/{user_id}] ✅ Found user: {user.get('email')}, auth_id: {user.get('auth_id')}")
        
        # Delete related data first (due to foreign key constraints)
        # Get all investment IDs for this user
        investments_response = supabase.table('investments').select('id').eq('user_id', user_id).execute()
        investments = investments_response.data if investments_response.data else []
        investment_ids = [inv['id'] for inv in investments]
        
        print(f"[DELETE /api/users/{user_id}] Found {len(investment_ids)} investments to clean up")
        
        # Delete transactions for these investments
        if investment_ids:
            print(f"[DELETE /api/users/{user_id}] Deleting transactions...")
            supabase.table('transactions').delete().in_('investment_id', investment_ids).execute()
        
        # Delete activity for this user
        print(f"[DELETE /api/users/{user_id}] Deleting activity events...")
        supabase.table('activity').delete().eq('user_id', user_id).execute()
        
        # Delete withdrawals for this user
        print(f"[DELETE /api/users/{user_id}] Deleting withdrawals...")
        supabase.table('withdrawals').delete().eq('user_id', user_id).execute()
        
        # Delete bank accounts for this user
        print(f"[DELETE /api/users/{user_id}] Deleting bank accounts...")
        supabase.table('bank_accounts').delete().eq('user_id', user_id).execute()
        
        # Delete investments for this user
        if investment_ids:
            print(f"[DELETE /api/users/{user_id}] Deleting investments...")
            supabase.table('investments').delete().in_('id', investment_ids).execute()
        
        # Delete user from database
        print(f"[DELETE /api/users/{user_id}] Deleting user from database...")
        delete_response = supabase.table('users').delete().eq('id', user_id).execute()
        
        if not delete_response.data:
            print(f"[DELETE /api/users/{user_id}] ❌ Error deleting user from database")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete user from database"
            )
        
        print(f"[DELETE /api/users/{user_id}] ✅ Deleted from database")
        
        # Delete from Supabase Auth (if auth_id exists)
        auth_deletion_failed = False
        auth_error_message = None
        
        if user.get('auth_id'):
            print(f"[DELETE /api/users/{user_id}] Deleting from Supabase Auth ({user.get('auth_id')})...")
            try:
                auth_delete_response = supabase.auth.admin.delete_user(user.get('auth_id'))
                
                # Check if there was an error
                if hasattr(auth_delete_response, 'error') and auth_delete_response.error:
                    auth_deletion_failed = True
                    auth_error_message = str(auth_delete_response.error)
                    print(f"[DELETE /api/users/{user_id}] ❌ Failed to delete auth user: {auth_error_message}")
                else:
                    print(f"[DELETE /api/users/{user_id}] ✅ Deleted from Supabase Auth")
                    
            except Exception as auth_error:
                auth_deletion_failed = True
                auth_error_message = str(auth_error)
                print(f"[DELETE /api/users/{user_id}] ❌ Exception deleting auth user: {auth_error_message}")
        else:
            print(f"[DELETE /api/users/{user_id}] ⚠️ No auth_id, skipping auth deletion")
        
        # Return appropriate response
        if auth_deletion_failed:
            # Partial success - database deleted but auth failed
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=207,  # 207 Multi-Status
                content={
                    "success": False,
                    "partialSuccess": True,
                    "error": f"User deleted from database but failed to delete from auth: {auth_error_message}",
                    "authDeletionFailed": True
                }
            )
        
        print(f"[DELETE /api/users/{user_id}] ✅ Successfully deleted user {user_id} ({user.get('email')}) from both database and auth")
        
        return {
            "success": True,
            "message": "User deleted successfully from both database and authentication"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Delete user error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete user: {str(e)}"
        )

