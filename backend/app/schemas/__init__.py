"""Schemas Pydantic."""

from app.schemas.common import BaseResponse, PaginatedResponse, ErrorResponse
from app.schemas.auth import UserCreate, UserLogin, TokenResponse, UserResponse
from app.schemas.store import StoreCreate, StoreUpdate, StoreResponse
from app.schemas.product import ProductCreate, ProductUpdate, ProductResponse
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse
from app.schemas.order import OrderResponse, OrderDetailResponse
from app.schemas.customer import CustomerResponse
from app.schemas.ai import AIAgentCreate, AIAgentResponse, AIChannelCreate, AIChannelResponse
from app.schemas.onboarding import OnboardingStoreCreate, OnboardingStatusResponse
