import { useEffect, useState } from 'react'
import {
	ArrowRight,
	BookOpenText,
	CalendarDays,
	Check,
	CircleAlert,
	CircleCheck,
	Clock3,
	Coins,
	FileText,
	LoaderCircle,
	Plus,
	Printer,
	TriangleAlert,
	UserRound,
} from 'lucide-react'
import { Link, useOutletContext } from 'react-router-dom'
import api from '../api.js'

const money = new Intl.NumberFormat('ru-RU', {
	style: 'currency',
	currency: 'RUB',
	maximumFractionDigits: 0,
})

const number = new Intl.NumberFormat('ru-RU')

const metrics = [
	{ key: 'total_orders', label: 'Всего заказов', to: '/orders', icon: BookOpenText, palette: 'border-blue-100 from-blue-50 to-white text-blue-700', iconPalette: 'bg-blue-100 text-blue-700' },
	{ key: 'new_orders', label: 'Новых', to: '/orders?status=new', icon: Plus, palette: 'border-sky-100 from-sky-50 to-white text-sky-700', iconPalette: 'bg-sky-100 text-sky-700' },
	{ key: 'in_progress_orders', label: 'В работе', to: '/orders?status=in_progress', icon: Clock3, palette: 'border-amber-100 from-amber-50 to-white text-amber-700', iconPalette: 'bg-amber-100 text-amber-700' },
	{ key: 'ready_orders', label: 'Готовых', to: '/orders?status=ready', icon: CircleCheck, palette: 'border-emerald-100 from-emerald-50 to-white text-emerald-700', iconPalette: 'bg-emerald-100 text-emerald-700' },
	{ key: 'overdue_orders', label: 'Просроченных', to: '/orders?overdue=true', icon: TriangleAlert, palette: 'border-rose-100 from-rose-50 to-white text-rose-700', iconPalette: 'bg-rose-100 text-rose-700' },
]

function shortDate(value) {
	if (!value) return 'Срок не указан'
	return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${value}T00:00:00`))
}

function monthTitle(month, year) {
	return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
}

function monthSeries(items = []) {
	const now = new Date()
	return Array.from({ length: 10 }, (_, index) => {
		const date = new Date(now.getFullYear(), now.getMonth() - 9 + index, 1)
		const record = items.find((item) => {
			const itemDate = new Date(item.month)
			return itemDate.getFullYear() === date.getFullYear() && itemDate.getMonth() === date.getMonth()
		})
		return {
			label: new Intl.DateTimeFormat('ru-RU', { month: 'short' }).format(date).replace('.', ''),
			value: record?.total ?? 0,
		}
	})
}

function MainPage() {
	const { user } = useOutletContext()
	const [dashboard, setDashboard] = useState(null)
	const [error, setError] = useState(false)
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		let isMounted = true
		api.get('dashboard/')
			.then(({ data }) => {
				if (isMounted) setDashboard(data)
			})
			.catch(() => {
				if (isMounted) setError(true)
			})
			.finally(() => {
				if (isMounted) setLoading(false)
			})
		return () => {
			isMounted = false
		}
	}, [])

	if (loading) {
		return <div className="flex min-h-60 items-center justify-center text-slate-500"><LoaderCircle className="animate-spin" size={24} /><span className="ml-2 text-sm">Загружаем данные мастерской</span></div>
	}

	if (error || !dashboard) {
		return (
			<section className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-950">
				<div className="flex items-start gap-3">
					<CircleAlert className="mt-0.5 shrink-0 text-amber-700" size={21} />
					<div>
						<h3 className="m-0 font-display text-base font-bold">Не удалось загрузить данные</h3>
						<p className="mt-1 mb-3 text-sm text-amber-900">Войдите в CRM, чтобы посмотреть заказы и показатели мастерской.</p>
						<a className="inline-flex items-center gap-2 rounded-md bg-amber-800 px-3 py-2 text-sm font-semibold text-white no-underline hover:bg-amber-900" href="/api-auth/login/?next=/">
							Войти <ArrowRight size={16} />
						</a>
					</div>
				</div>
			</section>
		)
	}

	const chart = monthSeries(dashboard.monthly_orders)
	const chartMax = Math.max(1, ...chart.map((item) => item.value))
	const finance = dashboard.finance
	const today = new Date()
	const firstName = user?.first_name || user?.username || 'Сотрудник'

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<h3 className="m-0 font-display text-[25px] leading-tight font-bold text-slate-900 sm:text-[30px]">Добро пожаловать, {firstName}!</h3>
					<p className="mt-1 mb-0 text-sm text-slate-600">Вот что происходит в вашей мастерской сегодня.</p>
				</div>
				<div className="flex items-center gap-2 text-right text-xs text-slate-600">
					<CalendarDays size={17} className="text-slate-500" />
					<div><div className="font-semibold">{new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(today)}</div><div className="text-[10px] text-slate-400">{new Intl.DateTimeFormat('ru-RU', { weekday: 'long' }).format(today)}</div></div>
				</div>
			</div>

			<section className="grid grid-cols-2 gap-3 xl:grid-cols-5" aria-label="Показатели заказов">
				{metrics.map(({ key, label, to, icon: Icon, palette, iconPalette }) => (
					<Link key={key} to={to} aria-label={`${label}: ${dashboard[key] ?? 0}. Показать список заказов`} className={`min-h-[124px] rounded-lg border bg-gradient-to-br p-4 no-underline transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${palette}`}>
						<div className={`mb-2 grid size-8 place-items-center rounded-md ${iconPalette}`}><Icon size={18} strokeWidth={2.2} /></div>
						<p className="m-0 text-xs font-medium text-slate-700">{label}</p>
						<strong className="mt-1 block font-display text-[25px] leading-none font-bold text-slate-900">{number.format(dashboard[key] ?? 0)}</strong>
					</Link>
				))}
			</section>

			<div className="grid gap-3 xl:grid-cols-[1.65fr_1.05fr]">
				<section className="overflow-hidden rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
					<div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
						<h3 className="m-0 font-display text-sm font-bold text-slate-900">Готовые заказы</h3>
						<Link className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 no-underline hover:text-blue-800" to="/orders?status=ready">Все готовые <ArrowRight size={13} /></Link>
					</div>
					<div className="overflow-x-auto">
						<table className="w-full min-w-[600px] border-collapse text-left text-[11px]">
							<thead className="text-[10px] text-slate-500"><tr>{['№', 'Клиент', 'Изделие', 'Материал', 'Сумма', ''].map((heading) => <th key={heading} className="px-2 py-2 font-medium first:pl-0">{heading}</th>)}</tr></thead>
							<tbody>
								{(dashboard.ready_list ?? []).map((order) => (
									<tr key={order.number} className="border-t border-slate-100 odd:bg-white even:bg-slate-50/60 text-slate-700 hover:bg-blue-50/60">
										<td className="px-2 py-2.5 pl-0 font-semibold"><Link className="text-blue-700 hover:underline" to={`/orders/${order.number}`}>{order.number}</Link></td>
										<td className="px-2 py-2.5">{order.client_name}</td>
										<td className="px-2 py-2.5">{order.product_name || order.product_type_name}</td>
										<td className="px-2 py-2.5">{order.material_name}</td>
										<td className="px-2 py-2.5 font-medium text-slate-900">{money.format(Number(order.price) || 0)}</td>
										<td className="px-2 py-2.5 text-right"><span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700"><Check size={12} /> Готов</span></td>
									</tr>
								))}
								{!dashboard.ready_list?.length && <tr><td colSpan="6" className="py-8 text-center text-slate-400">Готовых заказов пока нет</td></tr>}
							</tbody>
						</table>
					</div>
				</section>

				<section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
					<div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-3">
						<h3 className="m-0 font-display text-sm font-bold text-slate-900">Просроченные заказы</h3>
						<Link className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 no-underline hover:text-blue-800" to="/orders?overdue=true">Все просроченные <ArrowRight size={13} /></Link>
					</div>
					<div className="divide-y divide-slate-100">
						{(dashboard.overdue_list ?? []).map((order) => {
							const overdueDays = Math.max(1, Math.ceil((today - new Date(`${order.due_date}T00:00:00`)) / 86400000))
							return <div key={order.number} className="grid grid-cols-[30px_1fr_auto] gap-x-2 py-3 text-[11px]">
									<Link to={`/orders/${order.number}`} className="font-semibold text-blue-700 no-underline hover:underline">№{order.number}</Link>
								<div className="min-w-0"><strong className="block truncate font-semibold text-slate-900">{order.product_name || order.product_type_name}</strong><span className="mt-1 block text-[10px] text-slate-500">Срок: {shortDate(order.due_date)}</span><span className="mt-1 inline-block rounded bg-rose-50 px-1.5 py-0.5 text-[9px] font-medium text-rose-700">Просрочен на {overdueDays} {overdueDays === 1 ? 'день' : overdueDays < 5 ? 'дня' : 'дней'}</span></div>
								<span className={`h-fit rounded px-2 py-1 text-[9px] font-semibold ${order.status === 'in_progress' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{order.status === 'in_progress' ? 'В работе' : 'Новый'}</span>
							</div>
						})}
						{!dashboard.overdue_list?.length && <p className="py-7 text-center text-xs text-slate-400">Просроченных заказов нет</p>}
					</div>
				</section>
			</div>

			<div className="grid gap-3 lg:grid-cols-[1.4fr_0.95fr_0.95fr]">
				<section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
					<h3 className="m-0 font-display text-sm font-bold text-slate-900">Заказы по месяцам</h3>
					<div className="mt-4 grid grid-cols-[28px_1fr] gap-2">
						<div className="flex h-[128px] flex-col justify-between pb-5 text-right text-[9px] text-slate-400"><span>{chartMax}</span><span>{Math.round(chartMax * 0.66)}</span><span>{Math.round(chartMax * 0.33)}</span><span>0</span></div>
						<div className="relative grid h-[128px] grid-cols-10 items-end gap-1 border-b border-l border-slate-200 px-1 sm:gap-2">
							<div className="pointer-events-none absolute inset-0 flex flex-col justify-between pb-5"><i className="border-t border-dashed border-slate-100" /><i className="border-t border-dashed border-slate-100" /><i className="border-t border-dashed border-slate-100" /><i /></div>
							{chart.map((item) => <div key={item.label} className="relative z-[1] flex h-full min-w-0 flex-col items-center justify-end gap-1"><div className="w-full max-w-5 rounded-t-[3px] bg-gradient-to-t from-blue-600 to-blue-400 transition-[height]" style={{ height: `${item.value ? Math.max(8, item.value / chartMax * 88) : 2}%` }} title={`${item.label}: ${item.value}`} /><span className="absolute -bottom-5 text-[8px] text-slate-500 sm:text-[9px]">{item.label}</span></div>)}
						</div>
					</div>
				</section>

				<section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
					<div className="flex items-center justify-between">
						<div><h3 className="m-0 font-display text-sm font-bold text-slate-900">Финансы</h3><p className="mt-1 mb-0 text-[10px] capitalize text-slate-500">За {monthTitle(finance.month, finance.year)}</p></div>
						<span className="grid size-8 place-items-center rounded-md bg-slate-100 text-slate-600"><Coins size={17} /></span>
					</div>
					<div className="mt-3 divide-y divide-slate-100 text-[11px]">
						<div className="flex justify-between gap-2 py-2.5"><span className="text-slate-600">Заказов</span><strong className="text-slate-900">{number.format(finance.orders_count)}</strong></div>
						<div className="flex justify-between gap-2 py-2.5"><span className="text-slate-600">Сумма заказов</span><strong className="text-slate-900">{money.format(Number(finance.order_total) || 0)}</strong></div>
						<div className="flex justify-between gap-2 py-2.5"><span className="text-slate-600">Оплачено</span><strong className="text-slate-900">{money.format(Number(finance.paid_total) || 0)}</strong></div>
						<div className="flex justify-between gap-2 py-2.5"><span className="text-slate-600">Задолженность</span><strong className="text-slate-900">{money.format(Number(finance.debt_total) || 0)}</strong></div>
					</div>
					<Link to="/finance" className="mt-3 inline-flex items-center gap-1 text-[10px] font-medium text-blue-600 no-underline hover:text-blue-800">Подробнее <ArrowRight size={12} /></Link>
				</section>

				<section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
					<h3 className="m-0 font-display text-sm font-bold text-slate-900">Быстрые действия</h3>
					<div className="mt-3 grid gap-1.5">
						<Link to="/orders/new" className="flex min-h-9 items-center gap-3 rounded-md bg-slate-50 px-3 text-[11px] font-medium text-slate-700 no-underline transition-colors hover:bg-blue-50 hover:text-blue-800"><Plus size={17} className="text-blue-600" /> Создать заказ</Link>
						<Link to="/clients" className="flex min-h-9 items-center gap-3 rounded-md bg-slate-50 px-3 text-[11px] font-medium text-slate-700 no-underline transition-colors hover:bg-blue-50 hover:text-blue-800"><UserRound size={17} className="text-blue-600" /> Добавить клиента</Link>
						<button onClick={() => window.print()} className="flex min-h-9 items-center gap-3 rounded-md border-0 bg-slate-50 px-3 text-left text-[11px] font-medium text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-800"><Printer size={17} className="text-blue-600" /> Печать страницы</button>
						<Link to="/orders" className="flex min-h-9 items-center gap-3 rounded-md bg-slate-50 px-3 text-[11px] font-medium text-slate-700 no-underline transition-colors hover:bg-blue-50 hover:text-blue-800"><FileText size={17} className="text-blue-600" /> Добавить оплату</Link>
					</div>
				</section>
			</div>

			<footer className="flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-3 text-[9px] text-slate-400"><span>StoneCRM v1.0.0</span><span>CRM для камнеобрабатывающей мастерской</span></footer>
		</div>
	)
}

export default MainPage