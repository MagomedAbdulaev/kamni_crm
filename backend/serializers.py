from decimal import Decimal

from django.db import transaction
from rest_framework import serializers
from django.contrib.auth import get_user_model

from .models import (
	Attachment,
	AuditLog,
	Client,
	Comment,
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


class UserSerializer(serializers.ModelSerializer):
	role = serializers.SerializerMethodField()

	class Meta:
		model = User
		fields = ("id", "username", "first_name", "last_name", "email", "role")

	def get_role(self, user):
		if user.is_superuser:
			return EmployeeProfile.Role.ADMIN
		try:
			return user.crm_profile.role
		except EmployeeProfile.DoesNotExist:
			return None


class ManagerSerializer(serializers.ModelSerializer):
	role = serializers.CharField(source="crm_profile.role", read_only=True)
	password = serializers.CharField(write_only=True, required=False, min_length=8)

	class Meta:
		model = User
		fields = ("id", "username", "first_name", "last_name", "email", "role", "is_active", "password")
		read_only_fields = ("id", "role")

	def create(self, validated_data):
		password = validated_data.pop("password", None)
		if not password:
			raise serializers.ValidationError({"password": "Укажите пароль менеджера."})
		user = User.objects.create_user(password=password, **validated_data)
		EmployeeProfile.objects.create(user=user, role=EmployeeProfile.Role.MANAGER)
		return user

	def update(self, instance, validated_data):
		password = validated_data.pop("password", None)
		for field, value in validated_data.items():
			setattr(instance, field, value)
		if password:
			instance.set_password(password)
		instance.save()
		return instance


class AuditLogSerializer(serializers.ModelSerializer):
	class Meta:
		model = AuditLog
		fields = ("id", "actor", "order", "client", "action", "description", "created_at")
		read_only_fields = fields


class CRMNotificationSerializer(serializers.ModelSerializer):
	class Meta:
		model = CRMNotification
		fields = ("id", "order", "message", "created_at", "read_at", "is_read")
		read_only_fields = fields


class MaterialSerializer(serializers.ModelSerializer):
	class Meta:
		model = Material
		fields = ("id", "category", "name", "thickness_mm", "is_active")


class ProductTypeSerializer(serializers.ModelSerializer):
	class Meta:
		model = ProductType
		fields = ("id", "name", "is_active")


class ProcessingTypeSerializer(serializers.ModelSerializer):
	class Meta:
		model = ProcessingType
		fields = ("id", "name", "is_active")


class OrderHistoryItemSerializer(serializers.ModelSerializer):
	product_type_name = serializers.CharField(source="product_type.name", read_only=True)
	material_name = serializers.CharField(source="material.name", read_only=True)
	material_thickness_mm = serializers.IntegerField(source="material.thickness_mm", read_only=True, allow_null=True)

	class Meta:
		model = Order
		fields = ("number", "product_type_name", "product_name", "material_name", "status", "due_date", "created_at")


class ClientSerializer(serializers.ModelSerializer):
	order_count = serializers.SerializerMethodField()
	total_paid = serializers.SerializerMethodField()
	order_history = OrderHistoryItemSerializer(source="orders", many=True, read_only=True)

	class Meta:
		model = Client
		fields = (
			"id",
			"first_name",
			"last_name",
			"phone",
			"is_regular",
			"comment",
			"created_at",
			"updated_at",
			"order_count",
			"total_paid",
			"order_history",
		)
		read_only_fields = ("created_at", "updated_at")

	def get_order_count(self, client):
		return getattr(client, "_order_count", client.orders.count())

	def get_total_paid(self, client):
		return getattr(client, "_paid_amount", None) or 0

	def create(self, validated_data):
		client = super().create(validated_data)
		request = self.context.get("request")
		AuditLog.objects.create(
			actor=request.user if request and request.user.is_authenticated else None,
			client=client,
			action="client.created",
			description=f"Создан клиент: {client}",
		)
		return client

	def update(self, instance, validated_data):
		changed_fields = [
			field for field, value in validated_data.items() if getattr(instance, field) != value
		]
		client = super().update(instance, validated_data)
		if changed_fields:
			request = self.context.get("request")
			AuditLog.objects.create(
				actor=request.user if request and request.user.is_authenticated else None,
				client=client,
				action="client.updated",
				description=f"Изменены данные клиента {client}: {', '.join(changed_fields)}",
			)
		return client


class OrderProcessingSerializer(serializers.ModelSerializer):
	processing_type = serializers.PrimaryKeyRelatedField(queryset=ProcessingType.objects.all())
	processing_type_name = serializers.CharField(source="processing_type.name", read_only=True)

	class Meta:
		model = OrderProcessing
		fields = ("id", "processing_type", "processing_type_name", "parameters")
		read_only_fields = ("id",)


class PaymentSerializer(serializers.ModelSerializer):
	amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
	created_by_name = serializers.SerializerMethodField()
	method_display = serializers.CharField(source="get_method_display", read_only=True)

	class Meta:
		model = Payment
		fields = ("id", "order", "amount", "paid_at", "method", "method_display", "comment", "created_by", "created_by_name", "created_at")
		read_only_fields = ("id", "order", "created_by", "created_by_name", "created_at")

	def get_created_by_name(self, payment):
		if not payment.created_by:
			return None
		return payment.created_by.get_full_name() or payment.created_by.username


class AttachmentSerializer(serializers.ModelSerializer):
	class Meta:
		model = Attachment
		fields = ("id", "order", "file", "original_name", "uploaded_by", "uploaded_at")
		read_only_fields = ("id", "order", "uploaded_by", "uploaded_at")


class CommentSerializer(serializers.ModelSerializer):
	author_name = serializers.SerializerMethodField()

	class Meta:
		model = Comment
		fields = ("id", "order", "author", "author_name", "text", "created_at", "updated_at")
		read_only_fields = ("id", "order", "author", "author_name", "created_at", "updated_at")

	def get_author_name(self, comment):
		if not comment.author:
			return None
		return comment.author.get_full_name() or comment.author.username


class StatusHistorySerializer(serializers.ModelSerializer):
	changed_by_name = serializers.SerializerMethodField()

	class Meta:
		model = StatusHistory
		fields = ("id", "old_status", "new_status", "changed_by", "changed_by_name", "changed_at", "comment")
		read_only_fields = fields

	def get_changed_by_name(self, history):
		if not history.changed_by:
			return None
		return history.changed_by.get_full_name() or history.changed_by.username


class OrderSerializer(serializers.ModelSerializer):
	client_name = serializers.CharField(source="client.__str__", read_only=True)
	client_phone = serializers.CharField(source="client.phone", read_only=True)
	product_type_name = serializers.CharField(source="product_type.name", read_only=True)
	material_name = serializers.CharField(source="material.name", read_only=True)
	material_thickness_mm = serializers.IntegerField(source="material.thickness_mm", read_only=True, allow_null=True)
	processing_details = OrderProcessingSerializer(many=True, required=False)
	payments = PaymentSerializer(many=True, read_only=True)
	attachments = AttachmentSerializer(many=True, read_only=True)
	status_history = StatusHistorySerializer(many=True, read_only=True)
	paid_amount = serializers.SerializerMethodField()
	balance = serializers.SerializerMethodField()
	is_overdue = serializers.BooleanField(read_only=True)
	created_by = serializers.PrimaryKeyRelatedField(read_only=True)
	status = serializers.ChoiceField(choices=Order.Status.choices, read_only=True)

	class Meta:
		model = Order
		fields = (
			"number",
			"client",
			"client_name",
			"client_phone",
			"product_type",
			"product_type_name",
			"product_name",
			"material",
			"material_name",
			"material_thickness_mm",
			"processing_details",
			"comment",
			"price",
			"status",
			"due_date",
			"ready_at",
			"created_by",
			"created_at",
			"updated_at",
			"paid_amount",
			"balance",
			"is_overdue",
			"payments",
			"attachments",
			"status_history",
		)
		read_only_fields = ("number", "ready_at", "created_at", "updated_at")

	def get_paid_amount(self, order):
		return getattr(order, "_paid_amount", None) or 0

	def get_balance(self, order):
		return order.price - self.get_paid_amount(order)

	def _save_processing_details(self, order, details):
		if details is None:
			return
		order.processing_details.all().delete()
		OrderProcessing.objects.bulk_create(
			OrderProcessing(order=order, **detail) for detail in details
		)

	@transaction.atomic
	def create(self, validated_data):
		processing_details = validated_data.pop("processing_details", [])
		request = self.context.get("request")
		order = Order.objects.create(
			**validated_data,
			created_by=request.user if request and request.user.is_authenticated else None,
		)
		self._save_processing_details(order, processing_details)
		StatusHistory.objects.create(order=order, new_status=order.status, changed_by=order.created_by)
		AuditLog.objects.create(
			actor=order.created_by,
			order=order,
			action="order.created",
			description=f"Создан заказ №{order.number}",
		)
		return order

	@transaction.atomic
	def update(self, instance, validated_data):
		processing_details = validated_data.pop("processing_details", None)
		changed_fields = [
			field for field, value in validated_data.items() if getattr(instance, field) != value
		]
		order = super().update(instance, validated_data)
		self._save_processing_details(order, processing_details)
		if processing_details is not None:
			changed_fields.append("processing_details")
		if changed_fields:
			request = self.context.get("request")
			AuditLog.objects.create(
				actor=request.user if request and request.user.is_authenticated else None,
				order=order,
				action="order.updated",
				description=f"Изменён заказ №{order.number}: {', '.join(changed_fields)}",
			)
		return order
