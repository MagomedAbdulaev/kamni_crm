import {
	ChartNoAxesCombined,
	Coins,
	Gem,
	Grid2X2,
	House,
	List,
	Settings2,
	UserRound,
	UsersRound,
} from 'lucide-react'

const navigation = [
	{ path: '/', label: 'Главная', icon: House },
	{ path: '/orders', label: 'Заказы', icon: List },
	{ path: '/clients', label: 'Клиенты', icon: UsersRound },
	{ path: '/finance', label: 'Финансы', icon: Coins },
	{ path: '/materials', label: 'Материалы', icon: Gem },
	{ path: '/product-types', label: 'Типы изделий', icon: Grid2X2 },
	{ path: '/analytics', label: 'Аналитика', icon: ChartNoAxesCombined },
	{ path: '/managers', label: 'Менеджеры', icon: UserRound },
	{ path: '/settings', label: 'Настройки', icon: Settings2 },
]

export default navigation