import json
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client as DjangoClient, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from tempfile import TemporaryDirectory

from .models import (
	AuditLog,
	Client,
	CRMNotification,
	EmployeeProfile,
	Material,
	Order,
	OrderProcessing,
	Payment,
	ProcessingType,
	ProductType,
	StatusHistory,
)


User = get_user_model()


class CRMApiTests(APITestCase):
	def setUp(self):
		self.user = User.objects.create_user(username="manager", password="test-password-123")
		EmployeeProfile.objects.create(user=self.user, role=EmployeeProfile.Role.MANAGER)
		self.client_record = Client.objects.create(first_name="Рашид", phone="+79991234567")
		self.product_type = ProductType.objects.create(name="Подоконник")
		self.material = Material.objects.create(category=Material.Category.MARBLE, name="Carrara")
		self.processing_type = ProcessingType.objects.create(name="Фаска")

	def authenticate(self):
		response = self.client.post(
			"/api/auth/login/",
			{"username": "manager", "password": "test-password-123"},
			format="json",
		)
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
		return response.data

	def create_order(self):
		return self.client.post(
			"/api/orders/",
			{
				"client": self.client_record.pk,
				"product_type": self.product_type.pk,
				"product_name": "Подоконник в кухню",
				"material": self.material.pk,
				"price": "25000.00",
				"comment": "Фаска по лицевой стороне",
				"processing_details": [
					{"processing_type": self.processing_type.pk, "parameters": {"size_mm": 2}}
				],
			},
			format="json",
		)

	def test_manager_jwt_and_order_workflow(self):
		tokens = self.authenticate()
		self.assertEqual(self.client.get("/api/auth/me/").data["role"], EmployeeProfile.Role.MANAGER)

		created = self.create_order()
		self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.data)
		order_number = created.data["number"]
		self.assertEqual(created.data["client_name"], "Рашид")
		self.assertEqual(created.data["price"], "25000.00")
		self.assertEqual(created.data["balance"], Decimal("25000.00"))
		self.assertEqual(len(created.data["processing_details"]), 1)
		self.assertTrue(Order.objects.filter(pk=order_number).exists())
		self.assertTrue(OrderProcessing.objects.filter(order_id=order_number).exists())

		updated = self.client.patch(
			f"/api/orders/{order_number}/",
			{
				"price": "30000.00",
				"product_name": "Подоконник в гостиную",
				"processing_details": [
					{"processing_type": self.processing_type.pk, "parameters": {"size_mm": 3}}
				],
			},
			format="json",
		)
		self.assertEqual(updated.status_code, status.HTTP_200_OK, updated.data)
		self.assertEqual(updated.data["price"], "30000.00")
		self.assertEqual(
			OrderProcessing.objects.get(order_id=order_number).parameters["size_mm"], 3
		)
		self.assertTrue(AuditLog.objects.filter(order_id=order_number, action="order.updated").exists())

		status_response = self.client.patch(
			f"/api/orders/{order_number}/status/",
			{"status": Order.Status.READY, "comment": "Изделие изготовлено"},
			format="json",
		)
		self.assertEqual(status_response.status_code, status.HTTP_200_OK, status_response.data)
		self.assertEqual(StatusHistory.objects.filter(order_id=order_number).count(), 2)
		self.assertTrue(AuditLog.objects.filter(order_id=order_number, action="order.status_changed").exists())

		payment_response = self.client.post(
			f"/api/orders/{order_number}/payments/",
			{"amount": "1000.00", "method": Payment.Method.CASH},
			format="json",
		)
		self.assertEqual(payment_response.status_code, status.HTTP_201_CREATED, payment_response.data)
		self.assertEqual(Payment.objects.filter(order_id=order_number).count(), 1)
		order_response = self.client.get(f"/api/orders/{order_number}/")
		self.assertEqual(order_response.data["paid_amount"], Decimal("1000.00"))
		self.assertEqual(order_response.data["balance"], Decimal("29000.00"))

		comment_response = self.client.post(
			f"/api/orders/{order_number}/comments/",
			{"text": "Клиент подтвердил размеры"},
			format="json",
		)
		self.assertEqual(comment_response.status_code, status.HTTP_201_CREATED, comment_response.data)
		self.assertEqual(self.client.get(f"/api/orders/?q={order_number}").status_code, status.HTTP_200_OK)

		dashboard = self.client.get("/api/dashboard/")
		self.assertEqual(dashboard.status_code, status.HTTP_200_OK, dashboard.data)
		self.assertEqual(dashboard.data["ready_orders"], 1)
		self.assertEqual(dashboard.data["finance"]["order_total"], Decimal("30000.00"))
		self.assertEqual(dashboard.data["finance"]["paid_total"], Decimal("1000.00"))
		self.assertEqual(dashboard.data["finance"]["debt_total"], Decimal("29000.00"))
		self.assertTrue(dashboard.data["monthly_orders"])
		for endpoint in ("orders", "revenue", "materials"):
			response = self.client.get(f"/api/analytics/{endpoint}/")
			self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
		revenue_response = self.client.get("/api/analytics/revenue/")
		self.assertEqual(revenue_response.data["summary"]["order_total"], Decimal("30000.00"))
		self.assertEqual(revenue_response.data["summary"]["paid_on_orders"], Decimal("1000.00"))
		self.assertEqual(revenue_response.data["summary"]["debt_total"], Decimal("29000.00"))
		self.assertEqual(revenue_response.data["summary"]["received_in_period"], Decimal("1000.00"))
		today = timezone.localdate().isoformat()
		period_response = self.client.get(f"/api/analytics/revenue/?date_from={today}&date_to={today}")
		self.assertEqual(period_response.status_code, status.HTTP_200_OK, period_response.data)
		self.assertEqual(period_response.data["summary"]["orders_count"], 1)
		self.assertEqual(period_response.data["summary"]["order_total"], Decimal("30000.00"))

		cancel_response = self.client.delete(f"/api/orders/{order_number}/")
		self.assertEqual(cancel_response.status_code, status.HTTP_200_OK)
		self.assertTrue(Order.objects.filter(pk=order_number, status=Order.Status.CANCELLED).exists())
		self.assertEqual(StatusHistory.objects.filter(order_id=order_number).count(), 3)
		self.assertIn("refresh", tokens)

	def test_manager_can_read_but_not_edit_material_catalog(self):
		self.authenticate()
		self.assertEqual(self.client.get("/api/materials/").status_code, status.HTTP_200_OK)
		response = self.client.post(
			"/api/materials/",
			{"category": Material.Category.GRANITE, "name": "Black Galaxy"},
			format="json",
		)
		self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

	def test_admin_can_delete_unused_material_but_not_material_used_by_order(self):
		admin = User.objects.create_user(username="material-admin", password="material-admin-123")
		EmployeeProfile.objects.create(user=admin, role=EmployeeProfile.Role.ADMIN)
		login = self.client.post(
			"/api/auth/login/",
			{"username": "material-admin", "password": "material-admin-123"},
			format="json",
		)
		self.assertEqual(login.status_code, status.HTTP_200_OK)
		self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
		created = self.client.post(
			"/api/materials/",
			{"category": Material.Category.GRANITE, "name": "Unused sample", "thickness_mm": 20, "is_active": True},
			format="json",
		)
		self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.data)
		self.assertEqual(created.data["thickness_mm"], 20)
		updated = self.client.patch(
			f"/api/materials/{created.data['id']}/",
			{"name": "Edited sample", "thickness_mm": 30, "is_active": False},
			format="json",
		)
		self.assertEqual(updated.status_code, status.HTTP_200_OK, updated.data)
		self.assertEqual(updated.data["name"], "Edited sample")
		self.assertEqual(updated.data["thickness_mm"], 30)
		self.assertFalse(updated.data["is_active"])

		unused_response = self.client.delete(f"/api/materials/{created.data['id']}/")
		self.assertEqual(unused_response.status_code, status.HTTP_204_NO_CONTENT)
		self.assertFalse(Material.objects.filter(pk=created.data["id"]).exists())

		created_order = self.create_order()
		self.assertEqual(created_order.status_code, status.HTTP_201_CREATED, created_order.data)
		used_response = self.client.delete(f"/api/materials/{self.material.pk}/")
		self.assertEqual(used_response.status_code, status.HTTP_409_CONFLICT)
		self.assertTrue(Material.objects.filter(pk=self.material.pk).exists())

	def test_manager_can_create_client(self):
		self.authenticate()
		response = self.client.post(
			"/api/clients/",
			{
				"first_name": "Самира",
				"last_name": "Юсупова",
				"phone": "+7 999 123-45-67",
				"is_regular": True,
				"comment": "Новый клиент мастерской",
			},
			format="json",
		)
		self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
		self.assertEqual(response.data["first_name"], "Самира")
		self.assertTrue(response.data["is_regular"])
		self.assertTrue(
			AuditLog.objects.filter(client_id=response.data["id"], action="client.created").exists()
		)

	def test_clients_require_authentication(self):
		response = self.client.get("/api/clients/")
		self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

	def test_refresh_rotates_token_and_logout_blacklists_it(self):
		tokens = self.authenticate()
		refresh_response = self.client.post(
			"/api/auth/refresh/", {"refresh": tokens["refresh"]}, format="json"
		)
		self.assertEqual(refresh_response.status_code, status.HTTP_200_OK)
		rotated_refresh = refresh_response.data["refresh"]

		logout_response = self.client.post(
			"/api/auth/logout/", {"refresh": rotated_refresh}, format="json"
		)
		self.assertEqual(logout_response.status_code, status.HTTP_205_RESET_CONTENT)

		blacklisted_response = self.client.post(
			"/api/auth/refresh/", {"refresh": rotated_refresh}, format="json"
		)
		self.assertEqual(blacklisted_response.status_code, status.HTTP_401_UNAUTHORIZED)

	def test_manager_cannot_manage_users_or_read_audit(self):
		self.authenticate()
		self.assertEqual(self.client.get("/api/managers/").status_code, status.HTTP_403_FORBIDDEN)
		self.assertEqual(self.client.get("/api/audit/").status_code, status.HTTP_403_FORBIDDEN)

	def test_admin_can_create_and_block_manager(self):
		admin = User.objects.create_user(username="admin", password="admin-password-123")
		EmployeeProfile.objects.create(user=admin, role=EmployeeProfile.Role.ADMIN)
		login = self.client.post(
			"/api/auth/login/", {"username": "admin", "password": "admin-password-123"}, format="json"
		)
		self.assertEqual(login.status_code, status.HTTP_200_OK)
		self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

		created = self.client.post(
			"/api/managers/",
			{"username": "new-manager", "password": "manager-password-123", "first_name": "Али"},
			format="json",
		)
		self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.data)
		manager_id = created.data["id"]
		self.assertEqual(created.data["role"], EmployeeProfile.Role.MANAGER)
		self.assertEqual(self.client.get("/api/audit/").status_code, status.HTTP_200_OK)

		blocked = self.client.delete(f"/api/managers/{manager_id}/")
		self.assertEqual(blocked.status_code, status.HTTP_200_OK)
		self.assertFalse(User.objects.get(pk=manager_id).is_active)

	def test_notifications_are_private_and_can_be_marked_read(self):
		self.authenticate()
		other_user = User.objects.create_user(username="other", password="other-password-123")
		own_notification = CRMNotification.objects.create(recipient=self.user, message="Ваш заказ готов")
		CRMNotification.objects.create(recipient=other_user, message="Чужое уведомление")

		response = self.client.get("/api/notifications/")
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data["count"], 1)
		marked = self.client.patch(f"/api/notifications/{own_notification.pk}/read/")
		self.assertEqual(marked.status_code, status.HTTP_200_OK)
		self.assertTrue(marked.data["is_read"])

	def test_order_attachment_upload(self):
		self.authenticate()
		created = self.create_order()
		self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.data)
		order_number = created.data["number"]

		with TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root, MEDIA_URL="/media/"):
			response = self.client.post(
				f"/api/orders/{order_number}/attachments/",
				{"file": SimpleUploadedFile("sketch.pdf", b"test document", content_type="application/pdf")},
				format="multipart",
			)
			self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
			self.assertEqual(response.data["original_name"], "sketch.pdf")

	def test_vite_origin_can_login_and_pass_cors_preflight(self):
		browser = DjangoClient(enforce_csrf_checks=True)
		login_page = browser.get("/api-auth/login/?next=/")
		self.assertEqual(login_page.status_code, status.HTTP_200_OK)
		csrf_token = browser.cookies["csrftoken"].value

		login_response = browser.post(
			"/api-auth/login/?next=/",
			{"username": "manager", "password": "test-password-123"},
			HTTP_ORIGIN="http://localhost:5174",
			HTTP_X_CSRFTOKEN=csrf_token,
		)
		self.assertEqual(login_response.status_code, status.HTTP_302_FOUND)

		preflight = browser.options(
			"/api/dashboard/",
			HTTP_ORIGIN="http://localhost:5174",
			HTTP_ACCESS_CONTROL_REQUEST_METHOD="GET",
		)
		self.assertEqual(preflight.status_code, status.HTTP_200_OK)
		self.assertEqual(preflight["Access-Control-Allow-Origin"], "http://localhost:5174")
		self.assertEqual(preflight["Access-Control-Allow-Credentials"], "true")

	def test_session_authenticated_order_edit_requires_and_accepts_csrf_token(self):
		order = Order.objects.create(
			client=self.client_record,
			product_type=self.product_type,
			material=self.material,
			price=Decimal("25000.00"),
		)
		browser = DjangoClient(enforce_csrf_checks=True)
		login_page = browser.get("/api-auth/login/?next=/")
		self.assertEqual(login_page.status_code, status.HTTP_200_OK)
		csrf_token = browser.cookies["csrftoken"].value

		login = browser.post(
			"/api-auth/login/?next=/",
			{"username": "manager", "password": "test-password-123"},
			HTTP_ORIGIN="http://localhost:5174",
			HTTP_X_CSRFTOKEN=csrf_token,
		)
		self.assertEqual(login.status_code, status.HTTP_302_FOUND)
		csrf_token = browser.cookies["csrftoken"].value

		response = browser.patch(
			f"/api/orders/{order.pk}/",
			data=json.dumps({"price": "32000.00"}),
			content_type="application/json",
			HTTP_ORIGIN="http://localhost:5174",
			HTTP_X_CSRFTOKEN=csrf_token,
		)
		self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)
		order.refresh_from_db()
		self.assertEqual(order.price, Decimal("32000.00"))
