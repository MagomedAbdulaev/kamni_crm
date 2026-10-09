from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q
from django.utils import timezone


class EmployeeProfile(models.Model):
	class Role(models.TextChoices):
		ADMIN = "admin", "Администратор"
		MANAGER = "manager", "Менеджер"

	user = models.OneToOneField(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name="crm_profile",
	)
	role = models.CharField(max_length=20, choices=Role.choices, default=Role.MANAGER)

	class Meta:
		verbose_name = "Профиль сотрудника"
		verbose_name_plural = "Профили сотрудников"

	def __str__(self):
		return f"{self.user.get_full_name() or self.user.username} ({self.get_role_display()})"


class Client(models.Model):
	first_name = models.CharField("Имя", max_length=100)
	last_name = models.CharField("Фамилия", max_length=100, blank=True)
	phone = models.CharField("Телефон", max_length=32)
	is_regular = models.BooleanField("Постоянный клиент", default=False)
	comment = models.TextField("Комментарий", blank=True)
	created_at = models.DateTimeField("Создан", auto_now_add=True)
	updated_at = models.DateTimeField("Изменён", auto_now=True)

	class Meta:
		ordering = ("last_name", "first_name", "pk")
		verbose_name = "Клиент"
		verbose_name_plural = "Клиенты"

	def __str__(self):
		return " ".join(part for part in (self.first_name, self.last_name) if part)


class Material(models.Model):
	class Category(models.TextChoices):
		GRANITE = "granite", "Гранит"
		MARBLE = "marble", "Мрамор"
		QUARTZ = "quartz", "Кварц"
		QUARTZITE = "quartzite", "Кварцит"
		OTHER = "other", "Другой"

	category = models.CharField("Категория", max_length=20, choices=Category.choices)
	name = models.CharField("Название", max_length=120)
	thickness_mm = models.PositiveIntegerField("Толщина, мм", null=True, blank=True)
	is_active = models.BooleanField("Активен", default=True)
	created_at = models.DateTimeField("Создан", auto_now_add=True)

	class Meta:
		ordering = ("category", "name")
		constraints = [
			models.UniqueConstraint(fields=("category", "name"), name="unique_material_name_per_category")
		]
		verbose_name = "Материал"
		verbose_name_plural = "Материалы"

	def __str__(self):
		return f"{self.get_category_display()} — {self.name}"


class ProductType(models.Model):
	name = models.CharField("Название", max_length=100, unique=True)
	is_active = models.BooleanField("Активен", default=True)

	class Meta:
		ordering = ("name",)
		verbose_name = "Тип изделия"
		verbose_name_plural = "Типы изделий"

	def __str__(self):
		return self.name


class Order(models.Model):
	class Status(models.TextChoices):
		NEW = "new", "Новый"
		IN_PROGRESS = "in_progress", "В работе"
		READY = "ready", "Готов"
		ISSUED = "issued", "Выдан"
		CANCELLED = "cancelled", "Отменён"

	number = models.BigAutoField("Номер заказа", primary_key=True)
	client = models.ForeignKey(Client, on_delete=models.PROTECT, related_name="orders", verbose_name="Клиент")
	product_type = models.ForeignKey(
		ProductType, on_delete=models.PROTECT, related_name="orders", verbose_name="Тип изделия"
	)
	product_name = models.CharField("Название изделия", max_length=150, blank=True)
	material = models.ForeignKey(
		Material, on_delete=models.PROTECT, related_name="orders", verbose_name="Материал"
	)
	comment = models.TextField("Комментарий к заказу", blank=True)
	price = models.DecimalField(
		"Стоимость заказа", max_digits=12, decimal_places=2, default=Decimal("0.00"),
		validators=[MinValueValidator(Decimal("0.00"))],
	)
	status = models.CharField("Статус", max_length=20, choices=Status.choices, default=Status.NEW)
	due_date = models.DateField("Желаемый срок", null=True, blank=True)
	ready_at = models.DateTimeField("Дата готовности", null=True, blank=True)
	created_by = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.SET_NULL,
		related_name="created_orders",
		verbose_name="Создал",
		null=True,
		blank=True,
	)
	created_at = models.DateTimeField("Создан", auto_now_add=True)
	updated_at = models.DateTimeField("Изменён", auto_now=True)

	class Meta:
		ordering = ("-created_at", "-number")
		indexes = [
			models.Index(fields=("status", "due_date"), name="order_status_due_idx"),
			models.Index(fields=("client", "-created_at"), name="order_client_created_idx"),
		]
		verbose_name = "Заказ"
		verbose_name_plural = "Заказы"

	def __str__(self):
		return f"Заказ №{self.number}"

	@property
	def paid_amount(self):
		return self.payments.aggregate(total=models.Sum("amount"))["total"] or 0

	@property
	def balance(self):
		return self.price - self.paid_amount

	@property
	def is_overdue(self):
		return (
			self.due_date is not None
			and self.due_date < timezone.localdate()
			and self.status not in (self.Status.READY, self.Status.ISSUED, self.Status.CANCELLED)
		)


class Payment(models.Model):
	class Method(models.TextChoices):
		CASH = "cash", "Наличные"
		TRANSFER = "transfer", "Перевод"
		CARD = "card", "Карта"
		OTHER = "other", "Другое"

	order = models.ForeignKey(Order, on_delete=models.PROTECT, related_name="payments", verbose_name="Заказ")
	amount = models.DecimalField(
		"Сумма", max_digits=12, decimal_places=2, validators=[MinValueValidator(0.01)]
	)
	paid_at = models.DateTimeField("Дата оплаты", default=timezone.now)
	method = models.CharField("Способ оплаты", max_length=20, choices=Method.choices, default=Method.CASH)
	comment = models.TextField("Комментарий", blank=True)
	created_by = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.SET_NULL,
		related_name="recorded_payments",
		verbose_name="Принял оплату",
		null=True,
		blank=True,
	)
	created_at = models.DateTimeField("Запись создана", auto_now_add=True)

	class Meta:
		ordering = ("-paid_at", "-pk")
		constraints = [models.CheckConstraint(condition=Q(amount__gt=0), name="payment_amount_positive")]
		verbose_name = "Оплата"
		verbose_name_plural = "Оплаты"

	def __str__(self):
		return f"Оплата {self.amount} по заказу №{self.order_id}"


class Attachment(models.Model):
	order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="attachments", verbose_name="Заказ")
	file = models.FileField("Файл", upload_to="order_attachments/%Y/%m/")
	original_name = models.CharField("Имя файла", max_length=255, blank=True)
	uploaded_by = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.SET_NULL,
		related_name="uploaded_order_attachments",
		null=True,
		blank=True,
	)
	uploaded_at = models.DateTimeField("Загружен", auto_now_add=True)

	class Meta:
		ordering = ("-uploaded_at",)
		verbose_name = "Вложение заказа"
		verbose_name_plural = "Вложения заказов"

	def __str__(self):
		return self.original_name or self.file.name


class Comment(models.Model):
	order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="comments", verbose_name="Заказ")
	author = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.SET_NULL,
		related_name="order_comments",
		null=True,
		blank=True,
	)
	text = models.TextField("Текст")
	created_at = models.DateTimeField("Создан", auto_now_add=True)
	updated_at = models.DateTimeField("Изменён", auto_now=True)

	class Meta:
		ordering = ("created_at", "pk")
		verbose_name = "Комментарий к заказу"
		verbose_name_plural = "Комментарии к заказам"

	def __str__(self):
		return f"Комментарий к заказу №{self.order_id}"


class StatusHistory(models.Model):
	order = models.ForeignKey(Order, on_delete=models.PROTECT, related_name="status_history", verbose_name="Заказ")
	old_status = models.CharField("Предыдущий статус", max_length=20, choices=Order.Status.choices, blank=True)
	new_status = models.CharField("Новый статус", max_length=20, choices=Order.Status.choices)
	changed_by = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.SET_NULL,
		related_name="order_status_changes",
		null=True,
		blank=True,
	)
	changed_at = models.DateTimeField("Дата изменения", auto_now_add=True)
	comment = models.TextField("Комментарий", blank=True)

	class Meta:
		ordering = ("changed_at", "pk")
		verbose_name = "Изменение статуса"
		verbose_name_plural = "История статусов"

	def __str__(self):
		return f"Заказ №{self.order_id}: {self.old_status or '—'} → {self.new_status}"


class AuditLog(models.Model):
	actor = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.SET_NULL,
		related_name="crm_audit_events",
		null=True,
		blank=True,
		verbose_name="Пользователь",
	)
	order = models.ForeignKey(
		Order, on_delete=models.SET_NULL, related_name="audit_events", null=True, blank=True
	)
	client = models.ForeignKey(
		Client, on_delete=models.SET_NULL, related_name="audit_events", null=True, blank=True
	)
	action = models.CharField("Действие", max_length=100)
	description = models.TextField("Описание", blank=True)
	created_at = models.DateTimeField("Дата", auto_now_add=True)

	class Meta:
		ordering = ("-created_at", "-pk")
		indexes = [models.Index(fields=("-created_at",), name="audit_created_idx")]
		verbose_name = "Запись аудита"
		verbose_name_plural = "Журнал аудита"

	def __str__(self):
		return self.description or self.action


class CRMNotification(models.Model):
	recipient = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name="crm_notifications",
		verbose_name="Получатель",
	)
	order = models.ForeignKey(
		Order, on_delete=models.CASCADE, related_name="notifications", null=True, blank=True
	)
	message = models.CharField("Уведомление", max_length=255)
	created_at = models.DateTimeField("Создано", auto_now_add=True)
	read_at = models.DateTimeField("Прочитано", null=True, blank=True)

	class Meta:
		ordering = ("-created_at", "-pk")
		verbose_name = "Уведомление"
		verbose_name_plural = "Уведомления"

	@property
	def is_read(self):
		return self.read_at is not None

	def __str__(self):
		return self.message


