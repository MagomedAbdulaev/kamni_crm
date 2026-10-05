from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
	AnalyticsMaterialsView,
	AnalyticsOrdersView,
	AnalyticsRevenueView,
	ClientViewSet,
	CurrentUserView,
	DashboardView,
	LoginView,
	LogoutView,
	ManagerViewSet,
	MaterialViewSet,
	OrderViewSet,
	ProcessingTypeViewSet,
	ProductTypeViewSet,
	AuditLogViewSet,
	CRMNotificationViewSet,
)


router = DefaultRouter()
router.register("clients", ClientViewSet, basename="client")
router.register("orders", OrderViewSet, basename="order")
router.register("materials", MaterialViewSet, basename="material")
router.register("product-types", ProductTypeViewSet, basename="product-type")
router.register("processing-types", ProcessingTypeViewSet, basename="processing-type")
router.register("managers", ManagerViewSet, basename="manager")
router.register("audit", AuditLogViewSet, basename="audit")
router.register("notifications", CRMNotificationViewSet, basename="notification")

urlpatterns = [
	path("auth/login/", LoginView.as_view(), name="api-login"),
	path("auth/refresh/", TokenRefreshView.as_view(), name="api-token-refresh"),
	path("auth/logout/", LogoutView.as_view(), name="api-logout"),
	path("auth/me/", CurrentUserView.as_view(), name="api-me"),
	path("dashboard/", DashboardView.as_view(), name="api-dashboard"),
	path("analytics/orders/", AnalyticsOrdersView.as_view(), name="analytics-orders"),
	path("analytics/revenue/", AnalyticsRevenueView.as_view(), name="analytics-revenue"),
	path("analytics/materials/", AnalyticsMaterialsView.as_view(), name="analytics-materials"),
	path("", include(router.urls)),
]