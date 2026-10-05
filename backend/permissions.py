from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import EmployeeProfile


def is_crm_admin(user):
	if user.is_superuser:
		return True
	try:
		return user.crm_profile.role == EmployeeProfile.Role.ADMIN
	except EmployeeProfile.DoesNotExist:
		return False


class IsCRMUser(BasePermission):
	message = "Доступ разрешён только активным сотрудникам CRM."

	def has_permission(self, request, view):
		user = request.user
		if not user or not user.is_authenticated or not user.is_active:
			return False
		return user.is_superuser or hasattr(user, "crm_profile")


class IsAdminOrReadOnly(BasePermission):
	message = "Изменять справочники может только администратор."

	def has_permission(self, request, view):
		return request.method in SAFE_METHODS or is_crm_admin(request.user)


class IsCRMAdminOnly(BasePermission):
	message = "Доступ разрешён только администратору CRM."

	def has_permission(self, request, view):
		return bool(
			request.user
			and request.user.is_authenticated
			and request.user.is_active
			and is_crm_admin(request.user)
		)