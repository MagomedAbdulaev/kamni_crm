import { useEffect, useState } from 'react'
import { BookOpen, CircleAlert, LoaderCircle, Plus, Search, UserRound, X } from 'lucide-react'
import { useLocation, useSearchParams } from 'react-router-dom'
import api from '../api.js'

const number = new Intl.NumberFormat('ru-RU')
const money = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })
const clientOrderStatuses = {
	new: 'Новый',
	in_progress: 'В работе',
	ready: 'Готов',
	issued: 'Выдан',
	cancelled: 'Отменён',
}

const emptyForm = {
	first_name: '',
	last_name: '',
	phone: '',
	is_regular: false,
	comment: '',
}

function ClientsPage() {
	const location = useLocation()
	const [, setSearchParams] = useSearchParams()
	const [clients, setClients] = useState([])
	const [count, setCount] = useState(0)
	const [searchInput, setSearchInput] = useState('')
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const [notice, setNotice] = useState('')
	const [createOpen, setCreateOpen] = useState(false)
	const [selectedClient, setSelectedClient] = useState(null)
	const [form, setForm] = useState(emptyForm)
	const [saving, setSaving] = useState(false)
	const query = new URLSearchParams(location.search)
	const pageNumber = Number(query.get('page') || 1)
	const search = query.get('search') ?? ''

	useEffect(() => {
		let isMounted = true
		api.get(`clients/${location.search}`)
			.then(({ data }) => {
				if (!isMounted) return
				setClients(data.results ?? data)
				setCount(data.count ?? data.length)
			})
			.catch(() => {
				if (isMounted) setError('Не удалось загрузить клиентов. Войдите в CRM и обновите страницу.')
			})
			.finally(() => {
				if (isMounted) setLoading(false)
			})
		return () => {
			isMounted = false
		}
	}, [location.search])

	function submitSearch(event) {
		event.preventDefault()
		setLoading(true)
		setError('')
		const params = new URLSearchParams(location.search)
		const value = searchInput.trim()
		if (value) params.set('search', value)
		else params.delete('search')
		params.delete('page')
		setSearchParams(params)
	}

	function changePage(page) {
		setLoading(true)
		setError('')
		const params = new URLSearchParams(location.search)
		params.set('page', String(page))
		setSearchParams(params)
	}

	async function createClient(event) {
		event.preventDefault()
		setSaving(true)
		setError('')
		setNotice('')
		try {
			const { data } = await api.post('clients/', form)
			setClients((current) => [data, ...current.filter((client) => client.id !== data.id)])
			setCount((current) => current + 1)
			setForm(emptyForm)
			setCreateOpen(false)
			setNotice(`Клиент ${data.first_name} ${data.last_name}`.trim() + ' добавлен.')
		} catch (requestError) {
			const responseData = requestError.response?.data
			const firstError = responseData && Object.values(responseData).flat()[0]
			setError(typeof firstError === 'string' ? firstError : 'Не удалось добавить клиента. Проверьте данные и повторите попытку.')
		} finally {
			setSaving(false)
		}
	}

	const firstRow = count ? (pageNumber - 1) * 30 + 1 : 0
	const lastRow = Math.min(pageNumber * 30, count)
	const loginNext = encodeURIComponent(`${location.pathname}${location.search}`)
	const inputClass = 'h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100'
	const labelClass = 'mb-1.5 block text-[11px] font-medium text-slate-600'

	return (
		<div className="space-y-5">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div><h3 className="m-0 font-display text-2xl font-bold text-slate-900">Клиенты</h3><p className="mt-1 mb-0 text-xs text-slate-500">Карточки клиентов и история взаимоотношений.</p></div>
				<button type="button" onClick={() => { setCreateOpen(true); setError('') }} className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700"><Plus size={15} /> Новый клиент</button>
			</div>

			{notice && <p role="status" className="m-0 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{notice}</p>}
			{error && !createOpen && <div role="alert" className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"><CircleAlert size={16} />{error}<a className="ml-auto font-semibold underline" href={`/api-auth/login/?next=${loginNext}`}>Войти</a></div>}

			<section className="rounded-lg border border-slate-200 bg-white p-4" aria-label="Поиск клиентов">
				<div className="flex flex-wrap items-end justify-between gap-3">
					<form key={search} onSubmit={submitSearch} className="w-full max-w-xl">
						<label htmlFor="client-search" className={labelClass}>Поиск клиента</label>
						<div className="flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
							<Search size={16} className="shrink-0 text-slate-400" />
							<input id="client-search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Имя, фамилия или телефон" className="min-w-0 flex-1 border-0 bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400" />
							<button type="submit" className="rounded bg-blue-600 px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-blue-700">Найти</button>
						</div>
					</form>
					<span className="text-xs text-slate-500">Клиентов: <strong className="text-slate-800">{loading ? '…' : number.format(count)}</strong></span>
				</div>
			</section>

			{loading ? (
				<div className="flex min-h-48 items-center justify-center text-sm text-slate-500"><LoaderCircle size={21} className="mr-2 animate-spin" /> Загружаем клиентов</div>
			) : error && !clients.length ? (
				<div className="rounded-lg border border-slate-200 bg-white p-5 text-xs text-slate-500">Войдите в CRM, чтобы просматривать и добавлять клиентов.</div>
			) : (
				<section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
					<div className="overflow-x-auto">
						<table className="w-full min-w-[700px] border-collapse text-left text-xs">
							<thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-500"><tr>{['Клиент', 'Телефон', 'Заказов', 'Оплачено', 'Тип'].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead>
							<tbody>
								{clients.map((client) => <tr key={client.id} className="border-t border-slate-100 odd:bg-white even:bg-slate-50/60 hover:bg-blue-50/60">
									<td className="px-4 py-3"><div className="flex items-center gap-2.5"><span className="grid size-8 place-items-center rounded-full bg-slate-100 text-slate-500"><UserRound size={16} /></span><button type="button" onClick={() => setSelectedClient(client)} className="text-left font-semibold text-slate-900 hover:text-blue-700 hover:underline">{client.first_name} {client.last_name}</button></div></td>
									<td className="px-4 py-3 whitespace-nowrap">{client.phone}</td>
									<td className="px-4 py-3">{number.format(client.order_count ?? 0)}</td>
									<td className="px-4 py-3 whitespace-nowrap">{money.format(Number(client.total_paid) || 0)}</td>
									<td className="px-4 py-3">{client.is_regular ? <span className="rounded bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700">Постоянный</span> : <span className="text-slate-400">Обычный</span>}</td>
								</tr>)}
								{!clients.length && <tr><td colSpan="5" className="px-4 py-12 text-center text-slate-400">Клиенты не найдены</td></tr>}
							</tbody>
						</table>
					</div>
					<div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-[11px] text-slate-500">
						<span>Показаны {firstRow}–{lastRow} из {number.format(count)}</span>
						<div className="flex items-center gap-2"><button type="button" disabled={pageNumber <= 1 || loading} onClick={() => changePage(pageNumber - 1)} className="h-8 rounded border border-slate-200 px-3 hover:bg-slate-50 disabled:opacity-40">Назад</button><span>Страница {pageNumber}</span><button type="button" disabled={lastRow >= count || loading} onClick={() => changePage(pageNumber + 1)} className="h-8 rounded border border-slate-200 px-3 hover:bg-slate-50 disabled:opacity-40">Далее</button></div>
					</div>
				</section>
			)}

			{selectedClient && <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedClient(null) }}>
				<section role="dialog" aria-modal="true" aria-labelledby="client-card-title" className="max-h-[min(90vh,720px)] w-full max-w-xl overflow-y-auto rounded-lg bg-white p-5 shadow-2xl sm:p-6">
					<div className="mb-5 flex items-start justify-between gap-3 border-b border-slate-100 pb-4"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-blue-50 text-blue-700"><UserRound size={19} /></span><div><h2 id="client-card-title" className="m-0 font-display text-lg font-bold text-slate-900">{selectedClient.first_name} {selectedClient.last_name}</h2><p className="mt-1 mb-0 text-xs text-slate-500">{selectedClient.phone}</p></div></div><button type="button" onClick={() => setSelectedClient(null)} aria-label="Закрыть карточку клиента" className="grid size-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100"><X size={18} /></button></div>
					<div className="grid grid-cols-2 gap-3"><div className="rounded-md bg-slate-50 p-3"><span className="block text-[10px] text-slate-500">Заказов</span><strong className="mt-1 block text-sm text-slate-900">{number.format(selectedClient.order_count ?? 0)}</strong></div><div className="rounded-md bg-slate-50 p-3"><span className="block text-[10px] text-slate-500">Оплачено</span><strong className="mt-1 block text-sm text-slate-900">{money.format(Number(selectedClient.total_paid) || 0)}</strong></div></div>
					{selectedClient.is_regular && <span className="mt-3 inline-flex rounded bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700">Постоянный клиент</span>}
					<section className="mt-5"><h3 className="m-0 text-xs font-semibold text-slate-700">Комментарий</h3><p className="mt-2 mb-0 whitespace-pre-wrap rounded-md border border-slate-100 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">{selectedClient.comment || 'Комментарий не добавлен'}</p></section>
					<section className="mt-5"><div className="mb-2 flex items-center gap-2"><BookOpen size={15} className="text-slate-500" /><h3 className="m-0 text-xs font-semibold text-slate-700">История заказов</h3></div>{selectedClient.order_history?.length ? <ul className="m-0 divide-y divide-slate-100 border-t border-slate-100 p-0">{selectedClient.order_history.map((order) => <li key={order.number} className="flex items-center justify-between gap-3 py-3 text-xs"><div><span className="font-semibold text-slate-800">№{order.number} · {order.product_name || order.product_type_name}</span><span className="mt-1 block text-[10px] text-slate-500">{order.material_name} · {clientOrderStatuses[order.status] ?? order.status}</span></div><span className="shrink-0 text-[10px] text-slate-400">{order.due_date || '—'}</span></li>)}</ul> : <p className="m-0 rounded-md bg-slate-50 p-3 text-xs text-slate-400">Заказов пока нет</p>}</section>
				</section>
			</div>}

			{createOpen && <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreateOpen(false) }}>
				<section role="dialog" aria-modal="true" aria-labelledby="new-client-title" className="max-h-[min(90vh,720px)] w-full max-w-xl overflow-y-auto rounded-lg bg-white p-5 shadow-2xl sm:p-6">
					<div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-3"><div><h2 id="new-client-title" className="m-0 font-display text-lg font-bold text-slate-900">Новый клиент</h2><p className="mt-1 mb-0 text-xs text-slate-500">Имя и телефон обязательны</p></div><button type="button" onClick={() => setCreateOpen(false)} aria-label="Закрыть" className="grid size-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100"><X size={18} /></button></div>
					{error && <p role="alert" className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
					<form onSubmit={createClient} className="space-y-4">
						<div className="grid gap-3 sm:grid-cols-2">
							<label><span className={labelClass}>Имя *</span><input required autoFocus maxLength="100" value={form.first_name} onChange={(event) => setForm((current) => ({ ...current, first_name: event.target.value }))} className={inputClass} /></label>
							<label><span className={labelClass}>Фамилия</span><input maxLength="100" value={form.last_name} onChange={(event) => setForm((current) => ({ ...current, last_name: event.target.value }))} className={inputClass} /></label>
						</div>
						<label className="block"><span className={labelClass}>Телефон *</span><input required type="tel" maxLength="32" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="+7 900 000-00-00" className={inputClass} /></label>
						<label className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={form.is_regular} onChange={(event) => setForm((current) => ({ ...current, is_regular: event.target.checked }))} className="size-4 accent-blue-600" /> Постоянный клиент</label>
						<label className="block"><span className={labelClass}>Комментарий</span><textarea rows="3" value={form.comment} onChange={(event) => setForm((current) => ({ ...current, comment: event.target.value }))} className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
						<div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => setCreateOpen(false)} className="h-9 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50">Отмена</button><button type="submit" disabled={saving} className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{saving && <LoaderCircle size={14} className="animate-spin" />} Добавить клиента</button></div>
					</form>
				</section>
			</div>}
		</div>
	)
}

export default ClientsPage