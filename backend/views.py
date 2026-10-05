from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db.models import Count, Q, Sum
from django.db.models.deletion import ProtectedError
from django.db.models.functions import TruncMonth
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .models import (
	AuditLog,
	Client,
	CRMNotification,
	EmployeeProfile,
	Material,
	Order,
	Payment,
	ProcessingType,
	ProductType,
	StatusHistory,
)
from .permissions import IsAdminOrReadOnly, IsCRMAdminOnly, IsCRMUser
from .serializers import (
	AttachmentSerializer,
	AuditLogSerializer,
	ClientSerializer,
	CommentSerializer,
	CRMNotificationSerializer,
	ManagerSerializer,
	MaterialSerializer,
	OrderSerializer,
	PaymentSerializer,
	ProcessingTypeSerializer,
	ProductTypeSerializer,
	UserSerializer,
)


User = get_user_model()


class CRMTokenObtainPairSerializer(TokenObtainPairSerializer):
	@classmethod
	def get_token(cls, user):
		if not user.is_superuser:
			try:
				user.crm_profile
			except EmployeeProfile.DoesNotExist as error:
				from rest_framework.exceptions import AuthenticationFailed

				raise AuthenticationFailed("У пользователя нет профиля CRM.") from error
		return super().get_token(user)

	def validate(self, attrs):
		data = super().validate(attrs)
		data["user"] = UserSerializer(self.user).data
		return data


class LoginView(TokenObtainPairView):
	permission_classes = (AllowAny,)
	serializer_class = CRMTokenObtainPairSerializer


class LogoutView(APIView):
	permission_classes = (IsCRMUser,)

	def post(self, request):
		raw_token = request.data.get("refresh")
		if not raw_token:
			raise ValidationError({"refresh": "Передайте refresh-токен."})
		try:
			RefreshToken(raw_token).blacklist()
		except TokenError as error:
			raise ValidationError({"refresh": "Недействительный или истёкший токен."}) from error
		return Response(status=status.HTTP_205_RESET_CONTENT)


class CurrentUserView(APIView):
	permission_classes = (IsCRMUser,)

	def get(self, request):
		return Response(UserSerializer(request.user).data)


class ClientViewSet(viewsets.ModelViewSet):
	serializer_class = ClientSerializer
	permission_classes = (IsCRMUser,)
	filter_backends = (filters.SearchFilter, filters.OrderingFilter)
	search_fields = ("first_name", "last_name", "phone", "comment")
	ordering_fields = ("first_name", "last_name", "created_at")
	ordering = ("last_name", "first_name")

	def get_queryset(self):
		return Client.objects.annotate(
			_order_count=Count("orders", distinct=True),
			_paid_amount=Sum("orders__payments__amount"),
		).prefetch_related("orders__product_type", "orders__material")

	def destroy(self, request, *args, **kwargs):
		client = self.get_object()
		if client.orders.exists():
			return Response({"detail": "Клиента с заказами нельзя удалить."}, status=status.HTTP_409_CONFLICT)
		AuditLog.objects.create(
			actor=request.user,
			client=client,
			action="client.deleted",
			description=f"Удалён клиент: {client}",
		)
		client.delete()
		return Response(status=status.HTTP_204_NO_CONTENT)


class OrderViewSet(viewsets.ModelViewSet):
	serializer_class = OrderSerializer
	permission_classes = (IsCRMUser,)
	filter_backends = (filters.OrderingFilter,)
	ordering_fields = ("number", "created_at", "due_date", "status")
	ordering = ("-created_at", "-number")

	def get_queryset(self):
		queryset = (
			Order.objects.select_related("client", "product_type", "material", "created_by")
			.prefetch_related(
				"processing_details__processing_type",
				"payments__created_by",
				"attachments",
				"status_history__changed_by",
			)
			.annotate(_paid_amount=Sum("payments__amount"))
		)
		params = self.request.query_params
		for field in ("status", "material", "product_type", "client"):
			value = params.get(field)
			if value:
				queryset = queryset.filter(**{field: value})

		search = params.get("q") or params.get("search")
		if search:
			search_query = (
				Q(client__first_name__icontains=search)
				| Q(client__last_name__icontains=search)
				| Q(client__phone__icontains=search)
				| Q(product_name__icontains=search)
				| Q(material__name__icontains=search)
			)
			if search.isdigit():
				search_query |= Q(number=int(search))
			queryset = queryset.filter(search_query)

		for param, lookup in (("date_from", "created_at__date__gte"), ("date_to", "created_at__date__lte")):
			value = params.get(param)
			if value:
				date_value = parse_date(value)
				if not date_value:
					raise ValidationError({param: "Укажите дату в формате YYYY-MM-DD."})
				queryset = queryset.filter(**{lookup: date_value})

		period = params.get("period")
		today = timezone.localdate()
		if period == "today":
			queryset = queryset.filter(created_at__date=today)
		elif period == "week":
			queryset = queryset.filter(created_at__date__gte=today - timedelta(days=today.weekday()))
		elif period == "month":
			queryset = queryset.filter(created_at__date__gte=today.replace(day=1))
		if params.get("overdue", "").lower() in ("1", "true", "yes"):
			queryset = queryset.filter(due_date__lt=today, status__in=(Order.Status.NEW, Order.Status.IN_PROGRESS))
		return queryset

	@action(detail=True, methods=("patch",), url_path="status")
	def change_status(self, request, pk=None):
		order = self.get_object()
		new_status = request.data.get("status")
		if new_status not in Order.Status.values:
			raise ValidationError({"status": "Укажите один из допустимых статусов заказа."})
		old_status = order.status
		if old_status != new_status:
			order.status = new_status
			if new_status == Order.Status.READY and order.ready_at is None:
				order.ready_at = timezone.now()
			order.save(update_fields=("status", "ready_at", "updated_at"))
			StatusHistory.objects.create(
				order=order,
				old_status=old_status,
				new_status=new_status,
				changed_by=request.user,
				comment=request.data.get("comment", ""),
			)
			AuditLog.objects.create(
				actor=request.user,
				order=order,
				action="order.status_changed",
				description=f"Статус заказа №{order.number}: {order.get_status_display()}",
			)
			if new_status == Order.Status.READY:
				CRMNotification.objects.bulk_create(
					CRMNotification(recipient_id=employee.user_id, order=order, message=f"Заказ №{order.number} готов")
					for employee in EmployeeProfile.objects.filter(user__is_active=True).exclude(user=request.user)
				)
		return Response(self.get_serializer(order).data)

	@action(detail=True, methods=("get", "post"), url_path="payments")
	def payments(self, request, pk=None):
		order = self.get_object()
		if request.method == "GET":
			return Response(PaymentSerializer(order.payments.select_related("created_by"), many=True).data)
		serializer = PaymentSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)
		payment = serializer.save(order=order, created_by=request.user)
		AuditLog.objects.create(
			actor=request.user,
			order=order,
			action="payment.created",
			description=f"Получена оплата {payment.amount} по заказу №{order.number}",
		)
		return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)

	@action(
		detail=True,
		methods=("get", "post"),
		url_path="attachments",
		parser_classes=(MultiPartParser, FormParser),
	)
	def attachments(self, request, pk=None):
		order = self.get_object()
		if request.method == "GET":
			return Response(AttachmentSerializer(order.attachments.all(), many=True).data)
		serializer = AttachmentSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)
		uploaded_file = serializer.validated_data["file"]
		attachment = serializer.save(
			order=order,
			uploaded_by=request.user,
			original_name=serializer.validated_data.get("original_name") or uploaded_file.name,
		)
		AuditLog.objects.create(
			actor=request.user,
			order=order,
			action="attachment.created",
			description=f"К заказу №{order.number} прикреплён файл {attachment.original_name}",
		)
		return Response(AttachmentSerializer(attachment).data, status=status.HTTP_201_CREATED)

	@action(detail=True, methods=("get", "post"), url_path="comments")
	def comments(self, request, pk=None):
		order = self.get_object()
		if request.method == "GET":
			return Response(CommentSerializer(order.comments.select_related("author"), many=True).data)
		serializer = CommentSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)
		comment = serializer.save(order=order, author=request.user)
		AuditLog.objects.create(
			actor=request.user,
			order=order,
			action="comment.created",
			description=f"Добавлен комментарий к заказу №{order.number}",
		)
		return Response(CommentSerializer(comment).data, status=status.HTTP_201_CREATED)

	def destroy(self, request, *args, **kwargs):
		order = self.get_object()
		if order.status != Order.Status.CANCELLED:
			old_status = order.status
			order.status = Order.Status.CANCELLED
			order.save(update_fields=("status", "updated_at"))
			StatusHistory.objects.create(
				order=order,
				old_status=old_status,
				new_status=Order.Status.CANCELLED,
				changed_by=request.user,
			)
			AuditLog.objects.create(
				actor=request.user,
				order=order,
				action="order.cancelled",
				description=f"Заказ №{order.number} отменён",
			)
		return Response({"detail": "Заказ отменён.", "status": order.status})


class MaterialViewSet(viewsets.ModelViewSet):
	queryset = Material.objects.all()
	serializer_class = MaterialSerializer
	permission_classes = (IsCRMUser, IsAdminOrReadOnly)
	filter_backends = (filters.SearchFilter, filters.OrderingFilter)
	search_fields = ("name", "category")
	ordering_fields = ("name", "category")

	def destroy(self, request, *args, **kwargs):
		material = self.get_object()
		try:
			self.perform_destroy(material)
		except ProtectedError:
			return Response(
				{"detail": "Материал используется в заказах и не может быть удалён."},
				status=status.HTTP_409_CONFLICT,
			)
		return Response(status=status.HTTP_204_NO_CONTENT)


class ProductTypeViewSet(viewsets.ModelViewSet):
	queryset = ProductType.objects.all()
	serializer_class = ProductTypeSerializer
	permission_classes = (IsCRMUser, IsAdminOrReadOnly)
	filter_backends = (filters.SearchFilter,)
	search_fields = ("name",)


class ProcessingTypeViewSet(viewsets.ModelViewSet):
	queryset = ProcessingType.objects.all()
	serializer_class = ProcessingTypeSerializer
	permission_classes = (IsCRMUser, IsAdminOrReadOnly)
	filter_backends = (filters.SearchFilter,)
	search_fields = ("name",)


class ManagerViewSet(viewsets.ModelViewSet):
	serializer_class = ManagerSerializer
	permission_classes = (IsCRMUser, IsCRMAdminOnly)
	filter_backends = (filters.SearchFilter, filters.OrderingFilter)
	search_fields = ("username", "first_name", "last_name", "email")
	ordering_fields = ("username", "first_name", "last_name", "is_active")

	def get_queryset(self):
		return User.objects.filter(
			crm_profile__role=EmployeeProfile.Role.MANAGER,
			is_superuser=False,
		).select_related("crm_profile")

	def perform_create(self, serializer):
		manager = serializer.save()
		AuditLog.objects.create(
			actor=self.request.user,
			action="manager.created",
			description=f"Создан менеджер {manager.username}",
		)

	def perform_update(self, serializer):
		manager = serializer.save()
		AuditLog.objects.create(
			actor=self.request.user,
			action="manager.updated",
			description=f"Изменены данные менеджера {manager.username}",
		)

	def destroy(self, request, *args, **kwargs):
		manager = self.get_object()
		manager.is_active = False
		manager.save(update_fields=("is_active",))
		AuditLog.objects.create(
			actor=request.user,
			action="manager.blocked",
			description=f"Заблокирован менеджер {manager.username}",
		)
		return Response(ManagerSerializer(manager).data)


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
	serializer_class = AuditLogSerializer
	permission_classes = (IsCRMUser, IsCRMAdminOnly)
	filter_backends = (filters.SearchFilter, filters.OrderingFilter)
	search_fields = ("action", "description", "actor__username", "client__first_name")
	ordering_fields = ("created_at", "action")
	ordering = ("-created_at",)

	def get_queryset(self):
		return AuditLog.objects.select_related("actor", "order", "client")


class CRMNotificationViewSet(viewsets.ReadOnlyModelViewSet):
	serializer_class = CRMNotificationSerializer
	permission_classes = (IsCRMUser,)
	filter_backends = (filters.OrderingFilter,)
	ordering_fields = ("created_at", "read_at")
	ordering = ("-created_at",)

	def get_queryset(self):
		return CRMNotification.objects.filter(recipient=self.request.user).select_related("order")

	@action(detail=True, methods=("patch",), url_path="read")
	def mark_read(self, request, pk=None):
		notification = self.get_object()
		if notification.read_at is None:
			notification.read_at = timezone.now()
			notification.save(update_fields=("read_at",))
		return Response(self.get_serializer(notification).data)


class DashboardView(APIView):
	permission_classes = (IsCRMUser,)

	def get(self, request):
		today = timezone.localdate()
		orders = Order.objects.all()
		ready_orders = orders.filter(status=Order.Status.READY)
		overdue_orders = (
			orders.filter(
				due_date__lt=today,
				status__in=(Order.Status.NEW, Order.Status.IN_PROGRESS),
			)
			.select_related("client", "product_type", "material")
			.annotate(_paid_amount=Sum("payments__amount"))
		)
		ready = (
			ready_orders
			.select_related("client", "product_type", "material")
			.annotate(_paid_amount=Sum("payments__amount"))[:10]
		)
		month_orders = orders.filter(created_at__date__gte=today.replace(day=1)).exclude(
			status=Order.Status.CANCELLED
		)
		finance_rows = month_orders.annotate(_paid_total=Sum("payments__amount")).values(
			"price", "_paid_total"
		)
		finance_rows = list(finance_rows)
		order_total = sum((row["price"] for row in finance_rows), Decimal("0.00"))
		paid_total = sum(
			(row["_paid_total"] or Decimal("0.00") for row in finance_rows), Decimal("0.00")
		)
		chart_start = (today.replace(day=1) - timedelta(days=300)).replace(day=1)
		monthly_orders = (
			orders.filter(created_at__date__gte=chart_start)
			.annotate(month=TruncMonth("created_at"))
			.values("month")
			.annotate(total=Count("number"))
			.order_by("month")
		)
		return Response(
			{
				"total_orders": orders.count(),
				"new_orders": orders.filter(status=Order.Status.NEW).count(),
				"in_progress_orders": orders.filter(status=Order.Status.IN_PROGRESS).count(),
				"ready_orders": orders.filter(status=Order.Status.READY).count(),
				"overdue_orders": orders.filter(
					due_date__lt=today,
					status__in=(Order.Status.NEW, Order.Status.IN_PROGRESS),
				).count(),
				"ready_list": OrderSerializer(ready, many=True, context={"request": request}).data,
				"overdue_list": OrderSerializer(overdue_orders[:10], many=True, context={"request": request}).data,
				"monthly_orders": list(monthly_orders),
				"finance": {
					"month": today.month,
					"year": today.year,
					"orders_count": len(finance_rows),
					"order_total": order_total,
					"paid_total": paid_total,
					"debt_total": order_total - paid_total,
				},
			}
		)


class AnalyticsOrdersView(APIView):
	permission_classes = (IsCRMUser,)

	def get(self, request):
		orders = Order.objects.all()
		status_totals = {
			item["status"]: item["total"]
			for item in orders.values("status").annotate(total=Count("number"))
		}
		monthly = (
			orders.annotate(month=TruncMonth("created_at"))
			.values("month")
			.annotate(total=Count("number"))
			.order_by("month")
		)
		return Response(
			{
				"total": orders.count(),
				"by_status": status_totals,
				"by_month": list(monthly),
				"overdue": orders.filter(
					due_date__lt=timezone.localdate(),
					status__in=(Order.Status.NEW, Order.Status.IN_PROGRESS),
				).count(),
			}
		)


class AnalyticsRevenueView(APIView):
	permission_classes = (IsCRMUser,)

	def get(self, request):
		today = timezone.localdate()
		date_from = parse_date(request.query_params.get("date_from", ""))
		date_to = parse_date(request.query_params.get("date_to", ""))
		if not date_from and not date_to:
			date_from = today.replace(day=1)
			date_to = today
		elif not date_from:
			date_from = date_to.replace(day=1)
		elif not date_to:
			date_to = today
		if not date_from or not date_to:
			raise ValidationError({"date": "Укажите даты в формате YYYY-MM-DD."})
		if date_from > date_to:
			raise ValidationError({"date_to": "Конечная дата не может быть раньше начальной."})

		orders = (
			Order.objects.filter(created_at__date__gte=date_from, created_at__date__lte=date_to)
			.exclude(status=Order.Status.CANCELLED)
			.select_related("client", "product_type", "material", "created_by")
			.prefetch_related("processing_details__processing_type", "payments__created_by", "attachments", "status_history__changed_by")
		)
		order_financials = list(orders.annotate(_paid_amount=Sum("payments__amount")).values("price", "_paid_amount"))
		order_total = sum((row["price"] for row in order_financials), Decimal("0.00"))
		paid_on_orders = sum(
			(row["_paid_amount"] or Decimal("0.00") for row in order_financials), Decimal("0.00")
		)

		payments = Payment.objects.filter(paid_at__date__gte=date_from, paid_at__date__lte=date_to)
		monthly = (
			payments.annotate(month=TruncMonth("paid_at"))
			.values("month")
			.annotate(received=Sum("amount"))
			.order_by("month")
		)
		by_method = payments.values("method").annotate(total=Sum("amount")).order_by("method")
		return Response(
			{
				"period": {"date_from": date_from, "date_to": date_to},
				"summary": {
					"orders_count": len(order_financials),
					"order_total": order_total,
					"paid_on_orders": paid_on_orders,
					"debt_total": order_total - paid_on_orders,
					"received_in_period": payments.aggregate(total=Sum("amount"))["total"] or Decimal("0.00"),
				},
				"by_month": list(monthly),
				"by_method": list(by_method),
				"orders": OrderSerializer(orders.order_by("-created_at", "-number")[:50], many=True, context={"request": request}).data,
			}
		)


class AnalyticsMaterialsView(APIView):
	permission_classes = (IsCRMUser,)

	def get(self, request):
		materials = Material.objects.annotate(order_count=Count("orders")).values(
			"id", "category", "name", "order_count"
		).order_by("-order_count", "name")
		return Response(list(materials))