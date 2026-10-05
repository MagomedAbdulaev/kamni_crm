import { useEffect, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, CircleAlert, LoaderCircle, Plus, Search } from 'lucide-react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import api from '../api.js'

const money = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })
const number = new Intl.NumberFormat('ru-RU')

const statuses = [
	{ value: 'new', label: 'Новый' },
	{ value: 'in_progress', label: 'В работе' },
	{ value: 'ready', label: 'Готов' },
	{ value: 'issued', label: 'Выдан' },
	{ value: 'cancelled', label: 'Отменён' },
]

const statusStyles = {
	new: 'bg-sky-50 text-sky-700',
	in_progress: 'bg-amber-50 text-amber-700',
	ready: 'bg-emerald-50 text-emerald-700',
	issued: 'bg-slate-100 text-slate-600',
	cancelled: 'bg-rose-50 text-rose-700',
}

function OrdersPage() {
	const location = useLocation()
	const [, setSearchParams] = useSearchParams()
	const [result, setResult] = useState({ count: 0, results: [] })
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(false)
	const query = new URLSearchParams(location.search)
	const activeStatus = query.get('status') ?? ''
	const overdueOnly = query.get('overdue') === 'true'
	const pageNumber = Number(query.get('page') || 1)

	useEffect(() => {
		let isMounted = true
		api.get(`orders/${location.search}`)
			.then(({ data }) => {
				if (isMounted) setResult({ count: data.count ?? data.length, results: data.results ?? data })
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

	function updateFilter(name, value) {
		setLoading(true)
		setError(false)
		const next = new URLSearchParams(location.search)
		if (value) next.set(name, value)
		else next.delete(name)
		next.delete('page')
		setSearchParams(next)
	}

	function submitSearch(event) {
		event.preventDefault()
		setLoading(true)
		setError(false)
		const form = new FormData(event.currentTarget)
		const next = new URLSearchParams(location.search)
		const search = String(form.get('q') ?? '').trim()
		if (search) next.set('q', search)
		else next.delete('q')
		next.delete('page')
		setSearchParams(next)
	}

	const loginNext = encodeURIComponent(`${location.pathname}${location.search}`)
	const firstRow = result.count ? (pageNumber - 1) * 30 + 1 : 0
	const lastRow = Math.min(pageNumber * 30, result.count)

	return (
		<div className="space-y-5">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h3 className="m-0 font-display text-2xl font-bold text-slate-900">Заказы</h3>
					<p className="mt-1 mb-0 max-w-3xl text-xs leading-relaxed text-slate-600">
						Новый — заказ создан, но ещё не передан в производство. Просроченными считаются заказы с истёкшим сроком и статусом «Новый» или «В работе».
					</p>
				</div>
				<div className="flex items-center gap-3"><span className="text-xs text-slate-500">Найдено: <strong className="text-slate-800">{loading ? '…' : result.count}</strong></span><Link to="/orders/new" className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white no-underline hover:bg-blue-700"><Plus size={15} /> Новый заказ</Link></div>
			</div>

			<section className="rounded-lg border border-slate-200 bg-white p-4" aria-label="Фильтры заказов">
				<div className="grid gap-3 lg:grid-cols-[minmax(200px,1fr)_190px_auto_minmax(140px,170px)_minmax(140px,170px)] lg:items-end">
					<form key={location.search} onSubmit={submitSearch} className="min-w-0">
						<label htmlFor="order-search" className="mb-1.5 block text-[11px] font-medium text-slate-600">Поиск</label>
						<div className="flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
							<Search size={16} className="shrink-0 text-slate-400" />
							<input id="order-search" name="q" defaultValue={query.get('q') ?? ''} placeholder="Номер, клиент, телефон, изделие" className="min-w-0 flex-1 border-0 bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400" />
							<button className="rounded bg-blue-600 px-2.5 py-1.5 text-[10px] font-semibold text-white hover:bg-blue-700" type="submit">Найти</button>
						</div>
					</form>

					<div>
						<label htmlFor="order-status" className="mb-1.5 block text-[11px] font-medium text-slate-600">Статус</label>
						<select id="order-status" value={activeStatus} onChange={(event) => updateFilter('status', event.target.value)} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
							<option value="">Все статусы</option>
							{statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
						</select>
					</div>

					<label className="flex h-10 items-center gap-2 text-xs text-slate-700">
						<input type="checkbox" checked={overdueOnly} onChange={(event) => updateFilter('overdue', event.target.checked ? 'true' : '')} className="size-4 accent-rose-600" />
						Только просроченные
					</label>

					<div>
						<label htmlFor="date-from" className="mb-1.5 block text-[11px] font-medium text-slate-600">Создан с</label>
						<div className="flex h-10 items-center gap-2 rounded-md border border-slate-200 px-2.5 focus-within:border-blue-400">
							<CalendarDays size={15} className="shrink-0 text-slate-400" />
							<input id="date-from" type="date" value={query.get('date_from') ?? ''} onChange={(event) => updateFilter('date_from', event.target.value)} className="min-w-0 w-full bg-transparent text-[11px] text-slate-700 outline-none" />
						</div>
					</div>

					<div>
						<label htmlFor="date-to" className="mb-1.5 block text-[11px] font-medium text-slate-600">Создан по</label>
						<div className="flex h-10 items-center gap-2 rounded-md border border-slate-200 px-2.5 focus-within:border-blue-400">
							<CalendarDays size={15} className="shrink-0 text-slate-400" />
							<input id="date-to" type="date" value={query.get('date_to') ?? ''} onChange={(event) => updateFilter('date_to', event.target.value)} className="min-w-0 w-full bg-transparent text-[11px] text-slate-700 outline-none" />
						</div>
					</div>
				</div>
			</section>

			{loading ? (
				<div className="flex min-h-48 items-center justify-center text-sm text-slate-500"><LoaderCircle size={21} className="mr-2 animate-spin" /> Загружаем заказы</div>
			) : error ? (
				<section className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-950">
					<div className="flex items-start gap-3"><CircleAlert size={20} className="mt-0.5 shrink-0 text-amber-700" /><div><h3 className="m-0 text-sm font-bold">Не удалось загрузить заказы</h3><p className="mt-1 mb-3 text-xs">Войдите в CRM, чтобы просматривать список.</p><a className="text-xs font-semibold text-amber-900 underline" href={`/api-auth/login/?next=${loginNext}`}>Войти</a></div></div>
				</section>
			) : (
				<section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
					<div className="overflow-x-auto">
						<table className="w-full min-w-[920px] border-collapse text-left text-xs">
							<thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-500"><tr>{['№', 'Клиент', 'Изделие', 'Материал', 'Стоимость', 'Оплачено', 'Остаток', 'Срок', 'Статус'].map((heading) => <th key={heading} className="whitespace-nowrap px-3 py-3 first:pl-4">{heading}</th>)}</tr></thead>
							<tbody>
								{result.results.map((order) => {
									const currentStatus = statuses.find((status) => status.value === order.status)
									return <tr key={order.number} className="border-t border-slate-100 odd:bg-white even:bg-slate-50/60 text-slate-700 hover:bg-blue-50/60">
										<td className="px-3 py-3 pl-4 font-semibold"><Link className="text-blue-700 hover:underline" to={`/orders/${order.number}`}>{order.number}</Link></td>
										<td className="px-3 py-3">{order.client_name}</td>
										<td className="px-3 py-3"><div className="font-medium text-slate-800">{order.product_name || order.product_type_name}</div><div className="mt-0.5 text-[10px] text-slate-400">{order.product_type_name}</div></td>
										<td className="px-3 py-3">{order.material_name}</td>
										<td className="whitespace-nowrap px-3 py-3">{money.format(Number(order.price) || 0)}</td>
										<td className="whitespace-nowrap px-3 py-3">{money.format(Number(order.paid_amount) || 0)}</td>
										<td className="whitespace-nowrap px-3 py-3">{money.format(Number(order.balance) || 0)}</td>
										<td className="whitespace-nowrap px-3 py-3">{order.due_date ? new Intl.DateTimeFormat('ru-RU').format(new Date(`${order.due_date}T00:00:00`)) : '—'}</td>
										<td className="px-3 py-3"><span className={`inline-flex whitespace-nowrap rounded px-2 py-1 text-[10px] font-semibold ${statusStyles[order.status] ?? 'bg-slate-100 text-slate-600'}`}>{currentStatus?.label ?? order.status}</span></td>
									</tr>
								})}
								{!result.results.length && <tr><td colSpan="9" className="px-4 py-14 text-center text-slate-400">Заказы по выбранным условиям не найдены</td></tr>}
							</tbody>
						</table>
					</div>
					<div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-[11px] text-slate-500">
						<span>Показаны {firstRow}–{lastRow} из {number.format(result.count)}</span>
						<div className="flex items-center gap-2">
							<button type="button" disabled={pageNumber <= 1 || loading} onClick={() => updateFilter('page', String(pageNumber - 1))} className="inline-flex h-8 items-center gap-1 rounded border border-slate-200 px-2.5 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={14} /> Назад</button>
							<span>Страница {pageNumber}</span>
							<button type="button" disabled={lastRow >= result.count || loading} onClick={() => updateFilter('page', String(pageNumber + 1))} className="inline-flex h-8 items-center gap-1 rounded border border-slate-200 px-2.5 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Далее <ChevronRight size={14} /></button>
						</div>
					</div>
				</section>
			)}
		</div>
	)
}

export default OrdersPage