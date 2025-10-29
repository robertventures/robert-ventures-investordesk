"""
Sequential ID Generator Service
Generates sequential IDs with prefixes (USR-xxxx, INV-xxxxx, TXN-xxxxxx)
"""

from database import supabase
import threading

# Thread lock for ID generation (thread-safe)
_id_lock = threading.Lock()

# ID counter table structure in Supabase:
# table: id_counters
# columns: id_type (text, primary key), current_value (integer)


def get_next_id(id_type: str, prefix: str, padding: int) -> str:
    """
    Get next sequential ID with prefix
    
    Args:
        id_type: Type of ID (e.g., 'user', 'investment', 'transaction')
        prefix: Prefix string (e.g., 'USR-', 'INV-', 'TXN-')
        padding: Number of digits to pad (e.g., 4 for USR-1001)
    
    Returns:
        Formatted ID string (e.g., 'USR-1001')
    """
    with _id_lock:
        try:
            # Get current counter value
            response = supabase.table('id_counters').select('current_value').eq(
                'id_type', id_type
            ).maybe_single().execute()
            
            if response.data:
                # Increment existing counter
                current_value = response.data['current_value']
                next_value = current_value + 1
                
                supabase.table('id_counters').update({
                    'current_value': next_value
                }).eq('id_type', id_type).execute()
            else:
                # Initialize counter (start at 1001 for users, 10001 for investments, etc.)
                if id_type == 'user':
                    next_value = 1001
                elif id_type == 'investment':
                    next_value = 10001
                elif id_type == 'transaction':
                    next_value = 100001
                elif id_type == 'withdrawal':
                    next_value = 10001
                else:
                    next_value = 1
                
                supabase.table('id_counters').insert({
                    'id_type': id_type,
                    'current_value': next_value
                }).execute()
            
            # Format with prefix and padding
            formatted_id = f"{prefix}{str(next_value).zfill(padding)}"
            return formatted_id
            
        except Exception as e:
            print(f"Error generating ID: {e}")
            # Fallback to timestamp-based ID if database fails
            import time
            timestamp = int(time.time() * 1000)
            return f"{prefix}{timestamp}"


def generate_user_id() -> str:
    """Generate sequential user ID (USR-1001, USR-1002, etc.)"""
    return get_next_id('user', 'USR-', 4)


def generate_investment_id() -> str:
    """Generate sequential investment ID (INV-10001, INV-10002, etc.)"""
    return get_next_id('investment', 'INV-', 5)


def generate_transaction_id() -> str:
    """Generate sequential transaction ID (TXN-100001, TXN-100002, etc.)"""
    return get_next_id('transaction', 'TXN-', 6)


def generate_withdrawal_id() -> str:
    """Generate sequential withdrawal ID (WD-10001, WD-10002, etc.)"""
    return get_next_id('withdrawal', 'WD-', 5)


def generate_activity_id() -> str:
    """Generate sequential activity ID (ACT-10001, ACT-10002, etc.)"""
    return get_next_id('activity', 'ACT-', 5)


# Initialize counters table if it doesn't exist (should be done via migration)
def initialize_counters_table():
    """
    Initialize id_counters table in Supabase
    Run this once during setup
    
    SQL to create table:
    CREATE TABLE IF NOT EXISTS id_counters (
        id_type TEXT PRIMARY KEY,
        current_value INTEGER NOT NULL DEFAULT 0
    );
    """
    try:
        # Check if table exists by trying to query it
        response = supabase.table('id_counters').select('id_type').limit(1).execute()
        print("✓ ID counters table exists")
    except Exception as e:
        print(f"❌ ID counters table might not exist: {e}")
        print("   Please create it with:")
        print("""
        CREATE TABLE IF NOT EXISTS id_counters (
            id_type TEXT PRIMARY KEY,
            current_value INTEGER NOT NULL DEFAULT 0
        );
        """)


# Check table on import
try:
    initialize_counters_table()
except:
    pass  # Fail silently on import

