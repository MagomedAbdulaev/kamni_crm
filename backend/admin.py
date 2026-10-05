from django.contrib import admin
from django.db.models import Count, Sum
from django.utils.html import format_html

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


admin.site.site_header = "StoneCRM | Камнеобрабатывающая мастерская"
admin.site.site_title = "StoneCRM"
admin.site.index_title = "Управление мастерской"


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
	list_display = ("first_name", "last_name", "phone", "is_regular", "order_count", "created_at")
	list_display_links = ("first_name", "last_name")
	list_filter = ("is_regular", "created_at")
	search_fields = ("first_name", "last_name", "phone", "comment")
	date_hierarchy = "created_at"
	ordering = ("last_name", "first_name")
	readonly_fields = ("created_at", "updated_at")
	list_per_page = 30

	fieldsets = (
		("Контактные данные", {"fields": (("first_name", "last_name"), "phone", "is_regular")}),
		("Дополнительно", {"fields": ("comment",)}),
		("Системная информация", {"fields": ("created_at", "updated_at"), "classes": ("collapse",)}),
	)

	def get_queryset(self, request):
		return super().get_queryset(request).annotate(_order_count=Count("orders"))

	@admin.display(description="Заказов", ordering="_order_count")
	def order_count(self, obj):
		return obj._order_count


class OrderProcessingInline(admin.TabularInline):
	model = OrderProcessing
	extra = 0


class PaymentInline(admin.TabularInline):
	model = Payment
	extra = 0
	fields = ("amount", "paid_at", "method", "comment", "created_by")
	readonly_fields = ("created_by",)


class AttachmentInline(admin.TabularInline):
	model = Attachment
	extra = 0
	fields = ("file", "original_name", "uploaded_by", "uploaded_at")
	readonly_fields = ("uploaded_at",)


class CommentInline(admin.TabularInline):
	model = Comment
	extra = 0
	fields = ("text", "author", "created_at", "updated_at")
	readonly_fields = ("created_at", "updated_at")


class StatusHistoryInline(admin.TabularInline):
	model = StatusHistory
	extra = 0
	fields = ("old_status", "new_status", "changed_by", "changed_at", "comment")
	readonly_fields = fields

	def has_add_permission(self, request, obj=None):
		return False

	def has_change_permission(self, request, obj=None):
		return False

	def has_delete_permission(self, request, obj=None):
		return False


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
	list_display = (
		"number",
		"client",
		"product_type",
		"product_name",
		"material",
		"status_badge",
		"due_date",
		"price",
		"paid_amount",
		"balance",
	)
	list_display_links = ("number", "client")
	list_filter = ("status", "material", "product_type", "due_date", "created_at")
	search_fields = (
		"=number",
		"client__first_name",
		"client__last_name",
		"client__phone",
		"product_name",
		"material__name",
	)
	date_hierarchy = "created_at"
	list_select_related = ("client", "product_type", "material", "created_by")
	list_per_page = 30
	readonly_fields = ("number", "created_at", "updated_at", "ready_at", "paid_amount", "balance", "is_overdue")
	inlines = (OrderProcessingInline, PaymentInline, AttachmentInline, CommentInline, StatusHistoryInline)

	fieldsets = (
		("Заказ", {"fields": ("number", "client", "status", "created_by")}),
		("Изделие", {"fields": ("product_type", "product_name", "material", "comment")}),
		("Сроки", {"fields": ("due_date", "ready_at", "is_overdue")}),
		("Оплата", {"fields": ("price", "paid_amount", "balance")}),
		("Системная информация", {"fields": ("created_at", "updated_at"), "classes": ("collapse",)}),
	)

	def get_queryset(self, request):
		return super().get_queryset(request).annotate(_paid_amount=Sum("payments__amount"))

	@admin.display(description="Оплачено", ordering="_paid_amount")
	def paid_amount(self, obj):
		return obj._paid_amount or 0

	@admin.display(description="Остаток")
	def balance(self, obj):
		return obj.price - (obj._paid_amount or 0)

	@admin.display(description="Статус", ordering="status")
	def status_badge(self, obj):
		colors = {
			Order.Status.NEW: ("#fff4cc", "#805b00"),
			Order.Status.IN_PROGRESS: ("#dceeff", "#14527a"),
			Order.Status.READY: ("#dff4e4", "#176b35"),
			Order.Status.ISSUED: ("#e8e8e8", "#444444"),
			Order.Status.CANCELLED: ("#fde2e2", "#8b2525"),
		}
		background, foreground = colors[obj.status]
		return format_html(
			'<span style="background:{};color:{};padding:3px 8px;border-radius:10px;font-weight:600">{}</span>',
			background,
			foreground,
			obj.get_status_display(),
		)

	@admin.display(boolean=True, description="Просрочен")
	def is_overdue(self, obj):
		return obj.is_overdue

	def has_delete_permission(self, request, obj=None):
		return False


@admin.register(Material)
class MaterialAdmin(admin.ModelAdmin):
	list_display = ("name", "category", "thickness_mm", "is_active", "created_at")
	list_filter = ("category", "is_active")
	search_fields = ("name",)
	ordering = ("category", "name")
	list_per_page = 30


@admin.register(ProductType)
class ProductTypeAdmin(admin.ModelAdmin):
	list_display = ("name", "is_active")
	list_filter = ("is_active",)
	search_fields = ("name",)
	ordering = ("name",)


@admin.register(ProcessingType)
class ProcessingTypeAdmin(admin.ModelAdmin):
	list_display = ("name", "is_active")
	list_filter = ("is_active",)
	search_fields = ("name",)
	ordering = ("name",)


@admin.register(EmployeeProfile)
class EmployeeProfileAdmin(admin.ModelAdmin):
	list_display = ("user", "role")
	list_filter = ("role",)
	search_fields = ("user__username", "user__first_name", "user__last_name", "user__email")
	list_select_related = ("user",)


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
	list_display = ("order", "amount", "paid_at", "method", "created_by")
	list_filter = ("method", "paid_at")
	search_fields = ("=order__number", "order__client__first_name", "order__client__last_name", "comment")
	date_hierarchy = "paid_at"
	list_select_related = ("order", "order__client", "created_by")
	readonly_fields = ("created_at",)


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
	list_display = ("created_at", "actor", "action", "order", "client", "description")
	list_filter = ("action", "created_at")
	search_fields = ("actor__username", "action", "description", "=order__number", "client__first_name")
	date_hierarchy = "created_at"
	list_select_related = ("actor", "order", "client")
	readonly_fields = ("actor", "order", "client", "action", "description", "created_at")

	def has_add_permission(self, request):
		return False

	def has_change_permission(self, request, obj=None):
		return False

	def has_delete_permission(self, request, obj=None):
		return False


@admin.register(CRMNotification)
class CRMNotificationAdmin(admin.ModelAdmin):
	list_display = ("message", "recipient", "order", "created_at", "read_at")
	list_filter = ("created_at", "read_at")
	search_fields = ("message", "recipient__username", "=order__number")
	date_hierarchy = "created_at"
	list_select_related = ("recipient", "order")
