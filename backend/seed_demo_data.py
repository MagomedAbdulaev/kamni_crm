from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from .models import (
	AuditLog,
	Client,
	Comment,
	CRMNotification,
	Material,
	Order,
	OrderProcessing,
	Payment,
	ProcessingType,
	ProductType,
	StatusHistory,
)


@transaction.atomic
def seed_demo_data():
	User = get_user_model()
	actor = User.objects.filter(is_superuser=True, is_active=True).order_by("pk").first()
	today = timezone.localdate()
	now = timezone.now()

	client_data = (
		("Рашид", "Магомедов", "+7 900 000-00-01", True),
		("Алина", "Мурзина", "+7 900 000-00-02", True),
		("Магомед", "Абдулаев", "+7 900 000-00-03", False),
		("Рустам", "Алиев", "+7 900 000-00-04", False),
		("Самира", "Юсупова", "+7 900 000-00-05", True),
		("Зарина", "Гаджиева", "+7 900 000-00-06", True),
		("Ибрагим", "Гаджиев", "+7 900 000-00-07", False),
		("Султан", "Кадыров", "+7 900 000-00-08", True),
		("Мадина", "Омарова", "+7 900 000-00-09", False),
		("Тимур", "Исмаилов", "+7 900 000-00-10", False),
		("Лейла", "Мусаева", "+7 900 000-00-11", True),
		("Адам", "Хасанов", "+7 900 000-00-12", False),
		("Диана", "Алиева", "+7 900 000-00-13", True),
	)
	clients = {}
	for first_name, last_name, phone, is_regular in client_data:
		client, _ = Client.objects.get_or_create(
			phone=phone,
			defaults={
				"first_name": first_name,
				"last_name": last_name,
				"is_regular": is_regular,
				"comment": "Тестовая запись StoneCRM",
			},
		)
		clients[phone] = client

	material_data = (
		(Material.Category.MARBLE, "Carrara"),
		(Material.Category.MARBLE, "Emperador"),
		(Material.Category.GRANITE, "Black Galaxy"),
		(Material.Category.GRANITE, "Tan Brown"),
		(Material.Category.QUARTZ, "Calacatta"),
		(Material.Category.QUARTZ, "Concrete Grey"),
		(Material.Category.QUARTZITE, "Taj Mahal"),
		(Material.Category.GRANITE, "G603"),
	)
	materials = {
		name: Material.objects.get_or_create(category=category, name=name)[0]
		for category, name in material_data
	}

	product_type_names = (
		"Подоконник",
		"Столешница",
		"Ступени",
		"Облицовка",
		"Барная стойка",
		"Лестница",
		"Тумба",
	)
	product_types = {
		name: ProductType.objects.get_or_create(name=name)[0] for name in product_type_names
	}
	processing_names = ("Прямой рез", "Фаска", "Полировка", "Вырез под мойку", "Капельник", "Отверстие")
	processing_types = {
		name: ProcessingType.objects.get_or_create(name=name)[0] for name in processing_names
	}

	order_data = (
		{
			"phone": "+7 900 000-00-01",
			"product_name": "Подоконник в гостиную",
			"product_type": "Подоконник",
			"material": "Carrara",
			"status": Order.Status.NEW,
			"due_delta": 5,
			"created_days_ago": 8,
			"price": Decimal("25000.00"),
			"payments": ((Decimal("10000.00"), Payment.Method.TRANSFER, 7),),
			"processing": ("Прямой рез", "Полировка"),
			"comment": "Согласовать оттенок плиты перед запуском.",
		},
		{
			"phone": "+7 900 000-00-02",
			"product_name": "Столешница, кухня",
			"product_type": "Столешница",
			"material": "Black Galaxy",
			"status": Order.Status.IN_PROGRESS,
			"due_delta": -2,
			"created_days_ago": 21,
			"price": Decimal("75000.00"),
			"payments": ((Decimal("25000.00"), Payment.Method.CASH, 12),),
			"processing": ("Фаска", "Полировка", "Вырез под мойку"),
			"comment": "Срок прошёл: требуется связаться с клиентом по готовности.",
		},
		{
			"phone": "+7 900 000-00-03",
			"product_name": "Ступени на лестницу",
			"product_type": "Ступени",
			"material": "Emperador",
			"status": Order.Status.READY,
			"due_delta": 0,
			"created_days_ago": 5,
			"price": Decimal("135000.00"),
			"payments": ((Decimal("30000.00"), Payment.Method.TRANSFER, 14), (Decimal("20000.00"), Payment.Method.CARD, 5)),
			"processing": ("Фаска", "Полировка"),
			"comment": "Готово к выдаче клиенту.",
		},
		{
			"phone": "+7 900 000-00-04",
			"product_name": "Облицовка входной группы",
			"product_type": "Облицовка",
			"material": "Tan Brown",
			"status": Order.Status.ISSUED,
			"due_delta": -3,
			"created_days_ago": 46,
			"price": Decimal("90000.00"),
			"payments": ((Decimal("40000.00"), Payment.Method.CARD, 42),),
			"processing": ("Прямой рез", "Полировка"),
			"comment": "Заказ выдан клиенту.",
		},
		{
			"phone": "+7 900 000-00-05",
			"product_name": "Барная стойка, образец отмены",
			"product_type": "Барная стойка",
			"material": "Calacatta",
			"status": Order.Status.CANCELLED,
			"due_delta": 10,
			"created_days_ago": 63,
			"price": Decimal("70000.00"),
			"payments": (),
			"processing": ("Прямой рез",),
			"comment": "Демонстрационный отменённый заказ.",
		},
		{
			"phone": "+7 900 000-00-06",
			"product_name": "Подоконник из G603",
			"product_type": "Подоконник",
			"material": "G603",
			"status": Order.Status.NEW,
			"due_delta": 12,
			"created_days_ago": 32,
			"price": Decimal("34000.00"),
			"payments": (),
			"processing": ("Прямой рез", "Фаска"),
			"comment": "Новый заказ, ожидает передачи в производство.",
		},
		{
			"phone": "+7 900 000-00-07",
			"product_name": "Столешница для острова",
			"product_type": "Столешница",
			"material": "Taj Mahal",
			"status": Order.Status.IN_PROGRESS,
			"due_delta": -4,
			"created_days_ago": 38,
			"price": Decimal("120000.00"),
			"payments": ((Decimal("30000.00"), Payment.Method.CASH, 35), (Decimal("15000.00"), Payment.Method.CARD, 10)),
			"processing": ("Фаска", "Полировка", "Вырез под мойку"),
			"comment": "Просрочен. Внесена предоплата двумя платежами.",
		},
		{
			"phone": "+7 900 000-00-08",
			"product_name": "Лестница в загородный дом",
			"product_type": "Лестница",
			"material": "Tan Brown",
			"status": Order.Status.IN_PROGRESS,
			"due_delta": -1,
			"created_days_ago": 72,
			"price": Decimal("210000.00"),
			"payments": ((Decimal("70000.00"), Payment.Method.TRANSFER, 60),),
			"processing": ("Прямой рез", "Фаска", "Полировка"),
			"comment": "Ожидается финальная полировка марша.",
		},
		{
			"phone": "+7 900 000-00-09",
			"product_name": "Столешница и фартук",
			"product_type": "Столешница",
			"material": "Concrete Grey",
			"status": Order.Status.IN_PROGRESS,
			"due_delta": 9,
			"created_days_ago": 104,
			"price": Decimal("148000.00"),
			"payments": ((Decimal("50000.00"), Payment.Method.TRANSFER, 94),),
			"processing": ("Фаска", "Полировка", "Вырез под мойку", "Отверстие"),
			"comment": "Согласован дополнительный вырез под дозатор.",
		},
		{
			"phone": "+7 900 000-00-10",
			"product_name": "Каминный портал",
			"product_type": "Облицовка",
			"material": "Emperador",
			"status": Order.Status.READY,
			"due_delta": 1,
			"created_days_ago": 128,
			"price": Decimal("84000.00"),
			"payments": ((Decimal("84000.00"), Payment.Method.CARD, 12),),
			"processing": ("Прямой рез", "Фаска", "Полировка"),
			"comment": "Готово, оплачено полностью.",
		},
		{
			"phone": "+7 900 000-00-11",
			"product_name": "Островная барная стойка",
			"product_type": "Барная стойка",
			"material": "Calacatta",
			"status": Order.Status.READY,
			"due_delta": 2,
			"created_days_ago": 153,
			"price": Decimal("118000.00"),
			"payments": ((Decimal("40000.00"), Payment.Method.TRANSFER, 150), (Decimal("10000.00"), Payment.Method.CASH, 30)),
			"processing": ("Фаска", "Полировка"),
			"comment": "Готово к выдаче, остаётся частичная задолженность.",
		},
		{
			"phone": "+7 900 000-00-12",
			"product_name": "Тумба для ванной",
			"product_type": "Тумба",
			"material": "Carrara",
			"status": Order.Status.ISSUED,
			"due_delta": -7,
			"created_days_ago": 181,
			"price": Decimal("63000.00"),
			"payments": ((Decimal("63000.00"), Payment.Method.CASH, 176),),
			"processing": ("Прямой рез", "Фаска", "Полировка"),
			"comment": "Заказ выдан и оплачен полностью.",
		},
		{
			"phone": "+7 900 000-00-01",
			"product_name": "Комплект ступеней для крыльца",
			"product_type": "Ступени",
			"material": "Black Galaxy",
			"status": Order.Status.READY,
			"due_delta": 4,
			"created_days_ago": 213,
			"price": Decimal("54000.00"),
			"payments": ((Decimal("20000.00"), Payment.Method.TRANSFER, 200),),
			"processing": ("Прямой рез", "Капельник", "Полировка"),
			"comment": "Повторный заказ постоянного клиента.",
		},
		{
			"phone": "+7 900 000-00-13",
			"product_name": "Подоконники, второй этаж",
			"product_type": "Подоконник",
			"material": "Calacatta",
			"status": Order.Status.IN_PROGRESS,
			"due_delta": -6,
			"created_days_ago": 244,
			"price": Decimal("92000.00"),
			"payments": ((Decimal("25000.00"), Payment.Method.TRANSFER, 230),),
			"processing": ("Прямой рез", "Фаска", "Полировка"),
			"comment": "Просрочен, требуется уточнить новый срок.",
		},
		{
			"phone": "+7 900 000-00-06",
			"product_name": "Облицовка лестничной площадки",
			"product_type": "Облицовка",
			"material": "Taj Mahal",
			"status": Order.Status.CANCELLED,
			"due_delta": -11,
			"created_days_ago": 276,
			"price": Decimal("76000.00"),
			"payments": ((Decimal("10000.00"), Payment.Method.CASH, 270),),
			"processing": ("Прямой рез", "Фаска"),
			"comment": "Отменён по просьбе клиента после внесения аванса.",
		},
	)

	created_orders = 0
	for data in order_data:
		client = clients[data["phone"]]
		order, created = Order.objects.get_or_create(
			client=client,
			product_name=data["product_name"],
			defaults={
				"product_type": product_types[data["product_type"]],
				"material": materials[data["material"]],
				"status": data["status"],
				"price": data["price"],
				"due_date": today + timedelta(days=data["due_delta"]),
				"ready_at": now - timedelta(days=1)
				if data["status"] in (Order.Status.READY, Order.Status.ISSUED)
				else None,
				"comment": data["comment"],
				"created_by": actor,
			},
		)
		if not created:
			if order.price == 0:
				order.price = data["price"]
				order.save(update_fields=("price", "updated_at"))
			continue
		created_orders += 1
		Order.objects.filter(pk=order.pk).update(
			created_at=now - timedelta(days=data["created_days_ago"])
		)

		for processing_name in data["processing"]:
			OrderProcessing.objects.get_or_create(
				order=order,
				processing_type=processing_types[processing_name],
				defaults={"parameters": {"note": "Демо-параметры обработки"}},
			)

		status_path = {
			Order.Status.NEW: ("new",),
			Order.Status.IN_PROGRESS: ("new", "in_progress"),
			Order.Status.READY: ("new", "in_progress", "ready"),
			Order.Status.ISSUED: ("new", "in_progress", "ready", "issued"),
			Order.Status.CANCELLED: ("new", "cancelled"),
		}[order.status]
		previous_status = ""
		for current_status in status_path:
			StatusHistory.objects.get_or_create(
				order=order,
				old_status=previous_status,
				new_status=current_status,
				defaults={"changed_by": actor},
			)
			previous_status = current_status

		Comment.objects.get_or_create(
			order=order,
			text=data["comment"],
			defaults={"author": actor},
		)
		AuditLog.objects.get_or_create(
			order=order,
			action="demo.order_created",
			description=f"Создан демонстрационный заказ №{order.number}",
			defaults={"actor": actor, "client": client},
		)

		for payment_index, (amount, method, paid_days_ago) in enumerate(data["payments"], start=1):
			payment_comment = f"Демо-платёж {payment_index}"
			payment, payment_created = Payment.objects.get_or_create(
				order=order,
				amount=amount,
				comment=payment_comment,
				defaults={
					"method": method,
					"paid_at": now - timedelta(days=paid_days_ago),
					"created_by": actor,
				},
			)
			if payment_created:
				AuditLog.objects.get_or_create(
					order=order,
					action="demo.payment_created",
					description=f"Получена тестовая оплата {payment.amount} по заказу №{order.number}",
					defaults={"actor": actor, "client": client},
				)

		if order.status == Order.Status.READY and actor:
			CRMNotification.objects.get_or_create(
				recipient=actor,
				order=order,
				message=f"Заказ №{order.number} готов",
			)
		elif order.is_overdue and actor:
			CRMNotification.objects.get_or_create(
				recipient=actor,
				order=order,
				message=f"Заказ №{order.number} просрочен",
			)

	return {
		"clients": len(clients),
		"materials": len(materials),
		"product_types": len(product_types),
		"processing_types": len(processing_types),
		"created_orders": created_orders,
	}