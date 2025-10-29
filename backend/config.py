"""
Configuration Management
Loads environment variables and provides application settings
"""

import os
from typing import List
from dotenv import load_dotenv

# Load .env file in development (not in production where Heroku provides env vars)
if os.getenv('ENVIRONMENT') != 'production':
    load_dotenv()

class Settings:
    """Application settings from environment variables"""
    
    # Supabase Configuration
    SUPABASE_URL: str = os.getenv('SUPABASE_URL', '')
    SUPABASE_SERVICE_KEY: str = os.getenv('SUPABASE_SERVICE_KEY', '')
    
    # CORS Configuration
    CORS_ORIGINS_STR: str = os.getenv('CORS_ORIGINS', 'http://localhost:3000')
    
    @property
    def CORS_ORIGINS(self) -> List[str]:
        """Parse CORS origins from comma-separated string"""
        return [origin.strip() for origin in self.CORS_ORIGINS_STR.split(',')]
    
    # Server Configuration
    PORT: int = int(os.getenv('PORT', '8000'))
    ENVIRONMENT: str = os.getenv('ENVIRONMENT', 'development')
    
    # JWT Configuration
    JWT_SECRET: str = os.getenv('JWT_SECRET', 'dev-secret-change-in-production')
    JWT_ALGORITHM: str = 'HS256'
    JWT_EXPIRATION_DAYS: int = 7
    
    # Email Configuration (optional)
    SENDGRID_API_KEY: str = os.getenv('SENDGRID_API_KEY', '')
    FROM_EMAIL: str = os.getenv('FROM_EMAIL', 'noreply@example.com')
    
    # Test Mode (no email verification required)
    TEST_MODE: bool = os.getenv('ENABLE_EMAIL_VERIFICATION', 'false').lower() != 'true'
    TEST_VERIFICATION_CODE: str = '000000'
    
    def validate(self):
        """Validate required settings"""
        if not self.SUPABASE_URL:
            raise ValueError('SUPABASE_URL environment variable is required')
        if not self.SUPABASE_SERVICE_KEY:
            raise ValueError('SUPABASE_SERVICE_KEY environment variable is required')
        if self.ENVIRONMENT == 'production' and self.JWT_SECRET == 'dev-secret-change-in-production':
            raise ValueError('JWT_SECRET must be changed in production')
        
        print(f"✓ Configuration loaded successfully")
        print(f"  Environment: {self.ENVIRONMENT}")
        print(f"  Supabase URL: {self.SUPABASE_URL}")
        print(f"  CORS Origins: {', '.join(self.CORS_ORIGINS)}")
        print(f"  Test Mode: {'Enabled' if self.TEST_MODE else 'Disabled'}")


# Global settings instance
settings = Settings()

# Validate on import (will raise error if misconfigured)
try:
    settings.validate()
except ValueError as e:
    print(f"❌ Configuration Error: {e}")
    print("   Please check your environment variables (.env file or Heroku config)")
    # Don't exit in production - let healthcheck fail instead
    if settings.ENVIRONMENT != 'production':
        import sys
        sys.exit(1)

