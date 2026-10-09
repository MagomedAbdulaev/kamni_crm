import { useEffect, useState } from 'react'
import { CircleAlert, LoaderCircle, Pencil, Plus, Search, Trash2, UserRound, X } from 'lucide-react'
import api from '../api.js'

const roleLabels = { admin: 'Администратор', manager: 'Менеджер' }
const categories = { granite: 'Гранит', marble: 'Мрамор', quartz: 'Кварц', quartzite: 'Кварцит', other: 'Другой' }

const directories = {
	materials: { label: 'Материалы', endpoint: 'materials/', singular: 'материал', placeholder: 'Например, Белый Каррара', material: true },
	'product-types': { label: 'Типы изделий', endpoint: 'product-types/', singular: 'тип изделия', placeholder: 'Например, Столешница' },
	'processing-types': { label: 'Виды обработки', endpoint: 'processing-types/', singular: 'вид обработки', placeholder: 'Например, Полировка' },
}

const inputClass = 'h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100'
const labelClass = 'mb-1.5 block text-[11px] font-medium text-slate-600'

function errorText(requestError, fallback) {
	if (requestError.response?.status === 403) return 'Менять справочники может только администратор.'
	if (requestError.response?.status === 409) return requestError.response.data?.detail ?? 'Запись используется в заказах и не может быть удалена. Отключите её.'
	const data = requestError.response?.data
	const message = data && typeof data === 'object' ? Object.values(data).flat()[0] : null
	return typeof message === 'string' ? message : fallback
}

function ProfileTab({ me }) {
	const name = [me.first_name, me.last_name].filter(Boolean).join(' ') || me.username
	const rows = [['Логин', me.username], ['Email', me.email || '—'], ['Роль', roleLabels[me.role] ?? '—']]
	return (
		<section className="max-w-xl rounded-lg border border-slate-200 bg-white p-5">
			<div className="flex items-center gap-3 border-b border-slate-100 pb-4"><span className="grid size-12 place-items-center rounded-full bg-blue-50 text-blue-700"><UserRound size={22} /></span><div><h4 className="m-0 font-display text-lg font-bold text-slate-900">{name}</h4><p className="mt-0.5 mb-0 text-xs text-slate-500">{roleLabels[me.role] ?? 'Сотрудник'}</p></div></div>
			<dl className="m-0 divide-y divide-slate-100">{rows.map(([term, value]) => <div key={term} className="flex items-center justify-between gap-3 py-3 text-xs"><dt className="text-slate-500">{term}</dt><dd className="m-0 font-medium text-slate-900">{value}</dd></div>)}</dl>
		</section>
	)
}

function Directory({ config, isAdmin }) {
	const emptyForm = { id: null, name: '', category: 'granite', thickness_mm: '', is_active: true }
	const [items, setItems] = useState([])
	const [search, setSearch] = useState('')
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const [notice, setNotice] = useState('')
	const [form, setForm] = useState(null)
	const [formError, setFormError] = useState('')
	const [saving, setSaving] = useState(false)
	const [toDelete, setToDelete] = useState(null)
	const [deleting, setDeleting] = useState(false)
	const title = (item) => (config.material ? `${categories[item.category] ?? item.category} — ${item.name}` : item.name)

	useEffect(() => {
		let isMounted = true
		api.get(config.endpoint)
			.then(({ data }) => {
				if (isMounted) setItems(data.results ?? data)
			})
			.catch(() => {
				if (isMounted) setError('Не удалось загрузить данные. Войдите в CRM и обновите страницу.')
			})
			.finally(() => {
				if (isMounted) setLoading(false)
			})
		return () => {
			isMounted = false
		}
	}, [config.endpoint])

	function openForm(item) {
		setForm(item ? { id: item.id, name: item.name, category: item.category ?? 'granite', thickness_mm: item.thickness_mm ?? '', is_active: item.is_active } : emptyForm)
		setFormError('')
	}

	async function saveItem(event) {
		event.preventDefault()
		setSaving(true)
		setFormError('')
		const payload = { name: form.name.trim(), is_active: form.is_active }
		if (config.material) Object.assign(payload, { category: form.category, thickness_mm: form.thickness_mm === '' ? null : Number(form.thickness_mm) })
		try {
			const { data } = form.id ? await api.patch(`${config.endpoint}${form.id}/`, payload) : await api.post(config.endpoint, payload)
			setItems((current) => (form.id ? current.map((item) => (item.id === data.id ? data : item)) : [...current, data]))
			setNotice(`«${title(data)}» сохранён.`)
			setForm(null)
		} catch (requestError) {
			setFormError(errorText(requestError, 'Не удалось сохранить. Проверьте данные и повторите попытку.'))
		} finally {
			setSaving(false)
		}
	}

	async function toggleActive(item) {
		setError('')
		try {
			const { data } = await api.patch(`${config.endpoint}${item.id}/`, { is_active: !item.is_active })
			setItems((current) => current.map((row) => (row.id === data.id ? data : row)))
		} catch (requestError) {
			setError(errorText(requestError, 'Не удалось изменить статус.'))
		}
	}

	async function deleteItem() {
		setDeleting(true)
		setError('')
		try {
			await api.delete(`${config.endpoint}${toDelete.id}/`)
			setItems((current) => current.filter((item) => item.id !== toDelete.id))
			setNotice(`«${title(toDelete)}» удалён.`)
		} catch (requestError) {
			setError(errorText(requestError, 'Не удалось удалить запись.'))
		} finally {
			setDeleting(false)
			setToDelete(null)
		}
	}

	const query = search.trim().toLowerCase()
	const visible = items.filter((item) => title(item).toLowerCase().includes(query))
	const columns = config.material ? ['Категория', 'Название', 'Толщина', 'Статус'] : ['Название', 'Статус']

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex h-10 w-full max-w-sm items-center gap-2 rounded-md border border-slate-200 bg-white px-3 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100"><Search size={16} className="shrink-0 text-slate-400" /><input aria-label="Поиск" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск" className="min-w-0 flex-1 border-0 bg-transparent text-xs outline-none placeholder:text-slate-400" /></div>
				{isAdmin && <button type="button" onClick={() => openForm(null)} className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700"><Plus size={15} /> Добавить</button>}
			</div>
			{notice && <p role="status" className="m-0 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{notice}</p>}
			{error && <div role="alert" className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"><CircleAlert size={16} className="shrink-0" />{error}</div>}

			{loading ? <div className="flex min-h-40 items-center justify-center text-sm text-slate-500"><LoaderCircle size={21} className="mr-2 animate-spin" /> Загружаем</div> : (
				<section className="overflow-hidden rounded-lg border border-slate-200 bg-white"><div className="overflow-x-auto">
					<table className="w-full min-w-[480px] border-collapse text-left text-xs">
						<thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-500"><tr>{columns.map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}{isAdmin && <th className="px-4 py-3 text-right">Действия</th>}</tr></thead>
						<tbody>
							{visible.map((item) => <tr key={item.id} className="border-t border-slate-100 odd:bg-white even:bg-slate-50/60 hover:bg-blue-50/60">
								{config.material && <td className="px-4 py-3 text-slate-600">{categories[item.category] ?? item.category}</td>}
								<td className={`px-4 py-3 font-semibold ${item.is_active ? 'text-slate-900' : 'text-slate-400'}`}>{item.name}</td>
								{config.material && <td className="px-4 py-3 text-slate-600">{item.thickness_mm ? `${item.thickness_mm} мм` : '—'}</td>}
								<td className="px-4 py-3">{item.is_active ? <span className="rounded bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">Активен</span> : <span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">Отключён</span>}</td>
								{isAdmin && <td className="px-4 py-3"><div className="flex items-center justify-end gap-1">
									<button type="button" onClick={() => toggleActive(item)} className="h-8 rounded border border-slate-200 px-2.5 text-[11px] text-slate-600 hover:bg-slate-50">{item.is_active ? 'Отключить' : 'Включить'}</button>
									<button type="button" onClick={() => openForm(item)} aria-label={`Изменить «${title(item)}»`} className="grid size-8 place-items-center rounded text-slate-500 hover:bg-slate-100"><Pencil size={15} /></button>
									<button type="button" onClick={() => setToDelete(item)} aria-label={`Удалить «${title(item)}»`} className="grid size-8 place-items-center rounded text-rose-500 hover:bg-rose-50"><Trash2 size={15} /></button>
								</div></td>}
							</tr>)}
							{!visible.length && <tr><td colSpan={columns.length + (isAdmin ? 1 : 0)} className="px-4 py-12 text-center text-slate-400">{items.length ? 'Ничего не найдено' : 'Пока ничего нет'}</td></tr>}
						</tbody>
					</table>
				</div></section>
			)}

			{form && <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setForm(null) }}>
				<section role="dialog" aria-modal="true" aria-label={form.id ? 'Изменить' : 'Добавить'} className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl sm:p-6">
					<div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-3"><h2 className="m-0 font-display text-lg font-bold text-slate-900">{form.id ? 'Изменить' : 'Добавить'}: {config.singular}</h2><button type="button" onClick={() => setForm(null)} aria-label="Закрыть" className="grid size-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100"><X size={18} /></button></div>
					{formError && <p role="alert" className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{formError}</p>}
					<form onSubmit={saveItem} className="space-y-4">
						{config.material && <label className="block"><span className={labelClass}>Категория *</span><select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className={inputClass}>{Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
						<label className="block"><span className={labelClass}>Название *</span><input required autoFocus maxLength={config.material ? 120 : 100} value={form.name} placeholder={config.placeholder} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className={inputClass} /></label>
						{config.material && <label className="block"><span className={labelClass}>Толщина, мм</span><input type="number" min="1" step="1" value={form.thickness_mm} onChange={(event) => setForm((current) => ({ ...current, thickness_mm: event.target.value }))} className={inputClass} /></label>}
						<label className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} className="size-4 accent-blue-600" /> Активен (доступен при создании заказа)</label>
						<div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => setForm(null)} className="h-9 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50">Отмена</button><button type="submit" disabled={saving || !form.name.trim()} className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{saving && <LoaderCircle size={14} className="animate-spin" />} Сохранить</button></div>
					</form>
				</section>
			</div>}

			{toDelete && <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) setToDelete(null) }}>
				<section role="alertdialog" aria-modal="true" aria-label="Подтверждение удаления" className="w-full max-w-sm rounded-lg bg-white p-5 shadow-2xl">
					<h2 className="m-0 font-display text-base font-bold text-slate-900">Удалить «{title(toDelete)}»?</h2>
					<p className="mt-2 mb-0 text-xs text-slate-500">Если запись уже есть в заказах, удалить её не получится. В этом случае просто отключите её.</p>
					<div className="mt-5 flex justify-end gap-2"><button type="button" disabled={deleting} onClick={() => setToDelete(null)} className="h-9 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50">Отмена</button><button type="button" disabled={deleting} onClick={deleteItem} className="inline-flex h-9 items-center gap-2 rounded-md bg-rose-600 px-3 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60">{deleting && <LoaderCircle size={14} className="animate-spin" />} Удалить</button></div>
				</section>
			</div>}
		</div>
	)
}

function SettingsPage() {
	const [me, setMe] = useState(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(false)
	const [tab, setTab] = useState('profile')

	useEffect(() => {
		let isMounted = true
		api.get('auth/me/')
			.then(({ data }) => {
				if (isMounted) setMe(data)
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

	const tabs = [['profile', 'Профиль'], ...Object.entries(directories).map(([key, value]) => [key, value.label])]

	return (
		<div className="space-y-5">
			<div><h3 className="m-0 font-display text-2xl font-bold text-slate-900">Настройки</h3><p className="mt-1 mb-0 text-xs text-slate-500">Ваш профиль и справочники, из которых выбираются данные при создании заказа.</p></div>
			{loading ? (
				<div className="flex min-h-48 items-center justify-center text-sm text-slate-500"><LoaderCircle size={21} className="mr-2 animate-spin" /> Загружаем настройки</div>
			) : error || !me ? (
				<section className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-950"><CircleAlert size={20} className="mt-0.5 shrink-0 text-amber-700" /><div><h4 className="m-0 text-sm font-bold">Не удалось загрузить настройки</h4><p className="mt-1 mb-0 text-xs">Войдите в CRM и обновите страницу.</p></div></section>
			) : <>
				<div role="tablist" className="flex gap-1 overflow-x-auto border-b border-slate-200">{tabs.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-xs font-semibold ${tab === key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{label}</button>)}</div>
				{tab === 'profile' ? <ProfileTab me={me} /> : <Directory key={tab} config={directories[tab]} isAdmin={me.role === 'admin'} />}
			</>}
		</div>
	)
}

export default SettingsPage