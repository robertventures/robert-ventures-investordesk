"""
Database Layer - Supabase Connection
Connects to the same Supabase database as the Next.js application
"""

from supabase import create_client, Client
from config import settings

# Global Supabase client instance
_supabase_client: Client = None

def get_supabase() -> Client:
    """
    Get Supabase client instance
    Returns singleton client for connection pooling
    """
    global _supabase_client
    
    if _supabase_client is None:
        _supabase_client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_KEY
        )
        print("✓ Supabase client initialized")
    
    return _supabase_client


# Convenience function for direct access
supabase = get_supabase()


# Database helper functions

async def check_database_connection() -> bool:
    """
    Check if database connection is working
    Returns True if connected, False otherwise
    """
    try:
        # Try to query a table (users should exist)
        result = supabase.table('users').select('id').limit(1).execute()
        return True
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False


def get_user_by_id(user_id: str) -> dict:
    """Get user by ID with related data"""
    try:
        response = supabase.table('users').select(
            '*,'
            'investments(*),'
            'bank_accounts(*),'
            'withdrawals(*)'
        ).eq('id', user_id).maybe_single().execute()
        
        if response.data:
            user = response.data
            
            # Get transactions for each investment
            if user.get('investments'):
                for investment in user['investments']:
                    txn_response = supabase.table('transactions').select('*').eq(
                        'investment_id', investment['id']
                    ).order('date', desc=False).execute()
                    investment['transactions'] = txn_response.data or []
            
            # Get activity
            activity_response = supabase.table('activity').select('*').eq(
                'user_id', user_id
            ).order('date', desc=True).execute()
            user['activity'] = activity_response.data or []
            
            return user
        
        return None
    except Exception as e:
        print(f"Error getting user: {e}")
        return None


def get_user_by_email(email: str) -> dict:
    """Get user by email"""
    try:
        response = supabase.table('users').select('*').eq(
            'email', email
        ).maybe_single().execute()
        return response.data if response and response.data else None
    except Exception as e:
        print(f"Error getting user by email: {e}")
        return None


def create_user(user_data: dict) -> dict:
    """Create new user"""
    try:
        # Whitelist columns to avoid PostgREST schema errors from unexpected keys
        allowed_columns = {
            'id', 'auth_id', 'email', 'first_name', 'last_name', 'phone_number', 'dob', 'ssn',
            'is_verified', 'verified_at', 'is_admin', 'account_type', 'created_at', 'updated_at',
            'needs_onboarding', 'onboarding_token', 'onboarding_token_expires', 'onboarding_completed_at',
            'joint_holder', 'joint_holding_type', 'entity', 'entity_name', 'authorized_representative',
            'banking', 'tax_info', 'address'
        }
        filtered = {k: v for k, v in (user_data or {}).items() if k in allowed_columns}
        response = supabase.table('users').insert(filtered).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"Error creating user: {e}")
        return None


def update_user(user_id: str, updates: dict) -> dict:
    """Update user"""
    try:
        response = supabase.table('users').update(updates).eq(
            'id', user_id
        ).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"Error updating user: {e}")
        return None


def get_investments_by_user(user_id: str) -> list:
    """Get all investments for a user"""
    try:
        response = supabase.table('investments').select('*').eq(
            'user_id', user_id
        ).order('created_at', desc=True).execute()
        return response.data or []
    except Exception as e:
        print(f"Error getting investments: {e}")
        return []


def create_investment(investment_data: dict) -> dict:
    """Create new investment"""
    try:
        response = supabase.table('investments').insert(investment_data).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"Error creating investment: {e}")
        return None


def update_investment(investment_id: str, updates: dict) -> dict:
    """Update investment"""
    try:
        # Convert camelCase to snake_case for database columns
        field_mapping = {
            'paymentMethod': 'payment_method',
            'paymentFrequency': 'payment_frequency',
            'lockupPeriod': 'lockup_period',
            'accountType': 'account_type',
            'submittedAt': 'submitted_at',
            'confirmedAt': 'confirmed_at',
            'signedAt': 'signed_at',
            'lockupEndDate': 'lockup_end_date',
            'createdAt': 'created_at',
            'updatedAt': 'updated_at',
            'requiresManualApproval': 'requires_manual_approval'
        }
        
        # Convert field names
        db_updates = {}
        for key, value in updates.items():
            db_key = field_mapping.get(key, key)
            db_updates[db_key] = value
        
        response = supabase.table('investments').update(db_updates).eq(
            'id', investment_id
        ).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"Error updating investment: {e}")
        return None


def delete_investment(investment_id: str) -> bool:
    """Delete investment (draft only)"""
    try:
        supabase.table('investments').delete().eq('id', investment_id).execute()
        return True
    except Exception as e:
        print(f"Error deleting investment: {e}")
        return False


def get_transactions_by_user(user_id: str, investment_id: str = None) -> list:
    """Get transactions for a user, optionally filtered by investment"""
    try:
        query = supabase.table('transactions').select('*').eq('user_id', user_id)
        
        if investment_id:
            query = query.eq('investment_id', investment_id)
        
        response = query.order('date', desc=True).execute()
        return response.data or []
    except Exception as e:
        print(f"Error getting transactions: {e}")
        return []


def create_transaction(transaction_data: dict) -> dict:
    """Create new transaction"""
    try:
        response = supabase.table('transactions').insert(transaction_data).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"Error creating transaction: {e}")
        return None


def get_withdrawals_by_user(user_id: str) -> list:
    """Get withdrawals for a user"""
    try:
        response = supabase.table('withdrawals').select('*').eq(
            'user_id', user_id
        ).order('requested_at', desc=True).execute()
        return response.data or []
    except Exception as e:
        print(f"Error getting withdrawals: {e}")
        return []


def create_withdrawal(withdrawal_data: dict) -> dict:
    """Create new withdrawal"""
    try:
        response = supabase.table('withdrawals').insert(withdrawal_data).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"Error creating withdrawal: {e}")
        return None


def get_pending_user(email: str) -> dict:
    """Get pending user by email"""
    try:
        response = supabase.table('pending_users').select('*').eq(
            'email', email
        ).maybe_single().execute()
        return response.data if response and response.data else None
    except Exception as e:
        print(f"Error getting pending user: {e}")
        return None


def create_pending_user(pending_data: dict) -> dict:
    """Create pending user"""
    try:
        response = supabase.table('pending_users').insert(pending_data).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"Error creating pending user: {e}")
        return None


def delete_pending_user(email: str) -> bool:
    """Delete pending user"""
    try:
        supabase.table('pending_users').delete().eq('email', email).execute()
        return True
    except Exception as e:
        print(f"Error deleting pending user: {e}")
        return False


def get_bank_accounts_by_user(user_id: str) -> list:
    """Get all bank accounts for a user"""
    try:
        response = supabase.table('bank_accounts').select('*').eq(
            'user_id', user_id
        ).order('created_at', desc=True).execute()
        return response.data or []
    except Exception as e:
        print(f"Error getting bank accounts: {e}")
        return []


def create_bank_account(bank_data: dict) -> dict:
    """Create new bank account"""
    try:
        response = supabase.table('bank_accounts').insert(bank_data).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"Error creating bank account: {e}")
        return None


def update_bank_account(account_id: str, updates: dict) -> dict:
    """Update bank account"""
    try:
        response = supabase.table('bank_accounts').update(updates).eq(
            'id', account_id
        ).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"Error updating bank account: {e}")
        return None


def create_activity(activity_data: dict) -> dict:
    """Create activity log entry"""
    try:
        from services.id_generator import generate_activity_id
        
        # Generate activity ID if not provided
        if 'id' not in activity_data:
            activity_data['id'] = generate_activity_id()
        
        response = supabase.table('activity').insert(activity_data).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"Error creating activity: {e}")
        return None


def get_app_settings() -> dict:
    """Get app settings (including time machine)"""
    try:
        response = supabase.table('app_settings').select('*').limit(1).maybe_single().execute()
        return response.data or {}
    except Exception as e:
        print(f"Error getting app settings: {e}")
        return {}


def update_app_settings(settings_data: dict) -> dict:
    """Update app settings"""
    try:
        # Check if settings exist
        existing = get_app_settings()
        
        if existing and existing.get('id'):
            # Update existing
            response = supabase.table('app_settings').update(settings_data).eq(
                'id', existing['id']
            ).execute()
        else:
            # Create new
            response = supabase.table('app_settings').insert(settings_data).execute()
        
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"Error updating app settings: {e}")
        return None

