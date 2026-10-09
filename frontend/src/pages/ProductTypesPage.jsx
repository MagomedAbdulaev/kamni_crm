import { useEffect, useState } from 'react'
import { CircleAlert, LoaderCircle, Package, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import api from '../api.js'

const number = new Intl.NumberFormat('ru-RU')
const emptyForm = { id: null, name: '', is_active: true }

function firstError(requestError, fallback) {
	const data = requestError.response?.data
	const value = data && typeof data === 'object' ? Object.values(data).flat()[0] : null
	return typeof value === 'string' ? value : fallback
}

function ProductTypesPage() {
	const location = useLocation()
	const [items, setItems] = useState([])
	const [isAdmin, setIsAdmin] = useState(false)
	const [search, setSearch] = useState('')
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const [notice, setNotice] = useState('')
	const [form, setForm] = useState(null)
	const [formError, setFormError] = useState('')
	const [saving, setSaving] = useState(false)
	const [toDelete, setToDelete] = useState(null)
	const [deleting, setDeleting] = useState(false)

	useEffect(() => {
		let isMounted = true
		Promise.all([api.get('product-types/'), api.get('auth/me/')])
			.then(([{ data }, { data: me }]) => {
				if (!isMounted) return
				setItems(data.results ?? data)
				setIsAdmin(Boolean(me)) // флаг «можно редактировать»: менеджеры тоже могут менять справочник
			})
			.catch(() => {
				if (isMounted) setError('Не удалось загрузить типы изделий. Войдите в CRM и обновите страницу.')
			})
			.finally(() => {
				if (isMounted) setLoading(false)
			})
		return () => {
			isMounted = false
		}
	}, [])

	function openForm(item) {
		setForm(item ? { id: item.id, name: item.name, is_active: item.is_active } : emptyForm)
		setFormError('')
	}

	async function saveItem(event) {
		event.preventDefault()
		setSaving(true)
		setFormError('')
		const payload = { name: form.name.trim(), is_active: form.is_active }
		try {
			if (form.id) {
				const { data } = await api.patch(`product-types/${form.id}/`, payload)
				setItems((current) => current.map((item) => (item.id === data.id ? data : item)))
				setNotice(`Тип «${data.name}» сохранён.`)
			} else {
				const { data } = await api.post('product-types/', payload)
				setItems((current) => [...current, data])
				setNotice(`Тип «${data.name}» добавлен.`)
			}
			setForm(null)
		} catch (requestError) {
			setFormError(firstError(requestError, 'Не удалось сохранить тип изделия. Проверьте данные и повторите попытку.'))
		} finally {
			setSaving(false)
		}
	}

	async function toggleActive(item) {
		setError('')
		setNotice('')
		try {
			const { data } = await api.patch(`product-types/${item.id}/`, { is_active: !item.is_active })
			setItems((current) => current.map((row) => (row.id === data.id ? data : row)))
		} catch (requestError) {
			setError(firstError(requestError, 'Не удалось изменить статус типа изделия.'))
		}
	}

	async function deleteItem() {
		setDeleting(true)
		setError('')
		try {
			await api.delete(`product-types/${toDelete.id}/`)
			setItems((current) => current.filter((item) => item.id !== toDelete.id))
			setNotice(`Тип «${toDelete.name}» удалён.`)
		} catch (requestError) {
			setError(
				requestError.response?.status === 409
					? 'Тип используется в заказах и не может быть удалён. Отключите его, чтобы скрыть из списка выбора.'
					: firstError(requestError, 'Не удалось удалить тип изделия.'),
			)
		} finally {
			setDeleting(false)
			setToDelete(null)
		}
	}

	const query = search.trim().toLowerCase()
	const visible = items.filter((item) => item.name.toLowerCase().includes(query))
	const activeCount = items.filter((item) => item.is_active).length
	const loginNext = encodeURIComponent(`${location.pathname}${location.search}`)
	const inputClass = 'h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100'
	const labelClass = 'mb-1.5 block text-[11px] font-medium text-slate-600'

	return (
		<div className="space-y-5">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div><h3 className="m-0 font-display text-2xl font-bold text-slate-900">Типы изделий</h3><p className="mt-1 mb-0 text-xs text-slate-500">Справочник изделий, которые выбираются при создании заказа.</p></div>
				{isAdmin && <button type="button" onClick={() => openForm(null)} className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700"><Plus size={15} /> Новый тип</button>}
			</div>

			{notice && <p role="status" className="m-0 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{notice}</p>}
			{error && <div role="alert" className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"><CircleAlert size={16} className="shrink-0" />{error}{!items.length && <a className="ml-auto font-semibold underline" href={`/api-auth/login/?next=${loginNext}`}>Войти</a>}</div>}

			<section className="rounded-lg border border-slate-200 bg-white p-4" aria-label="Поиск типов изделий">
				<div className="flex flex-wrap items-end justify-between gap-3">
					<div className="w-full max-w-xl">
						<label htmlFor="product-type-search" className={labelClass}>Поиск по названию</label>
						<div className="flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
							<Search size={16} className="shrink-0 text-slate-400" />
							<input id="product-type-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Например, столешница" className="min-w-0 flex-1 border-0 bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400" />
						</div>
					</div>
					<span className="text-xs text-slate-500">Всего: <strong className="text-slate-800">{loading ? '…' : number.format(items.length)}</strong>, активных: <strong className="text-slate-800">{loading ? '…' : number.format(activeCount)}</strong></span>
				</div>
			</section>

			{loading ? (
				<div className="flex min-h-48 items-center justify-center text-sm text-slate-500"><LoaderCircle size={21} className="mr-2 animate-spin" /> Загружаем типы изделий</div>
			) : (
				<section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
					<div className="overflow-x-auto">
						<table className="w-full min-w-[520px] border-collapse text-left text-xs">
							<thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-500"><tr><th className="px-4 py-3">Название</th><th className="px-4 py-3">Статус</th>{isAdmin && <th className="px-4 py-3 text-right">Действия</th>}</tr></thead>
							<tbody>
								{visible.map((item) => <tr key={item.id} className="border-t border-slate-100 odd:bg-white even:bg-slate-50/60 hover:bg-blue-50/60">
									<td className="px-4 py-3"><div className="flex items-center gap-2.5"><span className="grid size-8 place-items-center rounded-md bg-slate-100 text-slate-500"><Package size={16} /></span><span className={`font-semibold ${item.is_active ? 'text-slate-900' : 'text-slate-400'}`}>{item.name}</span></div></td>
									<td className="px-4 py-3">{item.is_active ? <span className="rounded bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">Активен</span> : <span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">Отключён</span>}</td>
									{isAdmin && <td className="px-4 py-3"><div className="flex items-center justify-end gap-1">
										<button type="button" onClick={() => toggleActive(item)} className="h-8 rounded border border-slate-200 px-2.5 text-[11px] text-slate-600 hover:bg-slate-50">{item.is_active ? 'Отключить' : 'Включить'}</button>
										<button type="button" onClick={() => openForm(item)} aria-label={`Изменить «${item.name}»`} className="grid size-8 place-items-center rounded text-slate-500 hover:bg-slate-100"><Pencil size={15} /></button>
										<button type="button" onClick={() => setToDelete(item)} aria-label={`Удалить «${item.name}»`} className="grid size-8 place-items-center rounded text-rose-500 hover:bg-rose-50"><Trash2 size={15} /></button>
									</div></td>}
								</tr>)}
								{!visible.length && <tr><td colSpan={isAdmin ? 3 : 2} className="px-4 py-12 text-center text-slate-400">{items.length ? 'Ничего не найдено' : 'Типов изделий пока нет'}</td></tr>}
							</tbody>
						</table>
					</div>
				</section>
			)}

			{form && <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setForm(null) }}>
				<section role="dialog" aria-modal="true" aria-labelledby="product-type-title" className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl sm:p-6">
					<div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-3"><h2 id="product-type-title" className="m-0 font-display text-lg font-bold text-slate-900">{form.id ? 'Изменить тип изделия' : 'Новый тип изделия'}</h2><button type="button" onClick={() => setForm(null)} aria-label="Закрыть" className="grid size-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100"><X size={18} /></button></div>
					{formError && <p role="alert" className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{formError}</p>}
					<form onSubmit={saveItem} className="space-y-4">
						<label className="block"><span className={labelClass}>Название *</span><input required autoFocus maxLength="100" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className={inputClass} /></label>
						<label className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} className="size-4 accent-blue-600" /> Активен (доступен при создании заказа)</label>
						<div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => setForm(null)} className="h-9 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50">Отмена</button><button type="submit" disabled={saving || !form.name.trim()} className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{saving && <LoaderCircle size={14} className="animate-spin" />} Сохранить</button></div>
					</form>
				</section>
			</div>}

			{toDelete && <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) setToDelete(null) }}>
				<section role="alertdialog" aria-modal="true" aria-labelledby="delete-title" className="w-full max-w-sm rounded-lg bg-white p-5 shadow-2xl">
					<h2 id="delete-title" className="m-0 font-display text-base font-bold text-slate-900">Удалить «{toDelete.name}»?</h2>
					<p className="mt-2 mb-0 text-xs text-slate-500">Если тип уже есть в заказах, удалить его не получится. В этом случае просто отключите его.</p>
					<div className="mt-5 flex justify-end gap-2"><button type="button" disabled={deleting} onClick={() => setToDelete(null)} className="h-9 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50">Отмена</button><button type="button" disabled={deleting} onClick={deleteItem} className="inline-flex h-9 items-center gap-2 rounded-md bg-rose-600 px-3 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60">{deleting && <LoaderCircle size={14} className="animate-spin" />} Удалить</button></div>
				</section>
			</div>}
		</div>
	)
}

export default ProductTypesPage