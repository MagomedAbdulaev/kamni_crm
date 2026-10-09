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
    EmployeeProfile,
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

    today = timezone.localdate()
    now = timezone.now()

    # ============================================================
    # АДМИНИСТРАТОР
    # ============================================================

    admin = (
        User.objects
        .filter(is_superuser=True, is_active=True)
        .order_by("pk")
        .first()
    )

    # ============================================================
    # МЕНЕДЖЕРЫ
    # ============================================================

    manager_data = (
        {
            "username": "manager_amina",
            "first_name": "Амина",
            "last_name": "Магомедова",
            "email": "manager.amina@stonecrm.local",
        },
        {
            "username": "manager_rustam",
            "first_name": "Рустам",
            "last_name": "Абдуллаев",
            "email": "manager.rustam@stonecrm.local",
        },
    )

    managers = []

    for data in manager_data:
        manager, _ = User.objects.get_or_create(
            username=data["username"],
            defaults={
                "first_name": data["first_name"],
                "last_name": data["last_name"],
                "email": data["email"],
                "is_active": True,
            },
        )

        manager.first_name = data["first_name"]
        manager.last_name = data["last_name"]
        manager.email = data["email"]
        manager.is_active = True
        manager.set_password("manager123")
        manager.save()

        EmployeeProfile.objects.update_or_create(
            user=manager,
            defaults={
                "role": EmployeeProfile.Role.MANAGER,
            },
        )

        managers.append(manager)

    manager_amina = managers[0]
    manager_rustam = managers[1]

    # ============================================================
    # КЛИЕНТЫ
    # ============================================================

    client_data = (
        ("Рашид", "Магомедов", "9000000001", True),
        ("Алина", "Мурзина", "9000000002", True),
        ("Магомед", "Абдулаев", "9000000003", False),
        ("Рустам", "Алиев", "9000000004", False),
        ("Самира", "Юсупова", "9000000005", True),
        ("Зарина", "Гаджиева", "9000000006", True),
        ("Ибрагим", "Гаджиев", "9000000007", False),
        ("Султан", "Кадыров", "9000000008", True),
        ("Мадина", "Омарова", "9000000009", False),
        ("Тимур", "Исмаилов", "9000000010", False),
        ("Лейла", "Мусаева", "9000000011", True),
        ("Адам", "Хасанов", "9000000012", False),
        ("Диана", "Алиева", "9000000013", True),
        ("Хадижат", "Магомедова", "9000000014", False),
        ("Мурад", "Расулов", "9000000015", True),
        ("Зульфия", "Алиева", "9000000016", False),
        ("Шамиль", "Омаров", "9000000017", False),
        ("Патимат", "Ибрагимова", "9000000018", True),
        ("Ислам", "Магомедов", "9000000019", True),
        ("Марат", "Саидов", "9000000020", False),
        ("Саида", "Гаджиева", "9000000021", True),
        ("Аслан", "Керимов", "9000000022", False),
        ("Малика", "Абдуллаева", "9000000023", True),
        ("Абдулла", "Муртазалиев", "9000000024", False),
        ("Эльдар", "Алиев", "9000000025", False),
        ("Хава", "Магомедова", "9000000026", True),
        ("Юсуф", "Гасанов", "9000000027", False),
        ("Саида", "Расулова", "9000000028", True),
        ("Шамиль", "Алиев", "9000000029", False),
        ("Аминат", "Магомедова", "9000000030", True),
    )

    clients = {}

    for first_name, last_name, phone, is_regular in client_data:
        phone_full = f"+7 {phone[:3]} {phone[3:6]}-{phone[6:8]}-{phone[8:]}"

        client, _ = Client.objects.get_or_create(
            phone=phone_full,
            defaults={
                "first_name": first_name,
                "last_name": last_name,
                "is_regular": is_regular,
                "comment": "Тестовая запись StoneCRM",
            },
        )

        clients[phone_full] = client

    # ============================================================
    # МАТЕРИАЛЫ
    # ============================================================

    material_data = (
        (Material.Category.MARBLE, "Carrara", 20),
        (Material.Category.MARBLE, "Emperador", 20),
        (Material.Category.MARBLE, "Nero Marquina", 20),
        (Material.Category.GRANITE, "Black Galaxy", 30),
        (Material.Category.GRANITE, "Tan Brown", 30),
        (Material.Category.GRANITE, "G603", 30),
        (Material.Category.GRANITE, "Absolute Black", 30),
        (Material.Category.QUARTZ, "Calacatta", 20),
        (Material.Category.QUARTZ, "Concrete Grey", 20),
        (Material.Category.QUARTZ, "Pure White", 20),
        (Material.Category.QUARTZITE, "Taj Mahal", 20),
        (Material.Category.QUARTZITE, "Cristallo", 20),
    )

    materials = {}

    for category, name, thickness in material_data:
        material, _ = Material.objects.get_or_create(
            category=category,
            name=name,
            defaults={
                "thickness_mm": thickness,
                "is_active": True,
            },
        )

        if material.thickness_mm != thickness:
            material.thickness_mm = thickness
            material.save(update_fields=["thickness_mm"])

        materials[name] = material

    # ============================================================
    # ТИПЫ ИЗДЕЛИЙ
    # ============================================================

    product_type_names = (
        "Подоконник",
        "Столешница",
        "Ступени",
        "Облицовка",
        "Барная стойка",
        "Лестница",
        "Тумба",
        "Каминный портал",
    )

    product_types = {
        name: ProductType.objects.get_or_create(
            name=name,
            defaults={"is_active": True},
        )[0]
        for name in product_type_names
    }

    # ============================================================
    # ВИДЫ ОБРАБОТКИ
    # ============================================================

    processing_names = (
        "Прямой рез",
        "Фаска",
        "Полировка",
        "Вырез под мойку",
        "Капельник",
        "Отверстие",
        "Скругление",
        "Еврозапил",
    )

    processing_types = {
        name: ProcessingType.objects.get_or_create(
            name=name,
            defaults={"is_active": True},
        )[0]
        for name in processing_names
    }

    # ============================================================
    # ЗАКАЗЫ
    # ============================================================

    order_templates = (
        {
            "client": 1,
            "product": "Подоконник в гостиную",
            "type": "Подоконник",
            "material": "Carrara",
            "status": Order.Status.NEW,
            "due": 5,
            "created": 3,
            "price": "25000",
            "processing": ("Прямой рез", "Полировка"),
            "comment": "Новый заказ. Ожидает передачи в производство.",
        },
        {
            "client": 2,
            "product": "Столешница, кухня",
            "type": "Столешница",
            "material": "Black Galaxy",
            "status": Order.Status.IN_PROGRESS,
            "due": -2,
            "created": 21,
            "price": "75000",
            "processing": ("Фаска", "Полировка", "Вырез под мойку"),
            "comment": "Заказ просрочен. Нужно связаться с клиентом.",
        },
        {
            "client": 3,
            "product": "Ступени на лестницу",
            "type": "Ступени",
            "material": "Emperador",
            "status": Order.Status.READY,
            "due": 0,
            "created": 5,
            "price": "135000",
            "processing": ("Фаска", "Полировка"),
            "comment": "Готово к выдаче клиенту.",
        },
        {
            "client": 4,
            "product": "Облицовка входной группы",
            "type": "Облицовка",
            "material": "Tan Brown",
            "status": Order.Status.ISSUED,
            "due": -3,
            "created": 46,
            "price": "90000",
            "processing": ("Прямой рез", "Полировка"),
            "comment": "Заказ выдан клиенту.",
        },
        {
            "client": 5,
            "product": "Барная стойка",
            "type": "Барная стойка",
            "material": "Calacatta",
            "status": Order.Status.CANCELLED,
            "due": 10,
            "created": 63,
            "price": "70000",
            "processing": ("Прямой рез",),
            "comment": "Заказ отменён по просьбе клиента.",
        },
        {
            "client": 6,
            "product": "Подоконники, второй этаж",
            "type": "Подоконник",
            "material": "G603",
            "status": Order.Status.NEW,
            "due": 12,
            "created": 8,
            "price": "34000",
            "processing": ("Прямой рез", "Фаска"),
            "comment": "Новый заказ.",
        },
        {
            "client": 7,
            "product": "Столешница для острова",
            "type": "Столешница",
            "material": "Taj Mahal",
            "status": Order.Status.IN_PROGRESS,
            "due": -4,
            "created": 38,
            "price": "120000",
            "processing": ("Фаска", "Полировка", "Вырез под мойку"),
            "comment": "Просрочен. Внесена предоплата.",
        },
        {
            "client": 8,
            "product": "Лестница в загородный дом",
            "type": "Лестница",
            "material": "Tan Brown",
            "status": Order.Status.IN_PROGRESS,
            "due": -1,
            "created": 72,
            "price": "210000",
            "processing": ("Прямой рез", "Фаска", "Полировка"),
            "comment": "Ожидается финальная полировка.",
        },
        {
            "client": 9,
            "product": "Столешница и фартук",
            "type": "Столешница",
            "material": "Concrete Grey",
            "status": Order.Status.IN_PROGRESS,
            "due": 9,
            "created": 30,
            "price": "148000",
            "processing": ("Фаска", "Полировка", "Вырез под мойку", "Отверстие"),
            "comment": "Добавлен дополнительный вырез под дозатор.",
        },
        {
            "client": 10,
            "product": "Каминный портал",
            "type": "Каминный портал",
            "material": "Emperador",
            "status": Order.Status.READY,
            "due": 1,
            "created": 128,
            "price": "84000",
            "processing": ("Прямой рез", "Фаска", "Полировка"),
            "comment": "Готово, оплачено полностью.",
        },
        {
            "client": 11,
            "product": "Островная барная стойка",
            "type": "Барная стойка",
            "material": "Calacatta",
            "status": Order.Status.READY,
            "due": 2,
            "created": 153,
            "price": "118000",
            "processing": ("Фаска", "Полировка"),
            "comment": "Готово к выдаче.",
        },
        {
            "client": 12,
            "product": "Тумба для ванной",
            "type": "Тумба",
            "material": "Carrara",
            "status": Order.Status.ISSUED,
            "due": -7,
            "created": 181,
            "price": "63000",
            "processing": ("Прямой рез", "Фаска", "Полировка"),
            "comment": "Заказ выдан и полностью оплачен.",
        },
        {
            "client": 13,
            "product": "Комплект ступеней для крыльца",
            "type": "Ступени",
            "material": "Black Galaxy",
            "status": Order.Status.READY,
            "due": 4,
            "created": 20,
            "price": "54000",
            "processing": ("Прямой рез", "Капельник", "Полировка"),
            "comment": "Повторный заказ постоянного клиента.",
        },
        {
            "client": 14,
            "product": "Подоконники в спальни",
            "type": "Подоконник",
            "material": "Pure White",
            "status": Order.Status.IN_PROGRESS,
            "due": 6,
            "created": 14,
            "price": "67000",
            "processing": ("Прямой рез", "Фаска"),
            "comment": "Изделия находятся в производстве.",
        },
        {
            "client": 15,
            "product": "Кухонный остров",
            "type": "Столешница",
            "material": "Cristallo",
            "status": Order.Status.NEW,
            "due": 18,
            "created": 4,
            "price": "195000",
            "processing": ("Фаска", "Еврозапил", "Полировка"),
            "comment": "Ожидается подтверждение размеров.",
        },
        {
            "client": 16,
            "product": "Лестничные ступени",
            "type": "Ступени",
            "material": "Absolute Black",
            "status": Order.Status.IN_PROGRESS,
            "due": 3,
            "created": 17,
            "price": "165000",
            "processing": ("Прямой рез", "Фаска", "Полировка"),
            "comment": "Производство начато.",
        },
        {
            "client": 17,
            "product": "Облицовка камина",
            "type": "Облицовка",
            "material": "Nero Marquina",
            "status": Order.Status.READY,
            "due": 2,
            "created": 40,
            "price": "143000",
            "processing": ("Прямой рез", "Скругление", "Полировка"),
            "comment": "Готово.",
        },
        {
            "client": 18,
            "product": "Подоконник в кабинет",
            "type": "Подоконник",
            "material": "Emperador",
            "status": Order.Status.ISSUED,
            "due": -5,
            "created": 55,
            "price": "42000",
            "processing": ("Прямой рез", "Фаска"),
            "comment": "Выдан клиенту.",
        },
        {
            "client": 19,
            "product": "Столешница для кухни",
            "type": "Столешница",
            "material": "Calacatta",
            "status": Order.Status.IN_PROGRESS,
            "due": -3,
            "created": 28,
            "price": "156000",
            "processing": ("Фаска", "Вырез под мойку", "Отверстие"),
            "comment": "Есть задержка по производству.",
        },
        {
            "client": 20,
            "product": "Каминный портал",
            "type": "Каминный портал",
            "material": "Nero Marquina",
            "status": Order.Status.CANCELLED,
            "due": 7,
            "created": 70,
            "price": "110000",
            "processing": ("Прямой рез", "Фаска"),
            "comment": "Клиент отказался от заказа.",
        },
        {
            "client": 21,
            "product": "Барная стойка",
            "type": "Барная стойка",
            "material": "Taj Mahal",
            "status": Order.Status.NEW,
            "due": 20,
            "created": 2,
            "price": "132000",
            "processing": ("Фаска", "Полировка"),
            "comment": "Новый заказ.",
        },
        {
            "client": 22,
            "product": "Столешница для ванной",
            "type": "Столешница",
            "material": "Concrete Grey",
            "status": Order.Status.READY,
            "due": 1,
            "created": 31,
            "price": "58000",
            "processing": ("Отверстие", "Полировка"),
            "comment": "Готово к выдаче.",
        },
        {
            "client": 23,
            "product": "Ступени для дома",
            "type": "Ступени",
            "material": "G603",
            "status": Order.Status.IN_PROGRESS,
            "due": 8,
            "created": 19,
            "price": "98000",
            "processing": ("Прямой рез", "Фаска"),
            "comment": "В производстве.",
        },
        {
            "client": 24,
            "product": "Облицовка стены",
            "type": "Облицовка",
            "material": "Absolute Black",
            "status": Order.Status.NEW,
            "due": 15,
            "created": 7,
            "price": "87000",
            "processing": ("Прямой рез", "Полировка"),
            "comment": "Ожидает запуска.",
        },
        {
            "client": 25,
            "product": "Подоконники для квартиры",
            "type": "Подоконник",
            "material": "Carrara",
            "status": Order.Status.ISSUED,
            "due": -10,
            "created": 90,
            "price": "72000",
            "processing": ("Прямой рез", "Фаска", "Полировка"),
            "comment": "Заказ успешно выдан.",
        },
        {
            "client": 26,
            "product": "Кухонная столешница",
            "type": "Столешница",
            "material": "Pure White",
            "status": Order.Status.IN_PROGRESS,
            "due": -2,
            "created": 44,
            "price": "125000",
            "processing": ("Фаска", "Вырез под мойку", "Полировка"),
            "comment": "Требуется ускорить производство.",
        },
        {
            "client": 27,
            "product": "Лестница",
            "type": "Лестница",
            "material": "Tan Brown",
            "status": Order.Status.READY,
            "due": 3,
            "created": 61,
            "price": "230000",
            "processing": ("Прямой рез", "Фаска", "Полировка"),
            "comment": "Полностью готово.",
        },
        {
            "client": 28,
            "product": "Тумба в ванную",
            "type": "Тумба",
            "material": "Carrara",
            "status": Order.Status.NEW,
            "due": 11,
            "created": 10,
            "price": "61000",
            "processing": ("Фаска", "Отверстие"),
            "comment": "Новый заказ.",
        },
        {
            "client": 29,
            "product": "Каминная облицовка",
            "type": "Каминный портал",
            "material": "Emperador",
            "status": Order.Status.CANCELLED,
            "due": 12,
            "created": 83,
            "price": "97000",
            "processing": ("Прямой рез", "Полировка"),
            "comment": "Отменён клиентом.",
        },
        {
            "client": 30,
            "product": "Столешница с островом",
            "type": "Столешница",
            "material": "Taj Mahal",
            "status": Order.Status.IN_PROGRESS,
            "due": 5,
            "created": 23,
            "price": "210000",
            "processing": ("Фаска", "Еврозапил", "Вырез под мойку", "Полировка"),
            "comment": "Большой заказ, находится в производстве.",
        },
    )

    # ============================================================
    # СОЗДАНИЕ ЗАКАЗОВ
    # ============================================================

    created_orders = 0
    created_payments = 0

    # Разные суммы оплат для разных заказов.
    payment_percentages = (
        Decimal("0.30"),
        Decimal("0.50"),
        Decimal("0.70"),
        Decimal("1.00"),
        Decimal("0.40"),
    )

    for index, data in enumerate(order_templates):
        phone = f"+7 900 000-00-{data['client']:02d}"
        client = clients[phone]

        # Чередуем менеджеров.
        manager = managers[index % len(managers)]

        price = Decimal(data["price"])

        ready_at = None

        if data["status"] in (
            Order.Status.READY,
            Order.Status.ISSUED,
        ):
            ready_at = now - timedelta(
                days=max(1, data["created"] // 3)
            )

        order, created = Order.objects.get_or_create(
            client=client,
            product_name=data["product"],
            defaults={
                "product_type": product_types[data["type"]],
                "material": materials[data["material"]],
                "status": data["status"],
                "price": price,
                "due_date": today + timedelta(days=data["due"]),
                "ready_at": ready_at,
                "comment": data["comment"],
                "created_by": manager,
            },
        )

        if not created:
            continue

        created_orders += 1

        # Чтобы created_at выглядел реалистично.
        Order.objects.filter(pk=order.pk).update(
            created_at=now - timedelta(days=data["created"])
        )

        # ========================================================
        # ОБРАБОТКА
        # ========================================================

        for processing_name in data["processing"]:
            OrderProcessing.objects.get_or_create(
                order=order,
                processing_type=processing_types[processing_name],
                defaults={
                    "parameters": {
                        "note": "Демо-параметры обработки",
                    }
                },
            )

        # ========================================================
        # ИСТОРИЯ СТАТУСОВ
        # ========================================================

        status_path = {
            Order.Status.NEW: (
                "new",
            ),
            Order.Status.IN_PROGRESS: (
                "new",
                "in_progress",
            ),
            Order.Status.READY: (
                "new",
                "in_progress",
                "ready",
            ),
            Order.Status.ISSUED: (
                "new",
                "in_progress",
                "ready",
                "issued",
            ),
            Order.Status.CANCELLED: (
                "new",
                "cancelled",
            ),
        }[order.status]

        previous_status = ""

        for current_status in status_path:
            StatusHistory.objects.get_or_create(
                order=order,
                old_status=previous_status,
                new_status=current_status,
                defaults={
                    "changed_by": manager,
                    "comment": (
                        "Демонстрационное изменение статуса"
                    ),
                },
            )

            previous_status = current_status

        # ========================================================
        # КОММЕНТАРИЙ
        # ========================================================

        Comment.objects.get_or_create(
            order=order,
            text=data["comment"],
            defaults={
                "author": manager,
            },
        )

        # Иногда добавляем второй комментарий.
        if index % 3 == 0:
            Comment.objects.get_or_create(
                order=order,
                text="Связаться с клиентом и уточнить детали заказа.",
                defaults={
                    "author": (
                        manager_amina
                        if manager == manager_rustam
                        else manager_rustam
                    ),
                },
            )

        # ========================================================
        # AUDIT LOG
        # ========================================================

        AuditLog.objects.get_or_create(
            order=order,
            action="demo.order_created",
            defaults={
                "actor": manager,
                "client": client,
                "description": (
                    f"Менеджер {manager.get_full_name()} "
                    f"создал демонстрационный заказ №{order.number}"
                ),
            },
        )

        # ========================================================
        # ОПЛАТЫ
        # ========================================================

        # Не всем заказам создаём оплату.
        if index % 4 != 0:
            percentage = payment_percentages[index % len(payment_percentages)]
            payment_amount = (price * percentage).quantize(Decimal("0.01"))

            payment_methods = (
                Payment.Method.CASH,
                Payment.Method.TRANSFER,
                Payment.Method.CARD,
            )

            payment_method = payment_methods[index % len(payment_methods)]

            payment, payment_created = Payment.objects.get_or_create(
                order=order,
                amount=payment_amount,
                comment="Демо-платёж",
                defaults={
                    "method": payment_method,
                    "paid_at": now - timedelta(
                        days=min(data["created"], 20)
                    ),
                    "created_by": manager,
                },
            )

            if payment_created:
                created_payments += 1

                AuditLog.objects.get_or_create(
                    order=order,
                    action="demo.payment_created",
                    defaults={
                        "actor": manager,
                        "client": client,
                        "description": (
                            f"Получена тестовая оплата "
                            f"{payment.amount} ₽ "
                            f"по заказу №{order.number}"
                        ),
                    },
                )

        # ========================================================
        # УВЕДОМЛЕНИЯ
        # ========================================================

        if order.status == Order.Status.READY:
            CRMNotification.objects.get_or_create(
                recipient=manager,
                order=order,
                message=f"Заказ №{order.number} готов",
            )

        elif order.is_overdue:
            CRMNotification.objects.get_or_create(
                recipient=manager,
                order=order,
                message=f"Заказ №{order.number} просрочен",
            )

        elif order.status == Order.Status.NEW:
            CRMNotification.objects.get_or_create(
                recipient=manager,
                order=order,
                message=f"Новый заказ №{order.number}",
            )

    # ============================================================
    # ДОПОЛНИТЕЛЬНЫЕ УВЕДОМЛЕНИЯ
    # ============================================================

    if created_orders:
        CRMNotification.objects.get_or_create(
            recipient=manager_amina,
            order=None,
            message=f"Создано {created_orders} демонстрационных заказов",
        )

        CRMNotification.objects.get_or_create(
            recipient=manager_rustam,
            order=None,
            message="Демо-данные успешно загружены в CRM",
        )

    # ============================================================
    # РЕЗУЛЬТАТ
    # ============================================================

    return {
        "managers": len(managers),
        "clients": len(clients),
        "materials": len(materials),
        "product_types": len(product_types),
        "processing_types": len(processing_types),
        "created_orders": created_orders,
        "created_payments": created_payments,
    }