import { useEffect, useState } from 'react'
import { CalendarDays, CircleAlert, ClipboardList, Clock, LoaderCircle, TriangleAlert, Wallet } from 'lucide-react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import api from '../api.js'

const money = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })
const number = new Intl.NumberFormat('ru-RU')
const monthFormat = new Intl.DateTimeFormat('ru-RU', { month: 'short', year: '2-digit' })

const statusMeta = {
	new: { label: 'Новый', color: '#3b82f6' },
	in_progress: { label: 'В работе', color: '#f59e0b' },
	ready: { label: 'Готов', color: '#10b981' },
	issued: { label: 'Выдан', color: '#64748b' },
	cancelled: { label: 'Отменён', color: '#f43f5e' },
}

const axisTick = { fontSize: 10, fill: '#64748b' }
const tooltipStyle = { fontSize: 11, borderRadius: 6, border: '1px solid #e2e8f0' }
const monthLabel = (value) => monthFormat.format(new Date(value)).replace(' г.', '').replace('.', '')

function Card({ icon: Icon, tone, label, value, hint }) {
	return (
		<article className={`rounded-lg border p-4 ${tone.box}`}>
			<span className={`grid size-8 place-items-center rounded-md ${tone.icon}`}><Icon size={17} /></span>
			<p className="mt-2 mb-1 text-xs text-slate-600">{label}</p>
			<strong className="font-display text-2xl text-slate-900">{value}</strong>
			{hint && <p className="mt-1 mb-0 text-[10px] text-slate-500">{hint}</p>}
		</article>
	)
}

function Panel({ title, subtitle, children, empty }) {
	return (
		<section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
			<h4 className="m-0 font-display text-sm font-bold text-slate-900">{title}</h4>
			{subtitle && <p className="mt-1 mb-0 text-[10px] text-slate-500">{subtitle}</p>}
			<div className="mt-4 h-60">{empty ? <div className="grid h-full place-items-center text-xs text-slate-400">Нет данных за период</div> : <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>}</div>
		</section>
	)
}

function HorizontalBars({ data, color, unit }) {
	return (
		<BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
			<CartesianGrid horizontal={false} stroke="#f1f5f9" />
			<XAxis type="number" allowDecimals={false} tick={axisTick} />
			<YAxis type="category" dataKey="name" width={110} tick={axisTick} />
			<Tooltip contentStyle={tooltipStyle} formatter={(value) => [value, unit]} />
			<Bar dataKey="total" fill={color} radius={[0, 4, 4, 0]} barSize={14} />
		</BarChart>
	)
}

function AnalyticsPage() {
	const location = useLocation()
	const [, setSearchParams] = useSearchParams()
	const query = new URLSearchParams(location.search)
	const [formDates, setFormDates] = useState({ date_from: query.get('date_from') ?? '', date_to: query.get('date_to') ?? '' })
	const [report, setReport] = useState(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(false)

	useEffect(() => {
		let isMounted = true
		api.get(`analytics/overview/${location.search}`)
			.then(({ data }) => {
				if (!isMounted) return
				setReport(data)
				setError(false)
				setFormDates({ date_from: data.period.date_from, date_to: data.period.date_to })
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
	}, [location.search])

	function applyPeriod(event) {
		event.preventDefault()
		if (!formDates.date_from || !formDates.date_to || formDates.date_from > formDates.date_to) return
		setLoading(true)
		setSearchParams(formDates)
	}

	const summary = report?.summary
	const statusData = (report?.by_status ?? []).map((item) => ({ ...item, name: statusMeta[item.status]?.label ?? item.status, color: statusMeta[item.status]?.color ?? '#94a3b8' }))
	const monthsMap = new Map()
	for (const item of report?.orders_by_month ?? []) monthsMap.set(item.month, { month: item.month, orders: item.total })
	for (const item of report?.received_by_month ?? []) monthsMap.set(item.month, { ...monthsMap.get(item.month), month: item.month, received: Number(item.received) || 0 })
	const monthData = [...monthsMap.values()].sort((a, b) => new Date(a.month) - new Date(b.month)).map((item) => ({ orders: 0, received: 0, ...item }))
	const loginNext = encodeURIComponent(`${location.pathname}${location.search}`)
	const dateField = 'w-[132px] bg-transparent text-[11px] outline-none'

	return (
		<div className="space-y-5">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div><h3 className="m-0 font-display text-2xl font-bold text-slate-900">Аналитика</h3><p className="mt-1 mb-0 text-xs text-slate-500">Заказы, поступления и популярные позиции за выбранный период.</p></div>
				<form onSubmit={applyPeriod} className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-3">
					<label><span className="mb-1 block text-[10px] font-medium text-slate-500">С</span><span className="flex h-9 items-center gap-2 rounded border border-slate-200 px-2"><CalendarDays size={14} className="text-slate-400" /><input required type="date" value={formDates.date_from} max={formDates.date_to || undefined} onChange={(event) => setFormDates((current) => ({ ...current, date_from: event.target.value }))} className={dateField} /></span></label>
					<label><span className="mb-1 block text-[10px] font-medium text-slate-500">По</span><span className="flex h-9 items-center gap-2 rounded border border-slate-200 px-2"><CalendarDays size={14} className="text-slate-400" /><input required type="date" value={formDates.date_to} min={formDates.date_from || undefined} onChange={(event) => setFormDates((current) => ({ ...current, date_to: event.target.value }))} className={dateField} /></span></label>
					<button type="submit" disabled={loading || !formDates.date_from || !formDates.date_to || formDates.date_from > formDates.date_to} className="h-9 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">Показать</button>
				</form>
			</div>

			{loading ? (
				<div className="flex min-h-56 items-center justify-center text-sm text-slate-500"><LoaderCircle size={21} className="mr-2 animate-spin" /> Загружаем аналитику</div>
			) : error || !report ? (
				<section className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-950"><CircleAlert size={20} className="mt-0.5 shrink-0 text-amber-700" /><div><h4 className="m-0 text-sm font-bold">Не удалось загрузить аналитику</h4><p className="mt-1 mb-0 text-xs">Войдите в CRM или проверьте выбранные даты.</p><a className="mt-3 inline-block text-xs font-semibold underline" href={`/api-auth/login/?next=${loginNext}`}>Войти</a></div></section>
			) : <>
				<section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Ключевые показатели">
					<Card icon={ClipboardList} tone={{ box: 'border-blue-100 bg-gradient-to-br from-blue-50 to-white', icon: 'bg-blue-100 text-blue-700' }} label="Заказов" value={number.format(summary.orders_count)} hint={`на ${money.format(Number(summary.order_total) || 0)}`} />
					<Card icon={Wallet} tone={{ box: 'border-emerald-100 bg-gradient-to-br from-emerald-50 to-white', icon: 'bg-emerald-100 text-emerald-700' }} label="Получено за период" value={money.format(Number(summary.received_in_period) || 0)} />
					<Card icon={Wallet} tone={{ box: 'border-amber-100 bg-gradient-to-br from-amber-50 to-white', icon: 'bg-amber-100 text-amber-700' }} label="Долг по заказам" value={money.format(Number(summary.debt_total) || 0)} />
					<Card icon={TriangleAlert} tone={{ box: 'border-rose-100 bg-gradient-to-br from-rose-50 to-white', icon: 'bg-rose-100 text-rose-700' }} label="Просрочено" value={number.format(summary.overdue_count)} />
					<Card icon={Clock} tone={{ box: 'border-sky-100 bg-gradient-to-br from-sky-50 to-white', icon: 'bg-sky-100 text-sky-700' }} label="Средний срок" value={summary.avg_lead_days == null ? '—' : `${number.format(summary.avg_lead_days)} дн.`} hint="от создания до готовности" />
				</section>

				<div className="grid gap-4 xl:grid-cols-[1.35fr_0.85fr]">
					<Panel title="Заказы по месяцам" subtitle="Неотменённые заказы по дате создания" empty={!monthData.length}>
						<LineChart data={monthData} margin={{ left: -16, right: 8, top: 8 }}>
							<CartesianGrid stroke="#f1f5f9" />
							<XAxis dataKey="month" tickFormatter={monthLabel} tick={axisTick} />
							<YAxis allowDecimals={false} tick={axisTick} />
							<Tooltip contentStyle={tooltipStyle} labelFormatter={monthLabel} formatter={(value) => [value, 'Заказов']} />
							<Line type="monotone" dataKey="orders" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
						</LineChart>
					</Panel>
					<Panel title="Заказы по статусам" subtitle="Включая отменённые" empty={!statusData.length}>
						<PieChart>
							<Pie data={statusData} dataKey="total" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>{statusData.map((item) => <Cell key={item.status} fill={item.color} />)}</Pie>
							<Tooltip contentStyle={tooltipStyle} />
							<Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
						</PieChart>
					</Panel>
				</div>

				<Panel title="Поступления по месяцам" subtitle="По дате фактической оплаты" empty={!monthData.some((item) => item.received)}>
					<BarChart data={monthData} margin={{ left: 8, right: 8, top: 8 }}>
						<CartesianGrid vertical={false} stroke="#f1f5f9" />
						<XAxis dataKey="month" tickFormatter={monthLabel} tick={axisTick} />
						<YAxis tick={axisTick} tickFormatter={(value) => number.format(value)} width={70} />
						<Tooltip contentStyle={tooltipStyle} labelFormatter={monthLabel} formatter={(value) => [money.format(value), 'Получено']} />
						<Bar dataKey="received" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={36} />
					</BarChart>
				</Panel>

				<div className="grid gap-4 lg:grid-cols-3">
					<Panel title="Популярные материалы" subtitle="Количество заказов" empty={!report.by_material.length}><HorizontalBars data={report.by_material} color="#6366f1" unit="Заказов" /></Panel>
					<Panel title="Типы изделий" subtitle="Количество заказов" empty={!report.by_product_type.length}><HorizontalBars data={report.by_product_type} color="#0ea5e9" unit="Заказов" /></Panel>
					<Panel title="Заказы по менеджерам" subtitle="Создано заказов" empty={!report.by_manager.length}><HorizontalBars data={report.by_manager} color="#14b8a6" unit="Заказов" /></Panel>
				</div>

				<section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
					<div className="border-b border-slate-100 px-4 py-3"><h4 className="m-0 font-display text-sm font-bold text-slate-900">Клиенты с задолженностью</h4><p className="mt-1 mb-0 text-[10px] text-slate-500">Остаток по неотменённым заказам за период, топ-10</p></div>
					<div className="overflow-x-auto">
						<table className="w-full min-w-[560px] border-collapse text-left text-xs">
							<thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-500"><tr>{['Клиент', 'Телефон', 'Заказов', 'Долг'].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead>
							<tbody>
								{report.top_debtors.map((item) => <tr key={item.client_id} className="border-t border-slate-100 odd:bg-white even:bg-slate-50/60 hover:bg-blue-50/60 text-slate-700"><td className="px-4 py-3 font-semibold text-slate-900">{item.name}</td><td className="whitespace-nowrap px-4 py-3">{item.phone}</td><td className="px-4 py-3">{number.format(item.orders)}</td><td className="whitespace-nowrap px-4 py-3 font-semibold text-amber-700">{money.format(Number(item.debt) || 0)}</td></tr>)}
								{!report.top_debtors.length && <tr><td colSpan="4" className="px-4 py-12 text-center text-slate-400">Задолженностей нет</td></tr>}
							</tbody>
						</table>
					</div>
				</section>
			</>}
		</div>
	)
}

export default AnalyticsPage