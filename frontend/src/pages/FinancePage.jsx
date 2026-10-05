import { useEffect, useState } from 'react'
import { CalendarDays, CircleAlert, Coins, CreditCard, LoaderCircle, Wallet } from 'lucide-react'
import { useLocation, useSearchParams } from 'react-router-dom'
import api from '../api.js'

const money = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })
const number = new Intl.NumberFormat('ru-RU')

const paymentMethods = {
	cash: 'Наличные',
	transfer: 'Перевод',
	card: 'Карта',
	other: 'Другое',
}

const orderStatuses = {
	new: 'Новый',
	in_progress: 'В работе',
	ready: 'Готов',
	issued: 'Выдан',
	cancelled: 'Отменён',
}

function localDate(value) {
	const year = value.getFullYear()
	const month = String(value.getMonth() + 1).padStart(2, '0')
	const day = String(value.getDate()).padStart(2, '0')
	return `${year}-${month}-${day}`
}

function defaultPeriod() {
	const today = new Date()
	return { date_from: localDate(new Date(today.getFullYear(), today.getMonth(), 1)), date_to: localDate(today) }
}

function FinancePage() {
	const location = useLocation()
	const [, setSearchParams] = useSearchParams()
	const defaultDates = defaultPeriod()
	const query = new URLSearchParams(location.search)
	const dateFrom = query.get('date_from') ?? defaultDates.date_from
	const dateTo = query.get('date_to') ?? defaultDates.date_to
	const [formDates, setFormDates] = useState({ date_from: dateFrom, date_to: dateTo })
	const [report, setReport] = useState(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(false)

	useEffect(() => {
		let isMounted = true
		api.get(`analytics/revenue/${location.search}`)
			.then(({ data }) => {
				if (isMounted) setReport(data)
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
	}, [dateFrom, dateTo, location.search])

	function applyPeriod(event) {
		event.preventDefault()
		if (!formDates.date_from || !formDates.date_to || formDates.date_from > formDates.date_to) return
		setLoading(true)
		setError(false)
		setSearchParams(formDates)
	}

	const summary = report?.summary
	const byMonth = report?.by_month ?? []
	const chartMax = Math.max(1, ...byMonth.map((item) => Number(item.received) || 0))
	const firstChartMonth = byMonth[0] ? new Date(byMonth[0].month) : null
	const lastChartMonth = byMonth.length ? new Date(byMonth[byMonth.length - 1].month) : null

	return (
		<div className="space-y-5">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div><h3 className="m-0 font-display text-2xl font-bold text-slate-900">Финансы</h3><p className="mt-1 mb-0 text-xs text-slate-500">Заказы и фактические поступления за выбранный период.</p></div>
				<form onSubmit={applyPeriod} className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-3">
					<label><span className="mb-1 block text-[10px] font-medium text-slate-500">С</span><span className="flex h-9 items-center gap-2 rounded border border-slate-200 px-2"><CalendarDays size={14} className="text-slate-400" /><input required type="date" value={formDates.date_from} max={formDates.date_to || undefined} onChange={(event) => setFormDates((current) => ({ ...current, date_from: event.target.value }))} className="w-[132px] bg-transparent text-[11px] outline-none" /></span></label>
					<label><span className="mb-1 block text-[10px] font-medium text-slate-500">По</span><span className="flex h-9 items-center gap-2 rounded border border-slate-200 px-2"><CalendarDays size={14} className="text-slate-400" /><input required type="date" value={formDates.date_to} min={formDates.date_from || undefined} onChange={(event) => setFormDates((current) => ({ ...current, date_to: event.target.value }))} className="w-[132px] bg-transparent text-[11px] outline-none" /></span></label>
					<button type="submit" disabled={loading || !formDates.date_from || !formDates.date_to || formDates.date_from > formDates.date_to} className="h-9 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">Показать</button>
				</form>
			</div>

			{loading ? (
				<div className="flex min-h-56 items-center justify-center text-sm text-slate-500"><LoaderCircle size={21} className="mr-2 animate-spin" /> Загружаем финансовые данные</div>
			) : error || !report ? (
				<section className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-950"><CircleAlert size={20} className="mt-0.5 shrink-0 text-amber-700" /><div><h4 className="m-0 text-sm font-bold">Не удалось загрузить финансовые данные</h4><p className="mt-1 mb-0 text-xs">Войдите в CRM, чтобы просматривать финансовый отчёт.</p><a className="mt-3 inline-block text-xs font-semibold underline" href={`/api-auth/login/?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`}>Войти</a></div></section>
			) : <>
				<section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Финансовые показатели">
					<article className="rounded-lg border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4"><span className="grid size-8 place-items-center rounded-md bg-blue-100 text-blue-700"><Coins size={17} /></span><p className="mt-2 mb-1 text-xs text-slate-600">Заказов в периоде</p><strong className="font-display text-2xl text-slate-900">{number.format(summary.orders_count)}</strong></article>
					<article className="rounded-lg border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-4"><span className="grid size-8 place-items-center rounded-md bg-sky-100 text-sky-700"><Coins size={17} /></span><p className="mt-2 mb-1 text-xs text-slate-600">Сумма заказов</p><strong className="font-display text-2xl text-slate-900">{money.format(Number(summary.order_total) || 0)}</strong></article>
					<article className="rounded-lg border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4"><span className="grid size-8 place-items-center rounded-md bg-emerald-100 text-emerald-700"><Wallet size={17} /></span><p className="mt-2 mb-1 text-xs text-slate-600">Оплачено по заказам</p><strong className="font-display text-2xl text-slate-900">{money.format(Number(summary.paid_on_orders) || 0)}</strong></article>
					<article className="rounded-lg border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-4"><span className="grid size-8 place-items-center rounded-md bg-amber-100 text-amber-700"><CreditCard size={17} /></span><p className="mt-2 mb-1 text-xs text-slate-600">Остаток долга</p><strong className="font-display text-2xl text-slate-900">{money.format(Number(summary.debt_total) || 0)}</strong></article>
					<article className="rounded-lg border border-teal-100 bg-gradient-to-br from-teal-50 to-white p-4"><span className="grid size-8 place-items-center rounded-md bg-teal-100 text-teal-700"><Wallet size={17} /></span><p className="mt-2 mb-1 text-xs text-slate-600">Получено за период</p><strong className="font-display text-2xl text-slate-900">{money.format(Number(summary.received_in_period) || 0)}</strong></article>
				</section>

				<div className="grid gap-4 xl:grid-cols-[1.35fr_0.85fr]">
					<section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5"><div className="mb-4 flex items-start justify-between gap-3"><div><h4 className="m-0 font-display text-sm font-bold text-slate-900">Поступления по месяцам</h4><p className="mt-1 mb-0 text-[10px] text-slate-500">По дате фактической оплаты</p></div><span className="text-[10px] text-slate-500">{firstChartMonth && lastChartMonth ? `${new Intl.DateTimeFormat('ru-RU', { month: 'short', year: 'numeric' }).format(firstChartMonth)} — ${new Intl.DateTimeFormat('ru-RU', { month: 'short', year: 'numeric' }).format(lastChartMonth)}` : 'Нет поступлений'}</span></div>
						{byMonth.length ? <div className="grid h-52 grid-cols-6 items-end gap-3 border-b border-l border-slate-200 px-3 pb-0 pt-4 sm:grid-cols-8 lg:grid-cols-10">{byMonth.map((item) => { const month = new Date(item.month); const value = Number(item.received) || 0; return <div key={item.month} className="group relative flex h-full min-w-0 flex-col items-center justify-end"><span className="pointer-events-none absolute -top-5 z-10 hidden whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-[9px] text-white group-hover:block">{money.format(value)}</span><div title={money.format(value)} className="w-full max-w-8 rounded-t bg-gradient-to-t from-blue-600 to-blue-400" style={{ height: `${value ? Math.max(8, value / chartMax * 85) : 2}%` }} /><span className="absolute -bottom-5 whitespace-nowrap text-[9px] text-slate-500">{new Intl.DateTimeFormat('ru-RU', { month: 'short' }).format(month).replace('.', '')}</span></div> })}</div> : <div className="grid h-44 place-items-center text-xs text-slate-400">За период нет оплат</div>}
					</section>

					<section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5"><h4 className="m-0 font-display text-sm font-bold text-slate-900">Способы оплаты</h4><p className="mt-1 mb-3 text-[10px] text-slate-500">Поступления с {dateFrom} по {dateTo}</p><div className="divide-y divide-slate-100">{(report.by_method ?? []).map((item) => <div key={item.method} className="flex items-center justify-between gap-3 py-3 text-xs"><span className="text-slate-600">{paymentMethods[item.method] ?? item.method}</span><strong className="text-slate-900">{money.format(Number(item.total) || 0)}</strong></div>)}{!report.by_method?.length && <p className="py-6 text-center text-xs text-slate-400">Поступлений нет</p>}</div></section>
				</div>

				<section className="overflow-hidden rounded-lg border border-slate-200 bg-white"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3"><div><h4 className="m-0 font-display text-sm font-bold text-slate-900">Заказы за период</h4><p className="mt-1 mb-0 text-[10px] text-slate-500">Неотменённые заказы, созданные между выбранными датами</p></div><span className="text-xs text-slate-500">{number.format(summary.orders_count)} заказов</span></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] border-collapse text-left text-xs"><thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-500"><tr>{['№', 'Клиент', 'Изделие', 'Дата', 'Сумма', 'Оплачено', 'Остаток', 'Статус'].map((heading) => <th key={heading} className="whitespace-nowrap px-3 py-3 first:pl-4">{heading}</th>)}</tr></thead><tbody>{report.orders.map((order) => <tr key={order.number} className="border-t border-slate-100 odd:bg-white even:bg-slate-50/60 text-slate-700 hover:bg-blue-50/60"><td className="px-3 py-3 pl-4 font-semibold text-blue-700">{order.number}</td><td className="px-3 py-3">{order.client_name}</td><td className="px-3 py-3">{order.product_name || order.product_type_name}</td><td className="whitespace-nowrap px-3 py-3">{new Intl.DateTimeFormat('ru-RU').format(new Date(order.created_at))}</td><td className="whitespace-nowrap px-3 py-3">{money.format(Number(order.price) || 0)}</td><td className="whitespace-nowrap px-3 py-3">{money.format(Number(order.paid_amount) || 0)}</td><td className="whitespace-nowrap px-3 py-3">{money.format(Number(order.balance) || 0)}</td><td className="px-3 py-3"><span className="rounded bg-slate-100 px-2 py-1 text-[10px]">{orderStatuses[order.status] ?? order.status}</span></td></tr>)}{!report.orders.length && <tr><td colSpan="8" className="px-4 py-12 text-center text-slate-400">Заказов за выбранный период нет</td></tr>}</tbody></table></div></section>
			</>}
		</div>
	)
}

export default FinancePage