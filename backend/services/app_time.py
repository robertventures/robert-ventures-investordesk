"""
App Time Service - Time Machine Functionality
Allows admin to override current time for testing and demos
"""

from datetime import datetime
from typing import Optional
from database import supabase, get_app_settings, update_app_settings


def get_current_app_time() -> str:
    """
    Get current app time (may be overridden by admin)
    Returns ISO timestamp string
    """
    try:
        settings = get_app_settings()
        
        # Check if time is overridden
        if settings and settings.get('override_time'):
            override_time = settings.get('override_time')
            print(f"⏰ Using overridden time: {override_time}")
            return override_time
        
        # Return real time
        return datetime.utcnow().isoformat() + 'Z'
        
    except Exception as e:
        print(f"Error getting app time: {e}")
        # Fallback to real time
        return datetime.utcnow().isoformat() + 'Z'


def set_app_time(timestamp: str) -> dict:
    """
    Set app time override (admin only)
    
    Args:
        timestamp: ISO timestamp string to set as current time
    
    Returns:
        Dict with success status and new app time
    """
    try:
        # Validate timestamp format
        datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        
        # Update settings
        result = update_app_settings({
            'override_time': timestamp
        })
        
        if result:
            print(f"✓ App time set to: {timestamp}")
            return {
                'success': True,
                'app_time': timestamp,
                'message': 'App time updated'
            }
        else:
            return {
                'success': False,
                'error': 'Failed to update app time'
            }
            
    except Exception as e:
        print(f"Error setting app time: {e}")
        return {
            'success': False,
            'error': str(e)
        }


def reset_app_time() -> dict:
    """
    Reset app time to real time (remove override)
    
    Returns:
        Dict with success status and current real time
    """
    try:
        # Clear override
        result = update_app_settings({
            'override_time': None
        })
        
        real_time = datetime.utcnow().isoformat() + 'Z'
        
        if result:
            print(f"✓ App time reset to real time: {real_time}")
            return {
                'success': True,
                'app_time': real_time,
                'message': 'App time reset to real time'
            }
        else:
            return {
                'success': False,
                'error': 'Failed to reset app time'
            }
            
    except Exception as e:
        print(f"Error resetting app time: {e}")
        return {
            'success': False,
            'error': str(e)
        }


def get_app_time_status() -> dict:
    """
    Get app time status (whether overridden and values)
    
    Returns:
        Dict with app time, is_overridden, and real_time
    """
    try:
        settings = get_app_settings()
        override_time = settings.get('override_time') if settings else None
        real_time = datetime.utcnow().isoformat() + 'Z'
        
        if override_time:
            return {
                'success': True,
                'app_time': override_time,
                'is_overridden': True,
                'real_time': real_time
            }
        else:
            return {
                'success': True,
                'app_time': real_time,
                'is_overridden': False,
                'real_time': real_time
            }
            
    except Exception as e:
        print(f"Error getting app time status: {e}")
        real_time = datetime.utcnow().isoformat() + 'Z'
        return {
            'success': True,
            'app_time': real_time,
            'is_overridden': False,
            'real_time': real_time
        }


# Convenience function for use in calculations
def now() -> str:
    """Get current app time as ISO string"""
    return get_current_app_time()

