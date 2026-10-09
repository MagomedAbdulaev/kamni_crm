import { useEffect, useState } from 'react'
import { CircleAlert, Eye, EyeOff, LoaderCircle, Pencil, Plus, Search, UserCheck, UserRound, UserX, X } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import api from '../api.js'

const number = new Intl.NumberFormat('ru-RU')
const emptyForm = { id: null, username: '', first_name: '', last_name: '', email: '', password: '', is_active: true }

function errorText(requestError, fallback) {
	if (requestError.response?.status === 403) return 'Управлять менеджерами может только администратор.'
	const data = requestError.response?.data
	if (data && typeof data === 'object') {
		const [field, messages] = Object.entries(data)[0] ?? []
		const message = [].concat(messages ?? [])[0]
		if (typeof message === 'string') return field === 'detail' || field === 'non_field_errors' ? message : `${message}`
	}
	return fallback
}

function fullName(manager) {
	return [manager.first_name, manager.last_name].filter(Boolean).join(' ') || manager.username
}

function ManagersPage() {
	const location = useLocation()
	const [managers, setManagers] = useState([])
	const [search, setSearch] = useState('')
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const [forbidden, setForbidden] = useState(false)
	const [notice, setNotice] = useState('')
	const [form, setForm] = useState(null)
	const [formError, setFormError] = useState('')
	const [showPassword, setShowPassword] = useState(false)
	const [saving, setSaving] = useState(false)
	const [toBlock, setToBlock] = useState(null)
	const [blocking, setBlocking] = useState(false)

	useEffect(() => {
		let isMounted = true
		api.get('managers/')
			.then(({ data }) => {
				if (isMounted) setManagers(data.results ?? data)
			})
			.catch((requestError) => {
				if (!isMounted) return
				if (requestError.response?.status === 403) setForbidden(true)
				else setError('Не удалось загрузить менеджеров. Войдите в CRM и обновите страницу.')
			})
			.finally(() => {
				if (isMounted) setLoading(false)
			})
		return () => {
			isMounted = false
		}
	}, [])

	function replaceManager(data) {
		setManagers((current) => (current.some((item) => item.id === data.id) ? current.map((item) => (item.id === data.id ? data : item)) : [data, ...current]))
	}

	function openForm(manager) {
		setForm(manager ? { ...emptyForm, id: manager.id, username: manager.username, first_name: manager.first_name, last_name: manager.last_name, email: manager.email, is_active: manager.is_active } : emptyForm)
		setFormError('')
		setShowPassword(false)
	}

	async function saveManager(event) {
		event.preventDefault()
		setSaving(true)
		setFormError('')
		const payload = { username: form.username.trim(), first_name: form.first_name.trim(), last_name: form.last_name.trim(), email: form.email.trim(), is_active: form.is_active }
		if (form.password) payload.password = form.password
		try {
			const { data } = form.id ? await api.patch(`managers/${form.id}/`, payload) : await api.post('managers/', payload)
			replaceManager(data)
			setNotice(form.id ? `Данные менеджера ${fullName(data)} сохранены.` : `Менеджер ${fullName(data)} создан.`)
			setForm(null)
		} catch (requestError) {
			setFormError(errorText(requestError, 'Не удалось сохранить менеджера. Проверьте данные и повторите попытку.'))
		} finally {
			setSaving(false)
		}
	}

	async function blockManager() {
		setBlocking(true)
		setError('')
		try {
			const { data } = await api.delete(`managers/${toBlock.id}/`)
			replaceManager(data)
			setNotice(`Менеджер ${fullName(data)} заблокирован.`)
		} catch (requestError) {
			setError(errorText(requestError, 'Не удалось заблокировать менеджера.'))
		} finally {
			setBlocking(false)
			setToBlock(null)
		}
	}

	async function unblockManager(manager) {
		setError('')
		try {
			const { data } = await api.patch(`managers/${manager.id}/`, { is_active: true })
			replaceManager(data)
			setNotice(`Менеджер ${fullName(data)} разблокирован.`)
		} catch (requestError) {
			setError(errorText(requestError, 'Не удалось разблокировать менеджера.'))
		}
	}

	const query = search.trim().toLowerCase()
	const visible = managers.filter((item) => `${item.username} ${item.first_name} ${item.last_name} ${item.email}`.toLowerCase().includes(query))
	const activeCount = managers.filter((item) => item.is_active).length
	const loginNext = encodeURIComponent(`${location.pathname}${location.search}`)
	const inputClass = 'h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100'
	const labelClass = 'mb-1.5 block text-[11px] font-medium text-slate-600'
	const setField = (name) => (event) => setForm((current) => ({ ...current, [name]: event.target.value }))

	if (forbidden) {
		return <section className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-950"><CircleAlert size={20} className="mt-0.5 shrink-0 text-amber-700" /><div><h4 className="m-0 text-sm font-bold">Нет доступа</h4><p className="mt-1 mb-0 text-xs">Раздел «Менеджеры» доступен только администратору.</p></div></section>
	}

	return (
		<div className="space-y-5">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div><h3 className="m-0 font-display text-2xl font-bold text-slate-900">Менеджеры</h3><p className="mt-1 mb-0 text-xs text-slate-500">Сотрудники, у которых есть доступ к CRM.</p></div>
				<button type="button" onClick={() => openForm(null)} className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700"><Plus size={15} /> Новый менеджер</button>
			</div>

			{notice && <p role="status" className="m-0 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{notice}</p>}
			{error && <div role="alert" className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"><CircleAlert size={16} className="shrink-0" />{error}{!managers.length && <a className="ml-auto font-semibold underline" href={`/api-auth/login/?next=${loginNext}`}>Войти</a>}</div>}

			<section className="rounded-lg border border-slate-200 bg-white p-4" aria-label="Поиск менеджеров">
				<div className="flex flex-wrap items-end justify-between gap-3">
					<div className="w-full max-w-xl">
						<label htmlFor="manager-search" className={labelClass}>Поиск менеджера</label>
						<div className="flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
							<Search size={16} className="shrink-0 text-slate-400" />
							<input id="manager-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Имя, логин или email" className="min-w-0 flex-1 border-0 bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400" />
						</div>
					</div>
					<span className="text-xs text-slate-500">Всего: <strong className="text-slate-800">{loading ? '…' : number.format(managers.length)}</strong>, активных: <strong className="text-slate-800">{loading ? '…' : number.format(activeCount)}</strong></span>
				</div>
			</section>

			{loading ? (
				<div className="flex min-h-48 items-center justify-center text-sm text-slate-500"><LoaderCircle size={21} className="mr-2 animate-spin" /> Загружаем менеджеров</div>
			) : (
				<section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
					<div className="overflow-x-auto">
						<table className="w-full min-w-[680px] border-collapse text-left text-xs">
							<thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-500"><tr>{['Сотрудник', 'Логин', 'Email', 'Статус'].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}<th className="px-4 py-3 text-right">Действия</th></tr></thead>
							<tbody>
								{visible.map((manager) => <tr key={manager.id} className="border-t border-slate-100 odd:bg-white even:bg-slate-50/60 hover:bg-blue-50/60">
									<td className="px-4 py-3"><div className="flex items-center gap-2.5"><span className="grid size-8 place-items-center rounded-full bg-slate-100 text-slate-500"><UserRound size={16} /></span><span className={`font-semibold ${manager.is_active ? 'text-slate-900' : 'text-slate-400'}`}>{fullName(manager)}</span></div></td>
									<td className="px-4 py-3 text-slate-600">{manager.username}</td>
									<td className="px-4 py-3 text-slate-600">{manager.email || <span className="text-slate-300">—</span>}</td>
									<td className="px-4 py-3">{manager.is_active ? <span className="rounded bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">Активен</span> : <span className="rounded bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-600">Заблокирован</span>}</td>
									<td className="px-4 py-3"><div className="flex items-center justify-end gap-1">
										<button type="button" onClick={() => openForm(manager)} aria-label={`Изменить ${fullName(manager)}`} className="grid size-8 place-items-center rounded text-slate-500 hover:bg-slate-100"><Pencil size={15} /></button>
										{manager.is_active
											? <button type="button" onClick={() => setToBlock(manager)} aria-label={`Заблокировать ${fullName(manager)}`} className="grid size-8 place-items-center rounded text-rose-500 hover:bg-rose-50"><UserX size={16} /></button>
											: <button type="button" onClick={() => unblockManager(manager)} aria-label={`Разблокировать ${fullName(manager)}`} className="grid size-8 place-items-center rounded text-emerald-600 hover:bg-emerald-50"><UserCheck size={16} /></button>}
									</div></td>
								</tr>)}
								{!visible.length && <tr><td colSpan="5" className="px-4 py-12 text-center text-slate-400">{managers.length ? 'Ничего не найдено' : 'Менеджеров пока нет'}</td></tr>}
							</tbody>
						</table>
					</div>
				</section>
			)}

			{form && <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setForm(null) }}>
				<section role="dialog" aria-modal="true" aria-labelledby="manager-title" className="max-h-[min(90vh,720px)] w-full max-w-xl overflow-y-auto rounded-lg bg-white p-5 shadow-2xl sm:p-6">
					<div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-3"><div><h2 id="manager-title" className="m-0 font-display text-lg font-bold text-slate-900">{form.id ? 'Изменить менеджера' : 'Новый менеджер'}</h2><p className="mt-1 mb-0 text-xs text-slate-500">{form.id ? 'Оставьте пароль пустым, чтобы не менять его' : 'Логин и пароль обязательны'}</p></div><button type="button" onClick={() => setForm(null)} aria-label="Закрыть" className="grid size-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100"><X size={18} /></button></div>
					{formError && <p role="alert" className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{formError}</p>}
					<form onSubmit={saveManager} className="space-y-4">
						<div className="grid gap-3 sm:grid-cols-2">
							<label><span className={labelClass}>Имя</span><input maxLength="150" value={form.first_name} onChange={setField('first_name')} className={inputClass} /></label>
							<label><span className={labelClass}>Фамилия</span><input maxLength="150" value={form.last_name} onChange={setField('last_name')} className={inputClass} /></label>
						</div>
						<div className="grid gap-3 sm:grid-cols-2">
							<label><span className={labelClass}>Логин *</span><input required autoFocus maxLength="150" autoComplete="off" value={form.username} onChange={setField('username')} className={inputClass} /></label>
							<label><span className={labelClass}>Email</span><input type="email" value={form.email} onChange={setField('email')} className={inputClass} /></label>
						</div>
						<label className="block"><span className={labelClass}>{form.id ? 'Новый пароль' : 'Пароль *'}</span>
							<span className="relative block"><input required={!form.id} minLength="8" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={form.password} onChange={setField('password')} placeholder="Минимум 8 символов" className={`${inputClass} pr-10`} /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'} className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded text-slate-400 hover:text-slate-600">{showPassword ? <EyeOff size={15} /> : <Eye size={15} />}</button></span>
						</label>
						<label className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} className="size-4 accent-blue-600" /> Активен (может входить в CRM)</label>
						<div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => setForm(null)} className="h-9 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50">Отмена</button><button type="submit" disabled={saving || !form.username.trim()} className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{saving && <LoaderCircle size={14} className="animate-spin" />} {form.id ? 'Сохранить' : 'Создать менеджера'}</button></div>
					</form>
				</section>
			</div>}

			{toBlock && <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !blocking) setToBlock(null) }}>
				<section role="alertdialog" aria-modal="true" aria-labelledby="block-title" className="w-full max-w-sm rounded-lg bg-white p-5 shadow-2xl">
					<h2 id="block-title" className="m-0 font-display text-base font-bold text-slate-900">Заблокировать {fullName(toBlock)}?</h2>
					<p className="mt-2 mb-0 text-xs text-slate-500">Менеджер не сможет войти в CRM. История его заказов и действий сохранится, позже его можно разблокировать.</p>
					<div className="mt-5 flex justify-end gap-2"><button type="button" disabled={blocking} onClick={() => setToBlock(null)} className="h-9 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50">Отмена</button><button type="button" disabled={blocking} onClick={blockManager} className="inline-flex h-9 items-center gap-2 rounded-md bg-rose-600 px-3 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60">{blocking && <LoaderCircle size={14} className="animate-spin" />} Заблокировать</button></div>
				</section>
			</div>}
		</div>
	)
}

export default ManagersPage